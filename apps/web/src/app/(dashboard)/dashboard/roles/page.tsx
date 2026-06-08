'use client';

import { Crown, Briefcase, BarChart2, Bell, Megaphone, Code2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = [
  {
    key: 'OWNER',
    label: 'Owner',
    labelBn: 'মালিক',
    icon: Crown,
    color: 'text-resort-700',
    bg: 'bg-resort-50',
    border: 'border-resort-200',
    description: 'Full access to everything including billing',
  },
  {
    key: 'MANAGER',
    label: 'Manager',
    labelBn: 'ম্যানেজার',
    icon: Briefcase,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    description: 'Full access except billing',
  },
  {
    key: 'SHAREHOLDER',
    label: 'Shareholder',
    labelBn: 'শেয়ারহোল্ডার',
    icon: BarChart2,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    description: 'Read-only: dashboard, analytics, reports',
  },
  {
    key: 'RECEPTIONIST',
    label: 'Receptionist',
    labelBn: 'রিসেপশনিস্ট',
    icon: Bell,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    description: 'Front desk, bookings, check-in/out, guests',
  },
  {
    key: 'MARKETER',
    label: 'Marketer',
    labelBn: 'মার্কেটার',
    icon: Megaphone,
    color: 'text-pink-700',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    description: 'Website, CRM, campaigns, offers',
  },
  {
    key: 'DEVELOPER',
    label: 'Developer',
    labelBn: 'ডেভেলপার',
    icon: Code2,
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    description: 'Website, embed, settings, channel sync',
  },
  {
    key: 'STAFF',
    label: 'Staff',
    labelBn: 'স্টাফ',
    icon: Users,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    description: 'Housekeeping, maintenance, restaurant',
  },
] as const;

type RoleKey = typeof ROLES[number]['key'];

// ✅ = full access  |  👁 = view only  |  ❌ = no access
type AccessLevel = '✅' | '👁' | '❌';

interface AccessRow {
  section: string;
  pages: { label: string; access: Record<RoleKey, AccessLevel> }[];
}

const ACCESS_MATRIX: AccessRow[] = [
  {
    section: 'Overview',
    pages: [
      {
        label: 'Dashboard',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '✅', RECEPTIONIST: '✅', MARKETER: '✅', DEVELOPER: '✅', STAFF: '✅' },
      },
      {
        label: 'Analytics',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '👁', RECEPTIONIST: '❌', MARKETER: '✅', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Invoices',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '👁', RECEPTIONIST: '👁', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Expenses',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '👁', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Daily Reports',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '👁', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
    ],
  },
  {
    section: 'Rooms & Bookings',
    pages: [
      {
        label: 'Rooms & Villas',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '👁' },
      },
      {
        label: 'Rate Plans',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '👁', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Packages',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '✅', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Front Desk',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Bookings',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '👁', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Booking Calendar',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Group Bookings',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Channel Sync',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '✅', STAFF: '❌' },
      },
    ],
  },
  {
    section: 'Guests',
    pages: [
      {
        label: 'Guests',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '✅', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Loyalty Program',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '✅', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Support Tickets',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '✅' },
      },
    ],
  },
  {
    section: 'Operations',
    pages: [
      {
        label: 'Staff Management',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Housekeeping',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '✅' },
      },
      {
        label: 'Maintenance',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '❌', STAFF: '✅' },
      },
    ],
  },
  {
    section: 'Restaurant',
    pages: [
      {
        label: 'Restaurant',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '❌', STAFF: '✅' },
      },
      {
        label: 'F&B Orders',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '✅', MARKETER: '❌', DEVELOPER: '❌', STAFF: '✅' },
      },
      {
        label: 'Inventory',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '❌', STAFF: '✅' },
      },
    ],
  },
  {
    section: 'Marketing',
    pages: [
      {
        label: 'Offers & Promotions',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '✅', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'CRM & Email',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '✅', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'SMS Marketing',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '✅', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Website',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '✅', DEVELOPER: '✅', STAFF: '❌' },
      },
    ],
  },
  {
    section: 'Account',
    pages: [
      {
        label: 'Billing',
        access: { OWNER: '✅', MANAGER: '❌', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '❌', STAFF: '❌' },
      },
      {
        label: 'Settings',
        access: { OWNER: '✅', MANAGER: '✅', SHAREHOLDER: '❌', RECEPTIONIST: '❌', MARKETER: '❌', DEVELOPER: '✅', STAFF: '❌' },
      },
    ],
  },
];

const LEVEL_CONFIG: Record<AccessLevel, { cls: string; label: string }> = {
  '✅': { cls: 'bg-green-50 text-green-600',  label: 'Full' },
  '👁': { cls: 'bg-amber-50 text-amber-600',  label: 'View' },
  '❌': { cls: 'bg-gray-50 text-gray-300',    label: '—' },
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RolesPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Who can access what — a complete view of permissions for each role
        </p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {ROLES.map(role => {
          const Icon = role.icon;
          return (
            <div key={role.key}
              className={cn('rounded-xl border p-3 text-center', role.bg, role.border)}>
              <div className={cn('mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/60')}>
                <Icon className={cn('h-4 w-4', role.color)} />
              </div>
              <p className={cn('text-xs font-bold', role.color)}>{role.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{role.labelBn}</p>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">{role.description}</p>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-500 font-medium">Legend:</span>
        {Object.entries(LEVEL_CONFIG).map(([level, { cls, label }]) => (
          <span key={level} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium', cls)}>
            {level} {label}
          </span>
        ))}
      </div>

      {/* Access matrix table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 min-w-[160px]">
                Page / Feature
              </th>
              {ROLES.map(role => {
                const Icon = role.icon;
                return (
                  <th key={role.key} className="px-3 py-3 text-center font-medium text-gray-600 dark:text-gray-400 min-w-[80px]">
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={cn('h-3.5 w-3.5', role.color)} />
                      <span>{role.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ACCESS_MATRIX.map((row, ri) => (
              <>
                {/* Section header row */}
                <tr key={`section-${ri}`} className="border-b border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-800/20">
                  <td colSpan={ROLES.length + 1}
                    className="sticky left-0 bg-gray-50/60 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:bg-gray-800/20">
                    {row.section}
                  </td>
                </tr>
                {/* Page rows */}
                {row.pages.map((page, pi) => (
                  <tr key={`${ri}-${pi}`}
                    className={cn(
                      'border-b border-gray-100 transition-colors hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-800/30',
                      pi === row.pages.length - 1 && 'border-b-0',
                    )}>
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                      {page.label}
                    </td>
                    {ROLES.map(role => {
                      const level = page.access[role.key];
                      const cfg   = LEVEL_CONFIG[level];
                      return (
                        <td key={role.key} className="px-3 py-2.5 text-center">
                          <span className={cn('inline-flex h-6 w-10 items-center justify-center rounded-md text-sm font-medium', cfg.cls)}>
                            {level}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
        <p className="font-semibold mb-1">Notes</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li><strong>Shareholder</strong> (formerly "Partner") — read-only access for investors & co-owners. Cannot create, edit, or delete anything.</li>
          <li><strong>View (👁)</strong> means read-only — the page is accessible but create/edit/delete actions are hidden or disabled.</li>
          <li>Staff invite is done from <strong>Settings → Staff</strong> page (OWNER & MANAGER only).</li>
        </ul>
      </div>
    </div>
  );
}
