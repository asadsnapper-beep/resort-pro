'use client';

import { useEffect, useState } from 'react';
import { adminEndpoints } from '@/lib/admin-api';
import { useAdminStore } from '@/store/admin';
import { toast } from '@/hooks/use-toast';
import {
  Users, Loader2, Shield, Eye, DollarSign, Headphones,
  Plus, Pencil, Trash2, CheckCircle2, XCircle, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'FINANCE' | 'VIEWER';

interface AdminMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  invitedBy: string | null;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<AdminRole, {
  label: string;
  color: string;
  bg: string;
  icon: React.ElementType;
  description: string;
  permissions: string[];
}> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/15 border-indigo-500/30',
    icon: Shield,
    description: 'Full access — all actions, all pages',
    permissions: ['All tenant management', 'Impersonate', 'Delete/suspend', 'Settings', 'Team management'],
  },
  SUPPORT: {
    label: 'Support',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/15 border-cyan-500/30',
    icon: Headphones,
    description: 'Tenant support + read access',
    permissions: ['View all tenants', 'Extend trials', 'Impersonate (read-only)', 'View audit log'],
  },
  FINANCE: {
    label: 'Finance',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    icon: DollarSign,
    description: 'Billing, MRR, and CSV exports',
    permissions: ['Billing & MRR page', 'CSV exports', 'Revenue analytics', 'View tenants (read-only)'],
  },
  VIEWER: {
    label: 'Viewer',
    color: 'text-gray-400',
    bg: 'bg-gray-700/50 border-gray-600/30',
    icon: Eye,
    description: 'Read-only access to all pages',
    permissions: ['View dashboard, tenants, users', 'No write actions'],
  },
};

function timeAgo(iso: string | null) {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────

interface ModalProps {
  member?: AdminMember | null;
  onClose: () => void;
  onSave: () => void;
}

function AdminUserModal({ member, onClose, onSave }: ModalProps) {
  const isEdit = !!member;
  const [email, setEmail] = useState(member?.email ?? '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState(member?.firstName ?? '');
  const [lastName, setLastName] = useState(member?.lastName ?? '');
  const [role, setRole] = useState<AdminRole>(member?.role ?? 'VIEWER');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await adminEndpoints.updateTeamMember(member!.id, { role, firstName, lastName });
        toast({ title: 'Admin updated', description: `${email} is now ${ROLE_CONFIG[role].label}` });
      } else {
        await adminEndpoints.createTeamMember({ email, password, role, firstName, lastName });
        toast({ title: 'Admin created', description: `${email} can now log into the admin panel` });
      }
      onSave();
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">{isEdit ? 'Edit Admin' : 'Add Admin User'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">First name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Last name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="w-full h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              required
              placeholder="jane@company.com"
              className="w-full h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Password — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
                className="w-full h-9 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Role picker */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_CONFIG) as AdminRole[]).map((r) => {
                const cfg = ROLE_CONFIG[r];
                const Icon = cfg.icon;
                const selected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                      selected ? cfg.bg : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', selected ? cfg.color : 'text-gray-500')} />
                    <div>
                      <p className={cn('text-xs font-semibold', selected ? cfg.color : 'text-gray-400')}>{cfg.label}</p>
                      <p className="text-[10px] text-gray-600 leading-tight mt-0.5">{cfg.description.split('—')[0].trim()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Permission list for selected role */}
            <div className={cn('mt-2 px-3 py-2 rounded-lg border text-xs', ROLE_CONFIG[role].bg)}>
              <p className={cn('font-medium mb-1', ROLE_CONFIG[role].color)}>Permissions:</p>
              <ul className="space-y-0.5">
                {ROLE_CONFIG[role].permissions.map((p) => (
                  <li key={p} className="text-gray-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-gray-600 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { admin: currentAdmin } = useAdminStore();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; member: AdminMember | null }>({ open: false, member: null });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = () => {
    adminEndpoints.getTeam()
      .then((r) => setMembers(r.data.data))
      .catch(() => toast({ title: 'Failed to load team', variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (m: AdminMember) => {
    if (m.email === currentAdmin?.email) {
      toast({ title: 'Cannot deactivate your own account', variant: 'destructive' });
      return;
    }
    setTogglingId(m.id);
    try {
      await adminEndpoints.updateTeamMember(m.id, { isActive: !m.isActive });
      toast({ title: m.isActive ? 'Account deactivated' : 'Account reactivated' });
      load();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error || 'Failed', variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Team</h1>
          <p className="text-gray-500 text-sm mt-1">Manage who can access the admin panel and what they can do</p>
        </div>
        <button
          onClick={() => setModal({ open: true, member: null })}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Admin
        </button>
      </div>

      {/* Role reference cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(ROLE_CONFIG) as AdminRole[]).map((role) => {
          const cfg = ROLE_CONFIG[role];
          const Icon = cfg.icon;
          const count = members.filter((m) => m.role === role && m.isActive).length;
          return (
            <div key={role} className={cn('rounded-xl border px-4 py-3', cfg.bg)}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', cfg.color)} />
                <p className={cn('text-sm font-semibold', cfg.color)}>{cfg.label}</p>
                <span className="ml-auto text-xs text-gray-500">{count} active</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{cfg.description}</p>
            </div>
          );
        })}
      </div>

      {/* Members table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Members</h2>
          <span className="text-xs text-gray-500">{members.length} total · {members.filter((m) => m.isActive).length} active</span>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-400 font-medium text-sm">No admin users yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Admin</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Last Login</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Invited By</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {members.map((m) => {
                const cfg = ROLE_CONFIG[m.role];
                const Icon = cfg.icon;
                const isSelf = m.email === currentAdmin?.email;
                return (
                  <tr key={m.id} className={cn('transition-colors', m.isActive ? 'hover:bg-gray-800/40' : 'opacity-50')}>
                    {/* Avatar + email */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 uppercase shrink-0">
                          {m.firstName?.[0] || m.email[0]}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {m.firstName || m.lastName ? `${m.firstName} ${m.lastName}`.trim() : m.email}
                          </p>
                          <p className="text-gray-600 text-xs">{m.email}</p>
                        </div>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-medium">
                            you
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-4">
                      <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium', cfg.bg, cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </div>
                    </td>

                    {/* Active status */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        {m.isActive
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : <XCircle className="w-3.5 h-3.5 text-gray-600" />
                        }
                        <span className={cn('text-xs', m.isActive ? 'text-emerald-400' : 'text-gray-600')}>
                          {m.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>

                    {/* Last login */}
                    <td className="px-4 py-4 text-gray-500 text-xs">{timeAgo(m.lastLoginAt)}</td>

                    {/* Invited by */}
                    <td className="px-4 py-4 text-gray-600 text-xs truncate max-w-[140px]">
                      {m.invitedBy ?? '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModal({ open: true, member: m })}
                          title="Edit"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => toggleActive(m)}
                            disabled={togglingId === m.id}
                            title={m.isActive ? 'Deactivate' : 'Reactivate'}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              m.isActive
                                ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                            )}
                          >
                            {togglingId === m.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : m.isActive ? <Trash2 className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <AdminUserModal
          member={modal.member}
          onClose={() => setModal({ open: false, member: null })}
          onSave={load}
        />
      )}
    </div>
  );
}
