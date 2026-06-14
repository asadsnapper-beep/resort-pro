'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Crown, Briefcase, BarChart2, Bell, Megaphone, Code2, Users, UtensilsCrossed,
  Plus, Copy, Check, Trash2, ChevronDown, UserX, Clock, Mail,
} from 'lucide-react';

// ── Role definitions ──────────────────────────────────────────────────────────
const ROLES = [
  { key: 'OWNER',        label: 'Owner',        icon: Crown,           color: 'text-resort-700', bg: 'bg-resort-50',  border: 'border-resort-200',  description: 'Full access including billing' },
  { key: 'MANAGER',      label: 'Manager',      icon: Briefcase,       color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',    description: 'Full access except billing' },
  { key: 'SHAREHOLDER',  label: 'Shareholder',  icon: BarChart2,       color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',   description: 'Dashboard & analytics only' },
  { key: 'RECEPTIONIST', label: 'Receptionist', icon: Bell,            color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200',  description: 'Front desk, bookings, guests' },
  { key: 'MARKETER',     label: 'Marketer',     icon: Megaphone,       color: 'text-pink-700',   bg: 'bg-pink-50',    border: 'border-pink-200',    description: 'Website, CRM, campaigns' },
  { key: 'DEVELOPER',    label: 'Developer',    icon: Code2,           color: 'text-gray-700',   bg: 'bg-gray-100',   border: 'border-gray-300',    description: 'Website, embed, settings' },
  { key: 'STAFF',        label: 'Staff',        icon: Users,           color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200',  description: 'Housekeeping only' },
  { key: 'CHEF',         label: 'Chef',         icon: UtensilsCrossed, color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',     description: 'F&B Orders view & status' },
] as const;

type RoleKey = typeof ROLES[number]['key'];
type InvitableRole = Exclude<RoleKey, 'OWNER'>;

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.key, r])) as Record<RoleKey, typeof ROLES[number]>;

const INVITABLE_ROLES: InvitableRole[] = ['MANAGER','SHAREHOLDER','RECEPTIONIST','MARKETER','DEVELOPER','STAFF','CHEF'];

// ── Access matrix ─────────────────────────────────────────────────────────────
type AccessLevel = '✅' | '👁' | '❌';
interface AccessRow { section: string; pages: { label: string; access: Record<RoleKey, AccessLevel> }[] }

const ACCESS_MATRIX: AccessRow[] = [
  { section: 'Overview', pages: [
    { label: 'Dashboard',     access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'✅', RECEPTIONIST:'✅', MARKETER:'✅', DEVELOPER:'✅', STAFF:'✅', CHEF:'✅' } },
    { label: 'Analytics',     access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'👁', RECEPTIONIST:'❌', MARKETER:'✅', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Invoices',      access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Expenses',      access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Daily Reports', access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
  ]},
  { section: 'Rooms & Bookings', pages: [
    { label: 'Rooms & Villas',    access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'✅', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Front Desk',        access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'✅', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Bookings',          access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'✅', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Channel Sync',      access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'✅', STAFF:'❌', CHEF:'❌' } },
  ]},
  { section: 'Guests', pages: [
    { label: 'Guests',          access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'✅', MARKETER:'✅', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Support Tickets', access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'✅', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
  ]},
  { section: 'Operations', pages: [
    { label: 'Housekeeping', access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'✅', MARKETER:'❌', DEVELOPER:'❌', STAFF:'✅', CHEF:'❌' } },
    { label: 'Maintenance',  access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Inventory',    access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
  ]},
  { section: 'Restaurant', pages: [
    { label: 'Restaurant', access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'F&B Orders', access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'✅', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'✅' } },
  ]},
  { section: 'Marketing', pages: [
    { label: 'Offers & Promotions', access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'✅', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'CRM & Email',         access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'✅', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Website',             access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'✅', DEVELOPER:'✅', STAFF:'❌', CHEF:'❌' } },
  ]},
  { section: 'Account', pages: [
    { label: 'Billing',   access: { OWNER:'✅', MANAGER:'❌', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'❌', STAFF:'❌', CHEF:'❌' } },
    { label: 'Settings',  access: { OWNER:'✅', MANAGER:'✅', SHAREHOLDER:'❌', RECEPTIONIST:'❌', MARKETER:'❌', DEVELOPER:'✅', STAFF:'❌', CHEF:'❌' } },
  ]},
];

const LEVEL_CONFIG: Record<AccessLevel, { cls: string; label: string }> = {
  '✅': { cls: 'bg-green-50 text-green-600', label: 'Full' },
  '👁': { cls: 'bg-amber-50 text-amber-600', label: 'View' },
  '❌': { cls: 'bg-gray-50 text-gray-300', label: '—' },
};

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('RECEPTIONIST');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => tenantApi.inviteMember({ email, role }),
    onSuccess: (res) => {
      const link = res?.data?.data?.inviteLink;
      setInviteLink(link ?? '');
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast({ title: 'Invite link created!' });
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to create invite', variant: 'destructive' }),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setEmail(''); setRole('RECEPTIONIST'); setInviteLink(''); setCopied(false);
    onClose();
  };

  const selectedRole = ROLE_MAP[role];

  return (
    <Modal open={open} onClose={handleClose} title="Invite Team Member"
      description="Generate an invite link to share with your new team member" className="max-w-md">
      {!inviteLink ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email"
              placeholder="staff@example.com" autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
            <select value={role} onChange={e => setRole(e.target.value as InvitableRole)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {INVITABLE_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_MAP[r].label}</option>
              ))}
            </select>
            {selectedRole && (
              <p className="mt-1.5 text-xs text-muted-foreground">{selectedRole.description}</p>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}
              disabled={!email || !role} className="gap-2">
              <Mail className="h-4 w-4" /> Generate Invite Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            ✅ Invite link created for <strong>{email}</strong> as <strong>{ROLE_MAP[role].label}</strong>. Expires in 7 days.
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Share this link</label>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="text-xs font-mono" />
              <Button variant="outline" className="shrink-0 gap-1.5" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => { setInviteLink(''); setEmail(''); setRole('RECEPTIONIST'); }}>
              Invite Another
            </Button>
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Role change dropdown ──────────────────────────────────────────────────────
function RoleDropdown({ userId, currentRole, onChange, disabled }: {
  userId: string; currentRole: RoleKey; onChange: (role: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cfg = ROLE_MAP[currentRole];

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
          cfg.bg, cfg.color, cfg.border, 'border',
          !disabled && 'hover:opacity-80 cursor-pointer',
          disabled && 'cursor-default opacity-60',
        )}>
        <cfg.icon className="h-3 w-3" />
        {cfg.label}
        {!disabled && <ChevronDown className="h-3 w-3 opacity-50" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border bg-white shadow-lg py-1">
            {INVITABLE_ROLES.map(r => {
              const rc = ROLE_MAP[r];
              return (
                <button key={r} onClick={() => { onChange(r); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors',
                    r === currentRole && 'bg-gray-50 font-semibold',
                  )}>
                  <rc.icon className={cn('h-3.5 w-3.5', rc.color)} />
                  <span>{rc.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Team tab ──────────────────────────────────────────────────────────────────
function TeamTab({ isOwner }: { isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => tenantApi.getTeam(),
  });

  const members = data?.data?.data?.members ?? [];
  const pendingInvites = data?.data?.data?.pendingInvites ?? [];

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => tenantApi.changeMemberRole(userId, role),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team'] }); toast({ title: 'Role updated' }); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to update role', variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => tenantApi.removeMember(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team'] }); toast({ title: 'Member removed' }); setConfirmRemove(null); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to remove', variant: 'destructive' }),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) => tenantApi.cancelInvite(inviteId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team'] }); toast({ title: 'Invite cancelled' }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''} in your team</p>
        </div>
        {isOwner && (
          <Button className="gap-2" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Members list */}
      <div className="rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-50 animate-pulse border-b" />)}</div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No team members yet</div>
        ) : (
          <div className="divide-y">
            {members.map((m: {
              id: string; firstName: string; lastName: string; email: string;
              role: RoleKey; isSelf: boolean; isActive: boolean; lastLoginAt: string | null; createdAt: string;
            }) => {
              const cfg = ROLE_MAP[m.role] ?? ROLE_MAP['STAFF'];
              const isOwnerRole = m.role === 'OWNER';
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', cfg.bg, cfg.color)}>
                    {m.firstName[0]}{m.lastName[0]}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.firstName} {m.lastName}
                      {m.isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  {/* Last login */}
                  <div className="hidden sm:block text-xs text-muted-foreground text-right shrink-0">
                    {m.lastLoginAt
                      ? new Date(m.lastLoginAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Never logged in'}
                  </div>
                  {/* Role badge / dropdown */}
                  <div className="shrink-0">
                    {isOwner && !isOwnerRole && !m.isSelf ? (
                      <RoleDropdown
                        userId={m.id}
                        currentRole={m.role}
                        onChange={(role) => roleMutation.mutate({ userId: m.id, role })}
                        disabled={roleMutation.isPending}
                      />
                    ) : (
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border', cfg.bg, cfg.color, cfg.border)}>
                        <cfg.icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    )}
                  </div>
                  {/* Remove button */}
                  {isOwner && !isOwnerRole && !m.isSelf && (
                    <button
                      onClick={() => setConfirmRemove({ id: m.id, name: `${m.firstName} ${m.lastName}` })}
                      className="ml-1 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" /> Pending Invites ({pendingInvites.length})
          </h3>
          <div className="rounded-xl border overflow-hidden divide-y">
            {pendingInvites.map((inv: { id: string; email: string; role: RoleKey; expiresAt: string }) => {
              const cfg = ROLE_MAP[inv.role] ?? ROLE_MAP['STAFF'];
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(inv.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border', cfg.bg, cfg.color, cfg.border)}>
                    <cfg.icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                  {isOwner && (
                    <button
                      onClick={() => cancelInviteMutation.mutate(inv.id)}
                      className="ml-1 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite modal */}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {/* Confirm remove modal */}
      <Modal open={!!confirmRemove} onClose={() => setConfirmRemove(null)} title="Remove Team Member"
        description={`Are you sure you want to remove ${confirmRemove?.name}? They will lose access immediately.`}
        className="max-w-sm">
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" onClick={() => setConfirmRemove(null)}>Cancel</Button>
          <Button variant="destructive" loading={removeMutation.isPending}
            onClick={() => confirmRemove && removeMutation.mutate(confirmRemove.id)}
            className="gap-2"><Trash2 className="h-4 w-4" /> Remove</Button>
        </div>
      </Modal>
    </div>
  );
}

// ── Permissions tab ───────────────────────────────────────────────────────────
function PermissionsTab() {
  return (
    <div className="space-y-6">
      {/* Role cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {ROLES.map(role => {
          const Icon = role.icon;
          return (
            <div key={role.key} className={cn('rounded-xl border p-3 text-center', role.bg, role.border)}>
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/60">
                <Icon className={cn('h-4 w-4', role.color)} />
              </div>
              <p className={cn('text-xs font-bold', role.color)}>{role.label}</p>
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

      {/* Access matrix */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 min-w-[150px]">
                Page / Feature
              </th>
              {ROLES.map(role => (
                <th key={role.key} className="px-3 py-3 text-center font-medium text-gray-600 min-w-[70px]">
                  <div className="flex flex-col items-center gap-1">
                    <role.icon className={cn('h-3.5 w-3.5', role.color)} />
                    <span>{role.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACCESS_MATRIX.map((row, ri) => (
              <>
                <tr key={`s-${ri}`} className="border-b border-gray-100 bg-gray-50/60">
                  <td colSpan={ROLES.length + 1} className="sticky left-0 bg-gray-50/60 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {row.section}
                  </td>
                </tr>
                {row.pages.map((page, pi) => (
                  <tr key={`${ri}-${pi}`} className="border-b border-gray-100 transition-colors hover:bg-gray-50/80">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-gray-700">{page.label}</td>
                    {ROLES.map(role => {
                      const level = page.access[role.key];
                      const cfg = LEVEL_CONFIG[level];
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
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';
  const [tab, setTab] = useState<'team' | 'permissions'>('team');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles & Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your team members and their permissions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {([['team', 'Team Members'], ['permissions', 'Permissions']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'team' ? <TeamTab isOwner={isOwner} /> : <PermissionsTab />}
    </div>
  );
}
