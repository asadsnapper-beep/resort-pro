'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  User, Mail, Phone, Lock, Eye, EyeOff,
  CheckCircle2, Shield,
} from 'lucide-react';
import { ImageUpload } from '@/components/ui/ImageUpload';

// ─── Role badge config (mirrors sidebar) ──────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OWNER:        { label: 'Owner',        color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  MANAGER:      { label: 'Manager',      color: 'text-resort-700', bg: 'bg-resort-50 border-resort-200' },
  SHAREHOLDER:  { label: 'Shareholder',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  RECEPTIONIST: { label: 'Receptionist', color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
  MARKETER:     { label: 'Marketer',     color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  DEVELOPER:    { label: 'Developer',    color: 'text-gray-700',   bg: 'bg-gray-100 border-gray-200' },
  STAFF:        { label: 'Staff',        color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  GUEST:        { label: 'Guest',        color: 'text-gray-500',   bg: 'bg-gray-100 border-gray-200' },
};

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

// ─── Avatar color palette ─────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: 'bg-resort-600',  text: 'text-white', id: 'resort' },
  { bg: 'bg-blue-600',    text: 'text-white', id: 'blue' },
  { bg: 'bg-purple-600',  text: 'text-white', id: 'purple' },
  { bg: 'bg-rose-500',    text: 'text-white', id: 'rose' },
  { bg: 'bg-amber-500',   text: 'text-white', id: 'amber' },
  { bg: 'bg-teal-600',    text: 'text-white', id: 'teal' },
];

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const role = user?.role ?? 'STAFF';
  const roleConf = ROLE_CONFIG[role] ?? ROLE_CONFIG.STAFF;

  // ── Profile form state ────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName,  setLastName]  = useState(user?.lastName ?? '');
  const [phone,     setPhone]     = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [avatarColor, setAvatarColor] = useState('resort');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Fetch fresh user data on mount (phone/avatarUrl not in JWT) ──────────
  useEffect(() => {
    authApi.me().then(res => {
      const fresh = res?.data?.data;
      if (!fresh) return;
      updateUser(fresh);
      setFirstName(fresh.firstName ?? '');
      setLastName(fresh.lastName ?? '');
      setPhone(fresh.phone ?? '');
      setAvatarUrl(fresh.avatarUrl ?? '');
    }).catch(() => { /* silently ignore — form already has store values */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Password form state ───────────────────────────────────────────────────
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [savingPwd,   setSavingPwd]   = useState(false);

  const initials = getInitials(firstName || user?.firstName || 'U', lastName || user?.lastName || '');
  const colorConf = AVATAR_COLORS.find(c => c.id === avatarColor) ?? AVATAR_COLORS[0];

  // Password strength
  const pwdChecks = {
    length:    newPwd.length >= 8,
    uppercase: /[A-Z]/.test(newPwd),
    number:    /[0-9]/.test(newPwd),
  };
  const pwdStrength = Object.values(pwdChecks).filter(Boolean).length;

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'Name required', description: 'First and last name cannot be empty.', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await authApi.updateProfile({
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        phone:     phone.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      updateUser(res.data.data);
      toast({ title: 'Profile updated ✓', description: 'Your changes have been saved.' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not update profile', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast({ title: 'All fields required', variant: 'destructive' });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (!pwdChecks.length || !pwdChecks.uppercase || !pwdChecks.number) {
      toast({ title: 'Password too weak', description: 'Must be 8+ characters with an uppercase letter and a number.', variant: 'destructive' });
      return;
    }
    setSavingPwd(true);
    try {
      await authApi.changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      toast({ title: 'Password changed ✓', description: 'You have been signed out on other devices.' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not change password', variant: 'destructive' });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your personal information and password</p>
      </div>

      {/* ── Avatar + identity card ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-5">

          {/* Avatar */}
          <div className="shrink-0">
            {avatarUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-20 w-20 rounded-2xl object-cover ring-4 ring-white shadow-md"
                  onError={() => setAvatarUrl('')}
                />
              </div>
            ) : (
              <div className={cn(
                'flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold shadow-md ring-4 ring-white',
                colorConf.bg, colorConf.text,
              )}>
                {initials}
              </div>
            )}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', roleConf.bg, roleConf.color)}>
                <Shield className="h-3 w-3" />
                {roleConf.label}
              </span>
            </div>
          </div>
        </div>

        {/* Avatar upload */}
        <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
          <ImageUpload
            value={avatarUrl || null}
            onChange={url => setAvatarUrl(url ?? '')}
            folder="profiles"
            label="Profile photo"
            hint="JPEG, PNG or WebP · max 5 MB · or paste a URL"
            aspectRatio="square"
            className="max-w-[140px]"
          />
          {!avatarUrl && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Or pick a color</p>
              <div className="flex gap-2">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setAvatarColor(c.id)}
                    className={cn(
                      'h-7 w-7 rounded-full transition-transform hover:scale-110',
                      c.bg,
                      avatarColor === c.id && 'ring-2 ring-offset-2 ring-gray-400 scale-110',
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Personal info form ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Personal Information</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">First name</label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Last name</label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <Input value={user?.email ?? ''} disabled className="pl-9 bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <p className="mt-1 text-xs text-gray-400">Email cannot be changed. Contact support if needed.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+880 1700 000000"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="bg-[#1a6b5e] hover:bg-[#145a4f] min-w-[120px]"
          >
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Change Password</h3>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Current password</label>
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Enter current password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">New password</label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Enter new password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password strength indicator */}
          {newPwd.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      i < pwdStrength
                        ? pwdStrength === 1 ? 'bg-red-400' : pwdStrength === 2 ? 'bg-amber-400' : 'bg-green-500'
                        : 'bg-gray-200',
                    )}
                  />
                ))}
              </div>
              <div className="space-y-0.5">
                {[
                  { check: pwdChecks.length,    label: 'At least 8 characters' },
                  { check: pwdChecks.uppercase, label: 'One uppercase letter' },
                  { check: pwdChecks.number,    label: 'One number' },
                ].map(({ check, label }) => (
                  <p key={label} className={cn('flex items-center gap-1.5 text-xs', check ? 'text-green-600' : 'text-gray-400')}>
                    <CheckCircle2 className={cn('h-3 w-3', check ? 'text-green-500' : 'text-gray-300')} />
                    {label}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm new password</label>
          <Input
            type="password"
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder="Re-enter new password"
            className={cn(
              confirmPwd && confirmPwd !== newPwd && 'border-red-300 focus-visible:ring-red-300',
              confirmPwd && confirmPwd === newPwd && newPwd && 'border-green-400 focus-visible:ring-green-300',
            )}
          />
          {confirmPwd && confirmPwd !== newPwd && (
            <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">Changing your password will sign you out on other devices.</p>
          <Button
            onClick={handleChangePassword}
            disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
            variant="outline"
            className="border-[#1a6b5e] text-[#1a6b5e] hover:bg-[#f0faf8] min-w-[140px]"
          >
            {savingPwd ? 'Changing…' : 'Change Password'}
          </Button>
        </div>
      </div>

    </div>
  );
}
