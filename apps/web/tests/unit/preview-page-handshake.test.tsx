/**
 * The preview frame's half of the handshake.
 *
 * The builder posts the unsaved form into this frame on a 600ms debounce. The
 * frame installed its listener after mount, so an update sent while the
 * document was still loading reached a window that was not listening and was
 * dropped — `postMessage` has no queue. A repeated browser run produced one
 * pass and one miss (Website Builder QA 2026-10-28, WB-003). The frame now
 * announces itself and the editor answers, which is what makes the order of
 * the two sides stop mattering.
 *
 * These tests drive the frame directly, because that is where both halves of
 * the fix live: the announcement, and the refusal to take an update from
 * anyone who is not the editor.
 *
 * The themes are mocked. What is under test is the channel, not how a resort
 * is drawn.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { PREVIEW_READY, PREVIEW_UPDATE, PREVIEW_STORAGE_KEY } from '@/lib/preview-channel';
import type { ResortData } from '@/components/themes/types';
import { PreviewPage } from '@/app/(public)/[slug]/PreviewPage';

vi.mock('@/components/themes/registry', () => ({
  // Renders just enough to read back what the frame currently believes.
  getTheme: () => ({ data }: { data: ResortData }) => (
    <main>{data.website?.heroTitle}</main>
  ),
}));

vi.mock('@/components/themes/config-renderer', () => ({
  ConfigThemeRenderer: () => <main>config theme</main>,
}));


const SAVED = 'The resort as it was last published';

const initialData = {
  tenant: { name: 'Tea Garden Eco Resort', slug: 'tea-garden' },
  website: { heroTitle: SAVED },
  rooms: [],
} as unknown as ResortData;

/** The editor window, as the frame sees it: `window.parent`. */
let editor: Window & { postMessage: ReturnType<typeof vi.fn> };

/** A message as the editor would really send it — right origin, right window. */
function messageFromEditor(data: unknown, from: unknown = editor) {
  const event = new MessageEvent('message', { data, origin: window.location.origin });
  // jsdom will not take a plain object as `source` through the constructor.
  Object.defineProperty(event, 'source', { value: from });
  act(() => { window.dispatchEvent(event); });
}

beforeEach(() => {
  editor = { postMessage: vi.fn() } as unknown as typeof editor;
  Object.defineProperty(window, 'parent', { value: editor, configurable: true });
  sessionStorage.clear();
});

afterEach(() => {
  // This suite's vitest config does not set `globals`, so testing-library
  // never registers its own afterEach — without this the renders pile up and
  // every query finds two of everything.
  cleanup();
  Object.defineProperty(window, 'parent', { value: window, configurable: true });
  vi.clearAllMocks();
});

const renderPreview = () =>
  render(<PreviewPage initialData={initialData} themeKey="luxe" configJson={null} />);

describe('announcing itself', () => {
  it('tells the editor it is listening, as soon as it is', () => {
    renderPreview();
    expect(editor.postMessage).toHaveBeenCalledWith(
      { type: PREVIEW_READY },
      window.location.origin,
    );
  });

  it('addresses that only to its own origin, not to everyone', () => {
    renderPreview();
    expect(editor.postMessage.mock.calls[0][1]).not.toBe('*');
  });

  it('says nothing when it has no editor to talk to', () => {
    // Opened in its own tab: `window.parent === window`. Announcing to itself
    // would be noise, and there is nobody to answer.
    const selfPost = vi.fn();
    Object.defineProperty(window, 'parent', { value: window, configurable: true });
    const original = window.postMessage;
    window.postMessage = selfPost as typeof window.postMessage;
    try {
      renderPreview();
      expect(selfPost).not.toHaveBeenCalled();
    } finally {
      window.postMessage = original;
    }
  });
});

describe('an update from the editor', () => {
  it('replaces what the owner sees', () => {
    renderPreview();
    expect(screen.getByText(SAVED)).toBeTruthy();

    messageFromEditor({ type: PREVIEW_UPDATE, payload: { heroTitle: 'Typed, not yet saved' } });

    expect(screen.getByText('Typed, not yet saved')).toBeTruthy();
    expect(screen.queryByText(SAVED)).toBeNull();
  });

  it('keeps the fields it does not mention', () => {
    renderPreview();
    messageFromEditor({ type: PREVIEW_UPDATE, payload: { seoTitle: 'Only SEO changed' } });
    expect(screen.getByText(SAVED)).toBeTruthy();
  });

  it('shows that it is live once something has arrived', () => {
    renderPreview();
    expect(screen.queryByText('● live')).toBeNull();
    messageFromEditor({ type: PREVIEW_UPDATE, payload: { heroTitle: 'Now live' } });
    expect(screen.getByText('● live')).toBeTruthy();
  });
});

describe('an update from anyone else', () => {
  it('is ignored when it comes from another origin', () => {
    renderPreview();
    const event = new MessageEvent('message', {
      data: { type: PREVIEW_UPDATE, payload: { heroTitle: 'Injected by another page' } },
      origin: 'https://not-resortpro.example',
    });
    Object.defineProperty(event, 'source', { value: editor });
    act(() => { window.dispatchEvent(event); });

    expect(screen.queryByText('Injected by another page')).toBeNull();
    expect(screen.getByText(SAVED)).toBeTruthy();
  });

  it('is ignored when it comes from the right origin but the wrong window', () => {
    renderPreview();
    messageFromEditor(
      { type: PREVIEW_UPDATE, payload: { heroTitle: 'Injected by a sibling frame' } },
      {} as Window,
    );
    expect(screen.queryByText('Injected by a sibling frame')).toBeNull();
    expect(screen.getByText(SAVED)).toBeTruthy();
  });

  it('ignores a message of a type it does not know', () => {
    renderPreview();
    messageFromEditor({ type: 'something-else', payload: { heroTitle: 'Wrong type' } });
    expect(screen.queryByText('Wrong type')).toBeNull();
  });

  it('ignores an update with no payload', () => {
    renderPreview();
    messageFromEditor({ type: PREVIEW_UPDATE });
    expect(screen.getByText(SAVED)).toBeTruthy();
  });
});

describe('a preview opened in its own tab', () => {
  it('falls back to what the editor left in sessionStorage', () => {
    // There is no parent to answer a handshake here, so this is the only route
    // the owner's unsaved edits can take.
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({ heroTitle: 'Left in storage' }));
    renderPreview();
    expect(screen.getByText('Left in storage')).toBeTruthy();
  });

  it('renders the published site when storage holds nothing', () => {
    renderPreview();
    expect(screen.getByText(SAVED)).toBeTruthy();
  });

  it('survives storage it cannot parse', () => {
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, 'not json');
    renderPreview();
    expect(screen.getByText(SAVED)).toBeTruthy();
  });
});
