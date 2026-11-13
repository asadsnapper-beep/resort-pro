/**
 * The shared modal's panel must be a themed surface, not a literal white.
 *
 * `globals.css` makes `bg-white` survive dark mode with
 *
 *     .dark main .bg-white { background-color: var(--rp-surface) !important; }
 *
 * — scoped to inside `<main>`. `components/ui/modal.tsx` renders through
 * `createPortal` to `document.body`, which is **outside `<main>`**, so that
 * patch cannot match it. The panel stayed `#ffffff`: a white sheet in the
 * middle of a dark app, on both `Modal` and `ConfirmModal`.
 *
 * `bg-rp-modal` resolves through `--rp-modal`, which `globals.css` redefines
 * per theme (`#ffffff` light, `#10243f` dark), so the portal is irrelevant to
 * it — the variable follows the theme wherever the element lives.
 *
 * jsdom applies no stylesheet, so this cannot assert a computed colour. What it
 * pins is the thing that regressed and would regress again: the panel carrying
 * a literal `bg-white` that only the `<main>` patch could have rescued.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Modal, ConfirmModal } from '@/components/ui/modal';

afterEach(cleanup);

/** The panel is the element carrying the shared `rounded-[18px]` radius. */
const panels = () =>
  Array.from(document.body.querySelectorAll('div')).filter(el =>
    el.className.includes('rounded-[18px]'),
  );

describe('the shared modal panel in dark mode', () => {
  it('gives Modal a themed surface rather than a literal white', () => {
    render(<Modal open onClose={() => {}} title="Edit room"><p>body</p></Modal>);

    const panel = panels()[0];
    expect(panel).toBeDefined();
    expect(panel.className).toContain('bg-rp-modal');
    expect(panel.className).not.toContain('bg-white');
  });

  it('gives ConfirmModal a themed surface too', () => {
    render(
      <ConfirmModal open onClose={() => {}} onConfirm={() => {}}
        title="Delete room" description="This cannot be undone." />,
    );

    const panel = panels()[0];
    expect(panel).toBeDefined();
    expect(panel.className).toContain('bg-rp-modal');
    expect(panel.className).not.toContain('bg-white');
  });

  it('still renders outside <main>, which is why the token is needed', () => {
    // If this ever stops being true the `<main>` patch would start covering the
    // panel again — and the comment at the top of this file would be wrong.
    render(<Modal open onClose={() => {}} title="Edit room"><p>body</p></Modal>);
    const panel = panels()[0];
    expect(panel.closest('main')).toBeNull();
  });

  it('leaves the header close button its white hover overlay', () => {
    // `hover:bg-white/10` sits on the dark header and is meant to be white at
    // 10% there. It is not the panel and must not be swept up with it.
    render(<Modal open onClose={() => {}} title="Edit room"><p>body</p></Modal>);
    const close = screen.getByRole('button');
    expect(close.className).toContain('hover:bg-white/10');
  });
});
