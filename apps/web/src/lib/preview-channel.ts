/**
 * The channel between the website builder and its live preview.
 *
 * The builder renders the resort's public page in an iframe and posts the
 * unsaved form into it so the owner sees their edits before publishing. That
 * had a startup race: the parent posted on a 600ms debounce, the frame
 * installed its listener after mount, and a message sent while the frame was
 * still loading was delivered to a document that was not listening yet and
 * lost. A repeated run produced one pass and one miss (Website Builder QA
 * 2026-10-28, WB-003).
 *
 * `postMessage` has no delivery guarantee and no queue, so no amount of
 * waiting on the sending side fixes it. The frame has to say when it is
 * listening — `rp-preview-ready` — and the editor answers with the latest
 * form. Ordering then stops mattering, which is the only way a race like this
 * actually closes.
 *
 * The other half is that the frame used to apply `rp-preview-update` from any
 * sender at all. The preview URL needs no login, so any page could embed a
 * resort's site and post content into what it renders. Nothing is persisted,
 * but a page that will show whatever it is told is not worth keeping, so both
 * sides check who they are talking to.
 */

/** The frame is mounted and listening. Frame → editor, once. */
export const PREVIEW_READY = 'rp-preview-ready';

/** The current unsaved form. Editor → frame, on ready and on every change. */
export const PREVIEW_UPDATE = 'rp-preview-update';

/**
 * Where the editor also leaves the form, for a preview opened in its own tab.
 *
 * There is no parent to ask in that case, so the handshake cannot help and
 * this is the only route. It stays as a second path rather than the main one,
 * because it cannot carry an edit made after the tab was opened.
 */
export const PREVIEW_STORAGE_KEY = 'rp-website-preview';

/**
 * Whether a message really came from the window we expect.
 *
 * The frame is loaded from a relative URL, so editor and preview are always
 * the same origin — anything else is somebody else's page. `expectedSource`
 * pins it further to the one window on that origin that should be talking:
 * the parent, as seen by the frame, or that frame's `contentWindow`, as seen
 * by the editor.
 *
 * A missing `expectedSource` is a rejection. It means the frame has not been
 * created yet, or the preview is top-level and has no parent, and in both
 * cases there is no legitimate sender to accept.
 */
export function isTrustedPreviewMessage(
  event: Pick<MessageEvent, 'origin' | 'source'>,
  expectedSource: Window | null | undefined,
): boolean {
  if (event.origin !== window.location.origin) return false;
  if (!expectedSource || expectedSource === window) return false;
  return event.source === expectedSource;
}
