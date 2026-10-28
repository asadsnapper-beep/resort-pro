/**
 * Who the preview channel will listen to.
 *
 * The frame used to apply `rp-preview-update` from any sender at all. The
 * preview URL needs no login, so any page could embed a resort's site in an
 * iframe and post content into what it renders. Nothing is persisted and the
 * victim has to be looking at the attacker's page, so this is small — but a
 * page that renders whatever it is told is not worth keeping, and the audit
 * asked for the check on both sides (WB-003).
 */
import { describe, it, expect } from 'vitest';
import { isTrustedPreviewMessage } from '@/lib/preview-channel';

const here = () => window.location.origin;
const elsewhere = 'https://not-resortpro.example';

// Stand-ins for the two windows involved. Identity is all the check uses.
const editor = {} as Window;
const frame = {} as Window;

describe('isTrustedPreviewMessage', () => {
  it('accepts the window it was told to expect', () => {
    expect(isTrustedPreviewMessage({ origin: here(), source: editor }, editor)).toBe(true);
  });

  it('refuses another origin, whichever window it claims to be', () => {
    expect(isTrustedPreviewMessage({ origin: elsewhere, source: editor }, editor)).toBe(false);
  });

  it('refuses the right origin from the wrong window', () => {
    // Two frames on one page are same-origin with each other. Pinning the
    // source is what separates the editor from anything else on its origin.
    expect(isTrustedPreviewMessage({ origin: here(), source: frame }, editor)).toBe(false);
  });

  it('refuses everything when there is no window to expect', () => {
    // The editor before its iframe exists. Nothing should be accepted yet.
    expect(isTrustedPreviewMessage({ origin: here(), source: editor }, null)).toBe(false);
    expect(isTrustedPreviewMessage({ origin: here(), source: editor }, undefined)).toBe(false);
  });

  it('refuses a preview that has no parent, rather than trusting itself', () => {
    // Opened in its own tab, `window.parent === window`. There is no editor to
    // talk to, so there is no message worth accepting either.
    expect(isTrustedPreviewMessage({ origin: here(), source: window }, window)).toBe(false);
  });

  it('refuses a message with no source', () => {
    expect(isTrustedPreviewMessage({ origin: here(), source: null }, editor)).toBe(false);
  });
});
