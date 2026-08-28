'use client';

/**
 * Global search palette — Phase B of plan/global-search.md.
 *
 * Opens on ⌘K (Ctrl+K on Windows/Linux) or by clicking the header trigger.
 * Results come from GET /api/search, which decides what this user may see; the
 * role checks here only choose which quick actions to offer, and are never the
 * thing protecting data.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, DoorOpen, UserPlus, BedDouble, Search as SearchIcon, Loader2 } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { searchApi, type SearchResult, type SearchResultType } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;

type QuickAction = { label: string; href: string; icon: typeof CalendarPlus; roles: string[] };

/**
 * Offered only where the destination is actually reachable for the role — an
 * action that opens a page the user is then refused on is worse than no action.
 */
const QUICK_ACTIONS: QuickAction[] = [
  { label: 'New booking', href: '/dashboard/bookings?new=1',   icon: CalendarPlus, roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Walk-in guest', href: '/dashboard/front-desk?walkin=1', icon: DoorOpen, roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Add guest',     href: '/dashboard/guests?new=1',   icon: UserPlus,     roles: ['OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER'] },
  { label: 'Add room',      href: '/dashboard/rooms?new=1',    icon: BedDouble,    roles: ['OWNER', 'MANAGER'] },
];

const GROUP_LABEL: Record<SearchResultType, string> = {
  booking: 'Bookings',
  guest:   'Guests',
  room:    'Rooms',
  invoice: 'Invoices',
};
const GROUP_ORDER: SearchResultType[] = ['booking', 'guest', 'room', 'invoice'];

/**
 * Split a label around the matched text so it can be emphasised with elements
 * rather than an HTML string — a guest name is user data and must never reach
 * dangerouslySetInnerHTML.
 */
function highlight(text: string, query: string) {
  const term = query.trim().split(/\s+/)[0] ?? '';
  if (term.length < MIN_QUERY) return text;
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-resort-700 dark:text-resort-300">
        {text.slice(at, at + term.length)}
      </mark>
      {text.slice(at + term.length)}
    </>
  );
}

