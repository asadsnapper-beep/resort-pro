/**
 * PageShell — the outer wrapper for every dashboard page.
 *
 * Deliberately thin: the (dashboard) layout's <main> already owns the page
 * padding (`p-4 md:p-6 pb-20 md:pb-6`), so all this owns is the vertical
 * rhythm between sections and the entry animation.
 *
 * `gap` exists because pages are currently split almost evenly between
 * space-y-4 (25 pages) and space-y-6 (24). Normalising them would change
 * spacing on half the app, so migration passes the page's existing value and
 * keeps it pixel-identical. Picking one default is a design decision for later
 * — when it's made, it changes here once.
 */
import type { ReactNode } from 'react';

const GAP = {
  4: 'space-y-4',
  6: 'space-y-6',
  8: 'space-y-8',
} as const;

export function PageShell({
  children,
  gap = 6,
  animate = true,
  className = '',
}: {
  children: ReactNode;
  /** Vertical rhythm between sections. Pass the page's existing value when migrating. */
  gap?: keyof typeof GAP;
  /** The fade-up entry animation. On by default — 28 pages use it today. */
  animate?: boolean;
  className?: string;
}) {
  return (
    <div className={`${GAP[gap]}${animate ? ' animate-fade-up' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
