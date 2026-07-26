/**
 * ActionButton — the button used in page headers and toolbars.
 *
 * Reproduces the shape repeated ~46 times across dashboard pages:
 *   flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium
 * expressed with Phase 0 tokens (rounded-rp-ctrl, text-rp-body) so the values
 * live in one place.
 *
 * Variants match what pages actually do today:
 *   primary   — the dark brand fill (--rp-btn-accent), used for the main action
 *   secondary — bordered/ghost, used for Cancel and secondary toolbar actions
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

const BASE =
  'flex items-center gap-2 rounded-rp-ctrl px-4 py-2 text-rp-body font-medium transition-colors disabled:opacity-50';

const VARIANT: Record<Variant, string> = {
  // Solid brand fill. Colours come from the tokens rather than inline style,
  // which is how every page writes it today.
  primary: 'bg-rp-btn-accent text-rp-btn-accent-text hover:opacity-90',
  // Bordered. Uses the same border/text tokens the existing Cancel buttons do.
  secondary: 'border border-rp-border-md text-rp-subtle hover:bg-rp-surface-3',
};

export function ActionButton({
  children,
  variant = 'primary',
  icon,
  className = '',
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  /** Leading icon — pages pass a 16px lucide icon (`h-4 w-4`). */
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${BASE} ${VARIANT[variant]}${className ? ` ${className}` : ''}`}
    >
      {icon}
      {children}
    </button>
  );
}
