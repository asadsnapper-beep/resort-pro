'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, CheckCircle2, Shield,
} from 'lucide-react';
import { ImageUpload } from '@/components/ui/ImageUpload';

const ROLE_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  OWNER:        { label: 'Owner',        bg: '#f4ecda', border: 'rgba(184,144,64,0.25)',   text: '#b89040' },
  MANAGER:      { label: 'Manager',      bg: '#e3f2ef', border: 'rgba(35,118,106,0.2)',    text: '#23766a' },
  SHAREHOLDER:  { label: 'Shareholder',  bg: '#f4ecda', border: 'rgba(184,144,64,0.25)',   text: '#b89040' },
  RECEPTIONIST: { label: 'Receptionist', bg: '#e3f2ef', border: 'rgba(35,118,106,0.2)',    text: '#23766a' },
  MARKETER:     { label: 'Marketer',     bg: '#fceee4', border: 'rgba(184,114,74,0.2)',    text: '#b8724a' },
  DEVELOPER:    { label: 'Developer',    bg: '#f5f4f1', border: 'rgba(0,0,0,0.08)',         text: '#6b8880' },
  STAFF:        { label: 'Staff',        bg: '#fceee4', border: 'rgba(184,114,74,0.2)',    text: '#b8724a' },
  GUEST:        { label: 'Guest',        bg: '#f5f4f1', border: 'rgba(0,0,0,0.08)',         text: '#8aa29a' },
};

const AVATAR_COLORS = [
  { bg: '#23766a', id: 'teal' },
  { bg: '#1b342f', id: 'dark' },
  { bg: '#d4a853', id: 'gold' },
  { bg: '#b8724a', id: 'coral' },
  { bg: '#4a6e66', id: 'sage' },
  { bg: '#7a5c2a', id: 'brown' },
];

