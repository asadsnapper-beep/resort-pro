import Link from 'next/link';
import {
  BookOpen, Users, Code2, Globe, LifeBuoy,
  ChevronRight, ArrowRight, Zap, Shield, MessageSquare,
  BedDouble, CalendarCheck, Calendar, Sparkles, UtensilsCrossed,
  Wrench, Users2, Tag, BarChart3, TrendingUp, Receipt,
  Star, Gift, UserCircle, Mail, Radio, Settings,
} from 'lucide-react';

// ─── Guide data ───────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    label: 'Getting Started',
    guides: [
      {
        href: '/docs/user-roles',
        icon: Users,
        color: 'bg-violet-50 text-violet-600 border-violet-100',
        tag: 'Account', tagColor: 'bg-violet-100 text-violet-700',
        title: 'User Roles & Permissions',
        desc: 'Learn about the 7 roles — Owner, Manager, Receptionist, Partner, Marketer, Developer, and Staff — and who should get which role.',
        time: '5 min',
      },
      {
        href: '/docs/settings',
        icon: Settings,
        color: 'bg-gray-100 text-gray-600 border-gray-200',
        tag: 'Settings', tagColor: 'bg-gray-100 text-gray-700',
        title: 'Dashboard Settings',
        desc: 'Set up your property info, branding, email notifications, and payment gateways in one place.',
        time: '5 min',
      },
    ],
  },
  {
    label: 'Daily Operations',
    guides: [
      {
        href: '/docs/rooms',
        icon: BedDouble,
        color: 'bg-green-50 text-green-600 border-green-100',
        tag: 'Rooms', tagColor: 'bg-green-100 text-green-700',
        title: 'Managing Rooms',
        desc: 'Add room types, upload photos, set amenities, and manage room status — Available, Occupied, or Maintenance.',
        time: '6 min',
      },
      {
        href: '/docs/bookings',
        icon: CalendarCheck,
        color: 'bg-blue-50 text-blue-600 border-blue-100',
        tag: 'Bookings', tagColor: 'bg-blue-100 text-blue-700',
        title: 'Bookings & Check-in',
        desc: 'Create bookings, process check-in and check-out, understand booking statuses, and handle cancellations.',
        time: '7 min',
      },
      {
        href: '/docs/calendar',
        icon: Calendar,
        color: 'bg-sky-50 text-sky-600 border-sky-100',
        tag: 'Calendar', tagColor: 'bg-sky-100 text-sky-700',
        title: 'Availability Calendar',
        desc: 'Read the availability calendar, block dates, and sync with Airbnb, Booking.com, and Google Calendar.',
        time: '5 min',
      },
      {
        href: '/docs/housekeeping',
        icon: Sparkles,
        color: 'bg-teal-50 text-teal-600 border-teal-100',
        tag: 'Housekeeping', tagColor: 'bg-teal-100 text-teal-700',
        title: 'Housekeeping',
        desc: 'Assign cleaning tasks to staff, track task status, and keep rooms ready for every guest arrival.',
        time: '5 min',
      },
      {
        href: '/docs/restaurant',
        icon: UtensilsCrossed,
        color: 'bg-orange-50 text-orange-600 border-orange-100',
        tag: 'Restaurant', tagColor: 'bg-orange-100 text-orange-700',
        title: 'Restaurant & Food Orders',
        desc: 'Set up your menu, take food orders, manage the kitchen queue, and bill food to the guest\'s room.',
        time: '6 min',
      },
      {
        href: '/docs/maintenance',
        icon: Wrench,
        color: 'bg-sky-50 text-sky-600 border-sky-100',
        tag: 'Maintenance', tagColor: 'bg-sky-100 text-sky-700',
        title: 'Maintenance Tasks',
        desc: 'Log repair issues, set priority levels, assign to staff, and track every task to completion.',
        time: '4 min',
      },
      {
        href: '/docs/group-bookings',
        icon: Users2,
        color: 'bg-violet-50 text-violet-600 border-violet-100',
        tag: 'Groups', tagColor: 'bg-violet-100 text-violet-700',
        title: 'Group Bookings',
        desc: 'Handle weddings, corporate retreats, and tour groups — multiple rooms, one reservation, flexible billing.',
        time: '5 min',
      },
    ],
  },
  {
    label: 'Revenue & Finance',
    guides: [
      {
        href: '/docs/rate-plans',
        icon: Tag,
        color: 'bg-amber-50 text-amber-600 border-amber-100',
        tag: 'Pricing', tagColor: 'bg-amber-100 text-amber-700',
        title: 'Rate Plans & Pricing',
        desc: 'Create seasonal rates, set meal plan inclusions, apply advance booking discounts, and define cancellation policies.',
        time: '6 min',
      },
      {
        href: '/docs/reports',
        icon: BarChart3,
        color: 'bg-green-50 text-green-600 border-green-100',
        tag: 'Reports', tagColor: 'bg-green-100 text-green-700',
        title: 'Reports',
        desc: 'Understand your revenue breakdown, occupancy rate, ADR, RevPAR, and booking source data. Export to Excel or PDF.',
        time: '6 min',
      },
      {
        href: '/docs/analytics',
        icon: TrendingUp,
        color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        tag: 'Analytics', tagColor: 'bg-indigo-100 text-indigo-700',
        title: 'Analytics Dashboard',
        desc: 'Monitor live occupancy, today\'s revenue, arrivals, departures, and set monthly performance goals.',
        time: '5 min',
      },
      {
        href: '/docs/packages',
        icon: Gift,
        color: 'bg-rose-50 text-rose-600 border-rose-100',
        tag: 'Packages', tagColor: 'bg-rose-100 text-rose-700',
        title: 'Packages & Deals',
        desc: 'Create honeymoon escapes, family fun packs, and festival deals — boost your average booking value.',
        time: '5 min',
      },
      {
        href: '/docs/loyalty',
        icon: Star,
        color: 'bg-amber-50 text-amber-600 border-amber-100',
        tag: 'Loyalty', tagColor: 'bg-amber-100 text-amber-700',
        title: 'Loyalty Programme',
        desc: 'Reward returning guests with points and membership tiers — Bronze, Silver, Gold — to build lasting loyalty.',
        time: '5 min',
      },
      {
        href: '/docs/inventory',
        icon: Receipt,
        color: 'bg-orange-50 text-orange-600 border-orange-100',
        tag: 'Inventory', tagColor: 'bg-orange-100 text-orange-700',
        title: 'Inventory Management',
        desc: 'Track supplies from housekeeping to kitchen, set reorder alerts, and never run out of essentials.',
        time: '5 min',
      },
      {
        href: '/docs/expenses',
        icon: Receipt,
        color: 'bg-green-50 text-green-600 border-green-100',
        tag: 'Finance', tagColor: 'bg-green-100 text-green-700',
        title: 'Expense Tracking',
        desc: 'Log every cost your resort incurs, categorise by department, and get a monthly summary for your accountant.',
        time: '4 min',
      },
    ],
  },
  {
    label: 'Marketing & Guests',
    guides: [
      {
        href: '/docs/guests',
        icon: UserCircle,
        color: 'bg-violet-50 text-violet-600 border-violet-100',
        tag: 'Guests', tagColor: 'bg-violet-100 text-violet-700',
        title: 'Guest Management',
        desc: 'Build detailed guest profiles, track stay history, add VIP tags, and keep notes about preferences.',
        time: '5 min',
      },
      {
        href: '/docs/crm',
        icon: Mail,
        color: 'bg-pink-50 text-pink-600 border-pink-100',
        tag: 'CRM', tagColor: 'bg-pink-100 text-pink-700',
        title: 'CRM & Email Campaigns',
        desc: 'Send targeted email campaigns, set up pre-arrival and post-stay automations, and grow repeat bookings.',
        time: '6 min',
      },
      {
        href: '/docs/website',
        icon: Globe,
        color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        tag: 'Website', tagColor: 'bg-indigo-100 text-indigo-700',
        title: 'Website Builder',
        desc: 'Customise your free public website — hero image, room listings, gallery, testimonials, and contact details.',
        time: '7 min',
      },
    ],
  },
  {
    label: 'Integrations',
    guides: [
      {
        href: '/docs/channels',
        icon: Radio,
        color: 'bg-blue-50 text-blue-600 border-blue-100',
        tag: 'Channels', tagColor: 'bg-blue-100 text-blue-700',
        title: 'Channel Manager',
        desc: 'Connect to Airbnb, Booking.com, Expedia, and more via iCal. Keep availability synced and stop double-bookings.',
        time: '5 min',
      },
      {
        href: '/docs/embed-widget',
        icon: Code2,
        color: 'bg-blue-50 text-blue-600 border-blue-100',
        tag: 'Integration', tagColor: 'bg-blue-100 text-blue-700',
        title: 'Embed Booking Widget',
        desc: 'Add a live booking form, room listing, availability calendar, and food menu to any website — no coding needed.',
        time: '8 min',
      },
    ],
  },
];

