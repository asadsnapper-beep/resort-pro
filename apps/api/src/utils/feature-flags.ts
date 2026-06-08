/**
 * Feature Flag Registry
 *
 * Central definition of all platform feature flags.
 * Add a new flag here — it automatically appears in the admin toggle UI.
 *
 * flag:        unique string key stored in DB
 * label:       human-readable name shown in admin UI
 * description: what it does / who it's for
 * category:    grouping for the UI
 * defaultOn:   if true, new tenants get this flag enabled by default
 */
export interface FlagDefinition {
  flag: string;
  label: string;
  description: string;
  category: 'Analytics' | 'AI' | 'Reporting' | 'UX' | 'Beta' | 'Modules';
  defaultOn: boolean;
  ownerControllable?: boolean; // if true, owners can toggle this themselves from Settings
}

export const FLAG_REGISTRY: FlagDefinition[] = [
  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    flag: 'beta_analytics',
    label: 'Advanced Analytics Dashboard',
    description: 'Shows enhanced charts, occupancy heatmaps, and revenue breakdowns in the owner dashboard.',
    category: 'Analytics',
    defaultOn: false,
  },
  {
    flag: 'revenue_forecast',
    label: 'Revenue Forecasting',
    description: 'AI-powered 90-day revenue forecast widget on the dashboard.',
    category: 'Analytics',
    defaultOn: false,
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  {
    flag: 'ai_suggestions',
    label: 'AI Room Description Generator',
    description: 'Adds a "Generate with AI" button on room edit pages to auto-write descriptions.',
    category: 'AI',
    defaultOn: false,
  },
  {
    flag: 'ai_pricing',
    label: 'AI Dynamic Pricing',
    description: 'Suggests optimal room prices based on occupancy, season, and local events.',
    category: 'AI',
    defaultOn: false,
  },

  // ── Reporting ─────────────────────────────────────────────────────────────
  {
    flag: 'advanced_reports',
    label: 'Advanced Reports Module',
    description: 'Unlocks detailed downloadable reports: guest demographics, booking channels, payment methods.',
    category: 'Reporting',
    defaultOn: false,
  },
  {
    flag: 'export_pdf',
    label: 'PDF Export',
    description: 'Enables PDF export button on booking detail pages and invoices.',
    category: 'Reporting',
    defaultOn: false,
  },

  // ── UX ────────────────────────────────────────────────────────────────────
  {
    flag: 'new_booking_flow',
    label: 'New Booking Flow (Beta)',
    description: 'Opt into the redesigned multi-step booking creation wizard.',
    category: 'UX',
    defaultOn: false,
  },
  {
    flag: 'dark_mode_toggle',
    label: 'Dark Mode Toggle',
    description: 'Shows a light/dark mode switcher in the tenant dashboard.',
    category: 'UX',
    defaultOn: false,
  },

  // ── Modules (owner-controlled) ────────────────────────────────────────────
  {
    flag: 'restaurant_module',
    label: 'Restaurant & F&B',
    description: 'Restaurant menu, F&B orders, and inventory management. Disable if your resort has no restaurant.',
    category: 'Modules',
    defaultOn: true,
    ownerControllable: true,
  },

  // ── Beta ──────────────────────────────────────────────────────────────────
  {
    flag: 'crm_v2',
    label: 'CRM v2 (Beta)',
    description: 'New guest CRM with segmentation, lifecycle stages, and email automation improvements.',
    category: 'Beta',
    defaultOn: false,
  },
];

export const FLAG_KEYS = FLAG_REGISTRY.map((f) => f.flag);
export const FLAG_MAP = Object.fromEntries(FLAG_REGISTRY.map((f) => [f.flag, f]));
