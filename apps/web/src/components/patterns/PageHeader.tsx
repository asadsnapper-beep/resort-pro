/**
 * PageHeader — page title, optional subtitle, optional right-aligned actions.
 *
 * This is the single most duplicated block in the dashboard: 35 of 38 pages
 * write the exact same markup by hand, and 30 write the same subtitle line.
 * It is reproduced here token-for-token so migrating a page changes no pixels:
 *
 *   text-[26px]     → text-rp-title    (26px)
 *   text-[#18231f]  → text-rp-text     (#18231f light / #dfd9d0 dark)
 *   text-[13px]     → text-rp-body     (13px)
 *   text-[#7a9890]  → text-rp-muted-2  (#7a9890 light / #94b8b0 dark)
 *
 * Note the dark-mode win: pages currently either hand-write
 * `dark:text-[#dfd9d0]` (11 pages) or rely on the per-hex `!important` patches
 * at the bottom of globals.css (24 pages). The tokens make it automatic and
 * identical for all of them, and let those patches eventually be deleted.
 */
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned action area — usually one <ActionButton>. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="font-display text-rp-title font-medium tracking-[-0.01em] text-rp-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-[4px] text-rp-body text-rp-muted-2">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