// ─── Quick links ──────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { href: '/docs/rooms#how-to-add-a-room',                              label: 'How to add a new room' },
  { href: '/docs/bookings#creating-a-new-booking',                      label: 'How to create a booking' },
  { href: '/docs/bookings#check-in-and-check-out',                      label: 'How to check in a guest' },
  { href: '/docs/user-roles#how-to-invite-a-team-member',               label: 'How to invite a team member' },
  { href: '/docs/rate-plans#creating-a-rate-plan',                      label: 'How to set up rate plans' },
  { href: '/docs/channels#connecting-via-ical',                         label: 'How to sync with Airbnb / Booking.com' },
  { href: '/docs/website#customizing-your-homepage',                    label: 'How to build my public website' },
  { href: '/docs/embed-widget#3-add-the-script-tag',                    label: 'How to add the booking widget to my site' },
  { href: '/docs/loyalty#how-guests-earn-points',                       label: 'How to set up a loyalty programme' },
  { href: '/docs/crm#sending-email-campaigns',                          label: 'How to run email campaigns' },
  { href: '/docs/reports#revenue-report',                               label: 'How to view revenue reports' },
  { href: '/docs/settings#payment-gateway-setup',                       label: 'How to configure payment gateways' },
];

const HIGHLIGHTS = [
  { icon: Zap,           label: 'Quick setup',       sub: 'Add a booking widget to your site in under 10 minutes' },
  { icon: Shield,        label: 'Role-based access',  sub: 'Your team only sees what they need to do their job' },
  { icon: MessageSquare, label: 'Always there',       sub: 'Open a support ticket anytime from inside the dashboard' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function DocsLandingPage() {
  return (
    <>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a6b5e] text-sm font-bold text-[#d4a853]">R</div>
            <span className="font-semibold text-gray-900">ResortPro</span>
            <span className="hidden text-gray-300 sm:block">/</span>
            <span className="hidden text-sm text-gray-500 sm:block">Help Center</span>
          </Link>
          <Link href="/dashboard" className="rounded-lg bg-[#1a6b5e] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#145a4f]">
            Go to Dashboard
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-white py-14 text-center">
        <div className="mx-auto max-w-2xl px-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1a6b5e]/20 bg-[#f0faf8] px-3 py-1 text-xs font-medium text-[#1a6b5e]">
            <BookOpen className="h-3.5 w-3.5" />
            Resort Owner Documentation
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">How can we help?</h1>
          <p className="text-lg leading-relaxed text-gray-500">
            Step-by-step guides for every feature in your ResortPro dashboard —<br className="hidden sm:block" />
            from adding your first room to syncing with Airbnb.
          </p>
        </div>
      </section>

      {/* ── Highlights strip ─────────────────────────────────────────────── */}
      <div className="border-y border-gray-200 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-gray-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {HIGHLIGHTS.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-4 px-8 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0faf8] text-[#1a6b5e]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-5 py-12 space-y-14">

        {/* ── Guide sections ───────────────────────────────────────────────── */}
        {SECTIONS.map((section) => (
          <section key={section.label}>
            <h2 className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              {section.label}
              <span className="h-px flex-1 bg-gray-200" />
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.guides.map((g) => {
                const Icon = g.icon;
                return (
                  <Link
                    key={g.href}
                    href={g.href}
                    className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-[#1a6b5e]/40 hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${g.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${g.tagColor}`}>{g.tag}</span>
                    </div>
                    <h3 className="mb-1.5 text-sm font-semibold text-gray-900 group-hover:text-[#1a6b5e]">{g.title}</h3>
                    <p className="flex-1 text-xs leading-relaxed text-gray-500">{g.desc}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-400">{g.time} read</span>
                      <span className="flex items-center gap-1 text-xs font-medium text-[#1a6b5e] opacity-0 transition-opacity group-hover:opacity-100">
                        Read <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {/* ── Quick links ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            Quick Answers
            <span className="h-px flex-1 bg-gray-200" />
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:border-[#1a6b5e]/40 hover:text-[#1a6b5e]"
              >
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-[#1a6b5e]" />
                {l.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ── Support CTA ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#1a6b5e]/20 bg-[#f0faf8] px-8 py-10 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a6b5e] text-white">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Still have questions?</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Open a support ticket directly from your dashboard — our team typically responds within a few hours.
              </p>
            </div>
            <Link href="/dashboard/support" className="shrink-0 rounded-xl bg-[#1a6b5e] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#145a4f]">
              Open a Ticket
            </Link>
          </div>
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="mt-8 border-t border-gray-200 bg-white py-8 text-center text-xs text-gray-400">
        <p>© {new Date().getFullYear()} ResortPro · All-in-one resort management platform</p>
        <p className="mt-1">
          <a href="mailto:support@resortpro.site" className="hover:text-[#1a6b5e]">support@resortpro.site</a>
        </p>
      </footer>
    </>
  );
}
