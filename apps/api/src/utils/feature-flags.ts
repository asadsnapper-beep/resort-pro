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
  // Default OFF — built behind flags, enabled per-tenant from super-admin once
  // the platform AI master switch is on. See plan/ai/ROLLOUT-STRATEGY.md
  {
    flag: 'ai_content',
    label: 'AI Content Generator & Onboarding',
    description: 'AI writes room/website/menu content and powers the "describe your resort" onboarding setup. Owner reviews drafts before anything is applied.',
    category: 'AI',
    defaultOn: false,
  },
  {
    flag: 'ai_chatbot',
    label: 'AI Guest Chatbot & Booking',
    description: 'Website chatbot that answers guest questions, checks availability, and guides them to booking (deep-link or lead capture).',
    category: 'AI',
    defaultOn: false,
  },
  {
    flag: 'ai_business_insights',
    label: 'AI Business Suggestions',
    description: 'Revenue intelligence dashboard with weekly briefings, anomaly detection, and actionable business suggestions.',
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
    defaultOn: false,
    ownerControllable: true,
  },
  {
    flag: 'custom_domain',
    label: 'Custom Domain',
    description: 'Connect a domain you own to your ResortPro booking site.',
    category: 'Modules',
    defaultOn: false,
  },
  {
    flag: 'payment_gateway',
    label: 'Online Payment Gateway',
    description: 'Accept guest payments through your configured payment gateway.',
    category: 'Modules',
    defaultOn: false,
  },
  {
    flag: 'housekeeping_module', label: 'Housekeeping',
    description: 'Plan, assign, and track room cleaning tasks.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'inventory_module', label: 'Inventory',
    description: 'Manage stock, vendors, and purchase orders.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'maintenance_module', label: 'Maintenance',
    description: 'Track maintenance tickets, schedules, and assets.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'marketing_module', label: 'Marketing',
    description: 'Create guest campaigns and marketing automations.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'loyalty_module', label: 'Loyalty',
    description: 'Reward returning guests with points and benefits.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'offers_module', label: 'Offers & Packages',
    description: 'Publish special offers and stay packages.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'rate_plans_module', label: 'Rate Plans',
    description: 'Create flexible pricing plans for rooms and stays.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'group_bookings_module', label: 'Group Bookings',
    description: 'Manage room blocks and bookings for groups.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'vehicles_module', label: 'Vehicles',
    description: 'Manage transfers and resort vehicle operations.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'venues_module', label: 'Venues',
    description: 'Manage venues, event spaces, and bookings.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'corporate_accounts_module', label: 'Corporate Accounts',
    description: 'Manage corporate clients, contracts, and billing.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'channel_sync', label: 'OTA Channel Sync',
    description: 'Sync availability and rates with external channels.', category: 'Modules', defaultOn: false,
  },
  {
    flag: 'multi_property', label: 'Multi-property Management',
    description: 'Manage multiple resort properties from one account.', category: 'Modules', defaultOn: false,
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
