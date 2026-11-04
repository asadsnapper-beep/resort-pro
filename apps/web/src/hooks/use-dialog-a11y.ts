'use client';

import { useEffect, useRef } from 'react';

/**
 * The keyboard half of being a dialog: body scroll lock, Escape, focus in on
 * open, focus back out on close, and Tab kept inside.
 *
 * Every overlay in this app had written some subset of this by hand, and each
 * one was missing different pieces. `ModalShell` had four of the five; the two
 * room overlays had only the scroll lock, so a keyboard user could open Add
 * Room and then Tab straight out of it into the page underneath — still there,
 * still focusable, just hidden behind a backdrop.
 * (Room Management QA 2026-10-28, RM-010.)
 *
 * The attributes that make a dialog *announce* itself — `role="dialog"`,
 * `aria-modal`, `aria-labelledby` — stay with each overlay's own markup,
 * because only the overlay knows which element holds its title. This hook is
 * the behaviour, which is identical everywhere.
 *
 * `open` is what the caller already uses to decide whether to render; nothing
 * is attached while it is false.
 */
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  /**
   * Flipped by the caller after its mount effect runs. A portal's panel does
   * not exist on the first render, so focus has nothing to move to until the
   * render after this becomes true.
   */
  ready = true,
}: {
  open: boolean;
  onClose: () => void;
  ready?: boolean;
}) {
  const panelRef = useRef<T | null>(null);

  // Scroll lock. The page behind a full-screen overlay scrolling under it is
  // the visible symptom; the invisible one is that it is still interactive.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Escape, and focus pulled back whenever it leaves the panel.
  useEffect(() => {
    if (!open || !ready) return;

    // Which end to re-enter at. Set by the Tab that is about to move focus,
    // read when that move turns out to have left the panel.
    let backwards = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      backwards = e.shiftKey;

      /*
        Wrap at the boundary when we can tell we are on it. This is the part
        that does not work on WebKit — see the note on `onFocusIn` — so it is
        a shortcut, not the trap: everything below still runs if this misses.
        It is worth having because it is the only version that keeps focus
        inside *synchronously*. Where it applies, focus never visits the page
        behind at all, rather than visiting it and being brought back.
      */
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = focusableWithin(panel);
      if (focusable.length === 0) return;
      const edge = e.shiftKey ? focusable[0] : focusable[focusable.length - 1];
      if (document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
      }
    };

    const pullBack = () => {
      const panel = panelRef.current;
      if (!panel || !document.contains(panel)) return;
      if (panel.contains(document.activeElement)) return;

      const focusable = focusableWithin(panel);
      const target = focusable.length === 0
        ? panel
        : backwards ? focusable[focusable.length - 1] : focusable[0];
      target.focus();
    };

    /*
      The trap reacts to focus having *arrived* somewhere outside the panel,
      rather than to "was Tab pressed while standing on the last control".

      That boundary version is the obvious one and is what this started as. It
      does not work on WebKit, which leaves buttons out of sequential focus
      navigation by default: the last element in DOM order is one Tab never
      reaches, so `active === last` was never true and focus walked out of Add
      Room after ten presses. Chrome passed it. The Mobile Safari project is
      the only reason that was caught.

      The second attempt watched `focusout` and read its `relatedTarget` to
      decide whether focus was leaving. Measured on WebKit, `relatedTarget` is
      null even when focus is moving to another element in the same document,
      so there is nothing there to branch on. `focusin` says where focus now
      is, which needs no inference and is the same on both engines.

      Reacting rather than steering also leaves the browser's own tab order
      alone, which matters here: the detail sheet embeds a video in an
      <iframe>, and a trap that drives the order from its own list cannot hand
      focus to anything inside one.
    */
    const onFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel || !document.contains(panel)) return;
      if (panel.contains(e.target as Node)) return;
      pullBack();
    };

    /*
      And the case `focusin` cannot see: focus leaving the document entirely,
      which resets `document.activeElement` to <body> and fires no focusin at
      all. Deferred by a task because the engine is still performing the move
      while focusout runs — focusing inside that handler is ignored.
    */
    let pending = 0;
    const onFocusOut = () => {
      clearTimeout(pending);
      pending = window.setTimeout(pullBack, 0);
    };

    document.addEventListener('keydown', onKeyDown);
    // Capture, so a descendant that stops propagation cannot hide the move.
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      clearTimeout(pending);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
    };
  }, [open, ready, onClose]);

  // Focus in when it opens, and back to whatever opened it when it closes.
  // Without the second half, dismissing an overlay dropped focus onto
  // document.body and a keyboard user restarted from the top of the page.
  useEffect(() => {
    if (!open || !ready) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Several consumers `autoFocus` a field inside the panel. Taking focus
    // away from them would be a regression dressed as an improvement.
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open, ready]);

  return panelRef;
}

/**
 * The tab order inside `root`, in document order.
 *
 * `disabled` is excluded by the selector; `display: none` and
 * `visibility: hidden` are not, and both are common here — the room form
 * hides its video input once four are added, and Tailwind's `hidden md:flex`
 * leaves the desktop sidebar in the DOM at phone widths. `offsetParent` is
 * null for a `display: none` subtree, which is the cheap version of that
 * check; the `getClientRects` fallback covers `position: fixed`, where
 * `offsetParent` is null even when the element is on screen.
 */
function focusableWithin(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    el =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      (el.offsetParent !== null || el.getClientRects().length > 0),
  );
}
