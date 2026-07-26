/**
 * PageHeader — page title, optional subtitle, optional right-aligned actions.
 *
 * The most duplicated block in the dashboard: 35 of 38 pages write the same h1
 * markup and 30 the same subtitle line. Reproduced token-for-token so migrating
 * a page changes no pixels:
 *
 *   text-[26px]     → text-rp-title    (26px)
 *   text-[#18231f]  → text-rp-text     (#18231f light / #dfd9d0 dark)
 *   text-[13px]     → text-rp-body     (13px)
 *   text-[#7a9890]  → text-rp-muted-2  (#7a9890 light / #94b8b0 dark)
 *
 * Dark-mode win: pages currently either hand-write `dark:text-[#dfd9d0]` or
 * rely on the per-hex `!important` patches at the bottom of globals.css. The
 * tokens make it automatic and identical for all of them, and let those
 * patches eventually be deleted.
 *
 * `align` exists because the header row is NOT uniform across the app — a
 * survey of all 35 pages found five distinct shapes, and `items-start` (this
 * component's original hardcoded guess) was used by only two of them:
 *
 *   no actions  → 10 pages   items-end   →  8 pages
 *   items-center →  8 pages   responsive  →  4 pages
 *   items-start  →  2 pages
 *
 * Pass the page's existing shape when migrating so nothing shifts. Collapsing
 * these five into one is a design decision for later — and when it's made, it
 * changes here once.
 */
import type { ReactNode } from 'react';

type Align = 'start' | 'center' | 'end' | 'responsive';

const ROW: Record<Align, string> = {
  start:      'flex items-start justify-between',
  center:     'flex items-center justify-between',
  end:        'flex items-end justify-between',
  responsive: 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
};

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  align = 'start',
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned action area — usually one <ActionButton>. */
  actions?: ReactNode;
  /**
   * Optional badge/icon rendered before the title, inside the h1. Three pages
   * do this today by adding `flex items-center gap-3` to the h1 itself; this
   * reproduces that exactly without callers needing to know the internals.
   */
  icon?: ReactNode;
  /** Vertical alignment of the actions against the title block. */
  align?: Align;
  /** Extra classes on the row (e.g. `no-print` on the reports page). */
  className?: string;
}) {
  const heading = (
    <div>
      <h1
        className={`font-display text-rp-title font-medium tracking-[-0.01em]${
          icon ? ' flex items-center gap-3' : ''
        } text-rp-text`}
      >
        {icon}
        {title}
      </h1>
      {subtitle && (
        <p className="mt-[4px] text-rp-body text-rp-muted-2">{subtitle}</p>
      )}
    </div>
  );

  // With no actions, stay a plain block — that is exactly what those 10 pages
  // write today. Wrapping a lone child in a flex row would change its width
  // behaviour (block fills, flex item shrinks to content) and could re-wrap text.
  if (!actions) return heading;

  return (
    <div className={`${ROW[align]}${className ? ` ${className}` : ''}`}>
      {heading}
      {actions}
    </div>
  );
}
