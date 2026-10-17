/**
 * What a screen reader and a keyboard get from every modal in the app.
 *
 * 31 components render through ModalShell, so each of these was 31 defects
 * wearing one coat:
 *
 *  - the close control is an X icon with no text, which is announced as
 *    "button" and nothing else;
 *  - Escape did nothing. Only a mouse click on the backdrop closed the dialog,
 *    so a keyboard user who opened one was stuck in it;
 *  - closing returned focus to document.body, restarting a keyboard user at the
 *    top of the page rather than at the control they had opened.
 *
 * The audits reported the missing dialog semantics (2026-09-09 sidebar QA,
 * "create overlays opened visually but exposed no role=dialog") and the unnamed
 * icon buttons across Settings and the dashboard pages. role="dialog" was
 * already fixed; these three were not.
 *
 * The queries below go through the accessibility tree on purpose — getByRole
 * with a name is the thing a screen reader would report, so a test that passes
 * means the name genuinely exists rather than the markup merely looking right.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ModalShell } from './modal-shell';

afterEach(cleanup);

const open = (props: Partial<React.ComponentProps<typeof ModalShell>> = {}) =>
  render(
    <ModalShell open onClose={props.onClose ?? (() => {})} title="Add Room" {...props}>
      <input aria-label="Room name" />
    </ModalShell>,
  );

describe('what the dialog announces', () => {
  it('is a dialog, named by its own heading', () => {
    open({ description: 'Add a room to your resort' });
    const dialog = screen.getByRole('dialog', { name: 'Add Room' });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('gives the close button a name instead of leaving it an icon', () => {
    open();
    expect(screen.getByRole('button', { name: /close/i })).toBeTruthy();
  });

  it('describes itself when a description was given', () => {
    open({ description: 'Add a room to your resort' });
    const dialog = screen.getByRole('dialog');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe('Add a room to your resort');
  });

  it('claims no description when there is none to point at', () => {
    open();
    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeNull();
  });
});

describe('the keyboard', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening once the dialog is closed', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ModalShell open onClose={onClose} title="Add Room"><p>body</p></ModalShell>,
    );
    rerender(<ModalShell open={false} onClose={onClose} title="Add Room"><p>body</p></ModalShell>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('where focus goes', () => {
  it('moves into the dialog when it opens', () => {
    open();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('leaves an autoFocused field alone', () => {
    // Three consumers autoFocus a field. Pulling focus to the panel would put
    // the caret nowhere and undo what they asked for.
    render(
      <ModalShell open onClose={() => {}} title="Add Room">
        <input aria-label="Room name" autoFocus />
      </ModalShell>,
    );
    expect(screen.getByLabelText('Room name')).toBe(document.activeElement);
  });

  it('returns focus to whatever opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(
      <ModalShell open onClose={() => {}} title="Add Room"><p>body</p></ModalShell>,
    );
    expect(document.activeElement).not.toBe(opener);

    rerender(<ModalShell open={false} onClose={() => {}} title="Add Room"><p>body</p></ModalShell>);
    expect(document.activeElement).toBe(opener);

    opener.remove();
  });
});
