import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        resort: {
          50: '#f2f7fb',
          100: '#e5f0f7',
          200: '#d4e4ef',
          300: '#bdd2e2',
          400: '#8fafc8',
          500: '#3a6d98',
          600: '#183153',
          700: '#122846',
          800: '#10243f',
          900: '#0e223c',
        },
        gold: {
          400: '#f0c55a',
          500: '#d4a853',
          600: '#b8893f',
        },
        // ── ResortPro semantic tokens (namespaced `rp-` to avoid colliding
        //    with the shadcn names above: muted, accent, border, gold, …).
        //    These resolve to the --rp-* vars in globals.css, which already
        //    have dark-mode values — so `text-rp-muted` replaces the
        //    `text-[#8aa29a] dark:text-[#94b8b0]` pair and dark mode is
        //    automatic. Note: because these are full colours (not HSL
        //    channels), Tailwind opacity modifiers like `text-rp-muted/50`
        //    do NOT work — use a dedicated token instead.
        rp: {
          // Text
          text: 'var(--rp-text)',
          muted: 'var(--rp-text-muted)',
          'muted-2': 'var(--rp-text-muted-2)',
          subtle: 'var(--rp-text-subtle)',
          faint: 'var(--rp-text-faint)',
          accent: 'var(--rp-text-accent)',
          // Surfaces
          surface: 'var(--rp-surface)',
          'surface-2': 'var(--rp-surface-2)',
          'surface-3': 'var(--rp-surface-3)',
          'surface-4': 'var(--rp-surface-4)',
          modal: 'var(--rp-modal)',
          // Borders
          border: 'var(--rp-border)',
          'border-md': 'var(--rp-border-md)',
          // Brand
          brand: 'var(--rp-brand)',
          'brand-hover': 'var(--rp-brand-hover)',
          'brand-deep': 'var(--rp-brand-deep)',
          // Accents
          gold: 'var(--rp-gold)',
          'gold-bright': 'var(--rp-gold-bright)',
          danger: 'var(--rp-danger)',
          coral: 'var(--rp-coral)',
          // Status backgrounds
          'teal-bg': 'var(--rp-teal-bg)',
          'amber-bg': 'var(--rp-amber-bg)',
          'red-bg': 'var(--rp-red-bg)',
          'coral-bg': 'var(--rp-coral-bg)',
          'teal-soft': 'var(--rp-teal-soft)',
          // Brand button
          'btn-accent': 'var(--rp-btn-accent)',
          'btn-accent-text': 'var(--rp-btn-accent-text)',
        },
        canvas: '#efece6',
        sidebar: '#183153',
        'teal-tint': '#e5f0f7',
        'gold-tint': '#f4ecda',
        'coral-tint': '#fceee4',
        'nav-label': '#4a6e66',
        'nav-inactive': '#9bbdb7',
        'nav-icon': '#6a9990',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // ── ResortPro radius scale ──────────────────────────────────────────
        // Values are the ones dashboard pages already use, so swapping
        // rounded-[14px] → rounded-rp-card is pixel-identical. Change a value
        // here and every migrated page follows.
        'rp-card': '14px', // cards, panels, empty states (153 uses today)
        'rp-panel': '12px', // nested panels (51)
        'rp-btn': '10px', // buttons (75)
        'rp-ctrl': '9px', // inputs, chips, small controls (282 — most common)
        'rp-sm': '8px', // (184)
        'rp-xs': '7px', // (135)
      },
      boxShadow: {
        // The card elevation, currently inlined as a literal 106 times.
        'rp-card': '0 1px 6px rgba(0,0,0,0.04)',
        'rp-pop': '0 4px 24px rgba(24,49,83,0.12)',
        'rp-sheet': '-8px 0 40px rgba(24,49,83,0.15)',
      },
      fontSize: {
        // Semantic type roles, mapped to the exact px sizes in use today.
        'rp-title': '26px', // page title (43 uses)
        'rp-heading': '22px', // section heading (19)
        'rp-body': '13px', // default body text (561 — dominant)
        'rp-meta': '12px', // secondary / meta text (201)
        'rp-label': '11.5px', // field labels (179)
        'rp-micro': '11px', // badges, timestamps (136)
        // Half-pixel steps below are almost certainly unintentional drift from
        // their neighbours. Preserved as-is so nothing shifts; collapsing them
        // into the roles above is a deliberate design decision, not a silent one.
        'rp-13-5': '13.5px', // (91)
        'rp-12-5': '12.5px', // (181)
        'rp-10-5': '10.5px', // (70)
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Nunito', 'system-ui', 'sans-serif'],
        bitcount: ['Bitcount Prop Single', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(7px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out both',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('tailwind-scrollbar-hide')],
};

export default config;