/** True when the keystroke belongs to whatever the user is typing in. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role) ?? 'STAFF';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo(() => QUICK_ACTIONS.filter((a) => a.roles.includes(role)), [role]);
  const trimmed = query.trim();
  const tooShort = trimmed.replace(/\s+/g, '').length < MIN_QUERY;

  /** Flat, in display order, so arrow keys and Enter agree with what is drawn. */
  const flat = useMemo(() => {
    if (tooShort) return actions.map((a) => ({ kind: 'action' as const, ...a }));
    const grouped: Array<{ kind: 'result'; result: SearchResult }> = [];
    for (const type of GROUP_ORDER) {
      for (const r of results.filter((x) => x.type === type)) grouped.push({ kind: 'result', result: r });
    }
    return grouped;
  }, [tooShort, actions, results]);

  // Reset on every open so the palette never shows the last search's answers.
  useEffect(() => {
    if (!open) return;
    setQuery(''); setResults([]); setError(false); setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => { setActive(0); }, [results.length, query]);

  // Debounced fetch. The AbortController matters as much as the debounce: a
  // slow reply for an earlier query must not overwrite a newer one.
  useEffect(() => {
    if (!open || tooShort) { setResults([]); setLoading(false); setError(false); return; }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.query(trimmed, controller.signal);
        setResults(res.data.data.results ?? []);
        setError(false);
      } catch (e: any) {
        if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return;
        setError(true);
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { controller.abort(); clearTimeout(timer); };
  }, [open, trimmed, tooShort]);

  const go = useCallback((href: string, type: string) => {
    // Reported before navigating, and never awaited — selection rate is the
    // only signal that says search found the right thing, but it is not worth
    // a millisecond of the user's time.
    searchApi.recordSelection(type);
    onOpenChange(false);
    router.push(href);
  }, [onOpenChange, router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // ModalShell has no Escape handling of its own — verified, it registers no
    // keydown listener — so the palette closes itself. Focus goes back to the
    // header trigger via onOpenChange, which is what lets a keyboard user
    // resume where they were.
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[active];
      if (!item) return;
      go(item.kind === 'action' ? item.href : item.result.href,
         item.kind === 'action' ? 'action' : item.result.type);
    }
  };

  // Keep the active row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const announcement = tooShort
    ? ''
    : loading ? 'Searching'
    : error ? 'Search is temporarily unavailable'
    : `${results.length} result${results.length === 1 ? '' : 's'}`;

  let index = -1;

  return (
    <ModalShell open={open} onClose={() => onOpenChange(false)} title="Search" maxWidth="600px">
      <div onKeyDown={onKeyDown}>
        <div className="relative mb-3">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guests, bookings, rooms…"
            aria-label="Search guests, bookings, rooms"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="global-search-results"
            aria-activedescendant={flat.length ? `global-search-option-${active}` : undefined}
            autoComplete="off"
            className="w-full rounded-[10px] border border-black/10 bg-[var(--rp-surface-2)] py-2.5 pl-9 pr-3 text-[14px] text-[#183153] outline-none placeholder:text-[#64748b] focus:ring-2 focus:ring-resort-600/25 dark:border-white/10 dark:text-white"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#64748b]" />
          )}
        </div>

        <p aria-live="polite" className="sr-only">{announcement}</p>

        <div id="global-search-results" role="listbox" aria-label="Search results" ref={listRef} className="max-h-[62vh] sm:max-h-[52vh] overflow-y-auto">
          {tooShort && (
            <>
              <p className="px-1 pb-2 text-[12px] text-[#64748b]">
                {trimmed.length === 0
                  ? 'Search by guest name, phone, confirmation number, room, or invoice.'
                  : 'Keep typing to search…'}
              </p>
              {actions.length > 0 && (
                <>
                  <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#94aab9]">Quick actions</p>
                  {actions.map((a) => {
                    index += 1;
                    const i = index;
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.href}
                        id={`global-search-option-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={active === i}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(a.href, 'action')}
                        className={`flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors ${
                          active === i ? 'bg-resort-50 text-resort-900 dark:bg-white/10 dark:text-white' : 'text-[#183153] dark:text-[#cbd5e1]'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-[#64748b]" />
                        {a.label}
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}

          {!tooShort && error && (
            <div className="px-1 py-6 text-center">
              <p className="text-[13px] text-[#183153] dark:text-[#cbd5e1]">Search is temporarily unavailable.</p>
              <button
                onClick={() => setQuery((q) => `${q} `.trimEnd())}
                className="mt-2 text-[12px] font-semibold text-resort-700 underline dark:text-resort-300"
              >
                Try again
              </button>
            </div>
          )}

          {!tooShort && !error && !loading && results.length === 0 && (
            <p className="px-1 py-6 text-center text-[13px] text-[#64748b]">
              No matches for “{trimmed}”. Try a confirmation number, phone, or part of a name.
            </p>
          )}

          {!tooShort && !error && GROUP_ORDER.map((type) => {
            const rows = results.filter((r) => r.type === type);
            if (rows.length === 0) return null;
            return (
              <div key={type} className="pb-1">
                <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#94aab9]">
                  {GROUP_LABEL[type]}
                </p>
                {rows.map((r) => {
                  index += 1;
                  const i = index;
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      id={`global-search-option-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={active === i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r.href, r.type)}
                      className={`flex w-full items-start justify-between gap-3 rounded-[8px] px-3 py-2 text-left transition-colors ${
                        active === i ? 'bg-resort-50 dark:bg-white/10' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-[#183153] dark:text-white">
                          {highlight(r.title, trimmed)}
                        </span>
                        <span className="text-[12px] text-[#64748b] line-clamp-2 sm:block sm:truncate">{r.subtitle}</span>
                      </span>
                      {r.status && (
                        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:bg-white/10">
                          {r.status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * Owns the ⌘K shortcut for one dashboard shell.
 *
 * Deliberately ignores the shortcut while the user is typing somewhere, so it
 * cannot steal a keystroke from a booking form or a notes field.
 */
export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      onOpen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
