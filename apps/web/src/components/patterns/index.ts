/**
 * Composite dashboard patterns — Layer 3 of the design system.
 *
 * Pages should compose these plus tokens, and never reach for a raw hex, a raw
 * px font size, or an inline style. Change a pattern here and every page that
 * uses it follows — that is the whole point.
 *
 * See apps/web/DESIGN_TOKENS.md and plan/design-system-migration.md.
 */
export { PageShell } from './PageShell';
export { PageHeader } from './PageHeader';
export { ActionButton } from './ActionButton';
export { DataTable, type DataColumn } from './DataTable';
export { EmptyState } from './EmptyState';
export { FilterBar } from './FilterBar';
export { FormField } from './FormField';
export { StatCard, StatGrid } from './StatCard';
export { TabBar } from './TabBar';
export { ConfirmDialog } from './ConfirmDialog';