function getInitials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#8aa29a] focus:outline-none focus:ring-1 focus:ring-resort-600/20 transition-colors';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';
const cardCls  = 'rounded-[14px] border bg-white p-6 space-y-5';
const cardStyle = { borderColor: 'rgba(0,0,0,0.045)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' };

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const role = user?.role ?? 'STAFF';
  const roleConf = ROLE_CONFIG[role] ?? ROLE_CONFIG.STAFF;

  const [firstName,    setFirstName]    = useState(user?.firstName ?? '');
  const [lastName,     setLastName]     = useState(user?.lastName ?? '');
  const [phone,        setPhone]        = useState(user?.phone ?? '');
  const [avatarUrl,    setAvatarUrl]    = useState(user?.avatarUrl ?? '');
  const [avatarColor,  setAvatarColor]  = useState('#23766a');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    authApi.me().then(res => {
      const fresh = res?.data?.data;
      if (!fresh) return;
      updateUser(fresh);
      setFirstName(fresh.firstName ?? '');
      setLastName(fresh.lastName ?? '');
      setPhone(fresh.phone ?? '');
      setAvatarUrl(fresh.avatarUrl ?? '');
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [savingPwd,   setSavingPwd]   = useState(false);

  const initials = getInitials(firstName || user?.firstName || 'U', lastName || user?.lastName || '');

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
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
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
      toast({ title: 'Password changed', description: 'You have been signed out on other devices.' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({ title: 'Error', description: e?.response?.data?.error ?? 'Could not change password', variant: 'destructive' });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12 animate-fade-up">

      {/* Page header */}
      <div>
        <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f]">My Profile</h1>
        <p className="mt-[4px] text-[13px] text-[#7a9890]">Manage your personal information and password</p>
      </div>

      {/* Avatar + identity card */}
      <div className={cardCls} style={cardStyle}>
        {/* Identity row */}
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-[68px] w-[68px] rounded-[14px] object-cover shrink-0"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
              onError={() => setAvatarUrl('')}
            />
          ) : (
            <div
              className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[14px] text-[22px] font-bold text-white"
              style={{ background: avatarColor, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            >
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-semibold text-[#18231f] truncate">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-[13px] text-[#8aa29a] truncate mt-[1px]">{user?.email}</p>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[10px] py-[4px] text-[11px] font-semibold"
                style={{ background: roleConf.bg, borderColor: roleConf.border, color: roleConf.text }}>
                <Shield className="h-[10px] w-[10px]" />
                {roleConf.label}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.05)' }} />

        {/* Photo upload */}
        <div className="rounded-[10px] p-4 space-y-3" style={{ background: '#faf9f7', border: '1px solid rgba(0,0,0,0.04)' }}>
          <p className="text-[11.5px] font-medium text-[#6b8880]">Profile photo</p>
          <ImageUpload
            value={avatarUrl || null}
            onChange={url => setAvatarUrl(url ?? '')}
            folder="profiles"
            label=""
            hint="JPEG, PNG or WebP · max 5 MB"
            aspectRatio="square"
            className="max-w-[120px]"
          />
          {!avatarUrl && (
            <div>
              <p className="text-[11px] text-[#8aa29a] mb-2">Or pick an avatar color</p>
              <div className="flex gap-2">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setAvatarColor(c.bg)}
                    className="h-[26px] w-[26px] rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c.bg,
                      outline: avatarColor === c.bg ? `2px solid ${c.bg}` : 'none',
                      outlineOffset: '2px',
                      transform: avatarColor === c.bg ? 'scale(1.15)' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Personal info */}
      <div className={cardCls} style={cardStyle}>
        <div className="flex items-center gap-2">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]" style={{ background: '#e3f2ef' }}>
            <User className="h-[13px] w-[13px]" style={{ color: '#23766a' }} />
          </div>
          <h3 className="text-[14px] font-semibold text-[#18231f]">Personal Information</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First name</label>
            <input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
          </div>
          <div>
            <label className={labelCls}>Last name</label>
            <input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Email address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[#c5bdb4]" />
            <input
              value={user?.email ?? ''}
              disabled
              className="w-full rounded-[8px] border border-black/5 bg-[#f0ede8] pl-9 pr-4 py-[9px] text-[13px] text-[#8aa29a] cursor-not-allowed"
            />
          </div>
          <p className="mt-1 text-[11.5px] text-[#8aa29a]">Email cannot be changed. Contact support if needed.</p>
        </div>

        <div>
          <label className={labelCls}>Phone number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[#c5bdb4]" />
            <input
              className={inputCls + ' pl-9'}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+880 1700 000000"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="flex items-center gap-1.5 rounded-[9px] px-5 py-[9px] text-[13px] font-medium text-[#dfd9d0] transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: '#1b342f' }}
          >
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className={cardCls} style={cardStyle}>
        <div className="flex items-center gap-2">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]" style={{ background: '#f4ecda' }}>
            <Lock className="h-[13px] w-[13px]" style={{ color: '#b89040' }} />
          </div>
          <h3 className="text-[14px] font-semibold text-[#18231f]">Change Password</h3>
        </div>

        <div>
          <label className={labelCls}>Current password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Enter current password"
              className={inputCls + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c5bdb4] hover:text-[#8aa29a]"
            >
              {showCurrent ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>New password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Enter new password"
              className={inputCls + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c5bdb4] hover:text-[#8aa29a]"
            >
              {showNew ? <EyeOff className="h-[14px] w-[14px]" /> : <Eye className="h-[14px] w-[14px]" />}
            </button>
          </div>

          {newPwd.length > 0 && (
            <div className="mt-2.5 space-y-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-colors"
                    style={{
                      background: i < pwdStrength
                        ? pwdStrength === 1 ? '#f87171' : pwdStrength === 2 ? '#d4a853' : '#23766a'
                        : '#e8e4dd',
                    }}
                  />
                ))}
              </div>
              <div className="space-y-1">
                {[
                  { check: pwdChecks.length,    label: 'At least 8 characters' },
                  { check: pwdChecks.uppercase, label: 'One uppercase letter' },
                  { check: pwdChecks.number,    label: 'One number' },
                ].map(({ check, label }) => (
                  <p key={label} className="flex items-center gap-1.5 text-[12px]"
                    style={{ color: check ? '#23766a' : '#8aa29a' }}>
                    <CheckCircle2 className="h-[11px] w-[11px]"
                      style={{ color: check ? '#23766a' : '#c5bdb4' }} />
                    {label}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Confirm new password</label>
          <input
            type="password"
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder="Re-enter new password"
            className={inputCls}
            style={confirmPwd && confirmPwd !== newPwd
              ? { borderColor: '#f87171', boxShadow: '0 0 0 2px rgba(248,113,113,0.2)' }
              : confirmPwd && confirmPwd === newPwd && newPwd
              ? { borderColor: '#23766a', boxShadow: '0 0 0 2px rgba(35,118,106,0.15)' }
              : {}}
          />
          {confirmPwd && confirmPwd !== newPwd && (
            <p className="mt-1 text-[11.5px]" style={{ color: '#f87171' }}>Passwords do not match</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-[11.5px] text-[#8aa29a]">Changing your password signs you out on other devices.</p>
          <button
            onClick={handleChangePassword}
            disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
            className="shrink-0 flex items-center gap-1.5 rounded-[9px] border px-5 py-[8px] text-[13px] font-medium transition-colors disabled:opacity-40"
            style={{ borderColor: 'rgba(35,118,106,0.3)', color: '#23766a', background: '#e3f2ef' }}
          >
            {savingPwd ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </div>

    </div>
  );
}
