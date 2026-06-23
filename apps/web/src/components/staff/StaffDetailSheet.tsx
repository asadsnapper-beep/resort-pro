'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, Phone, Briefcase, Building2, Calendar, Pencil, UserX, Shield, Clock, CheckCircle2 } from 'lucide-react';
import { formatDate, getInitials } from '@/lib/utils';

interface Staff {
  id: string;
  department: string;
  position: string;
  phone?: string;
  hireDate: string;
  isActive: boolean;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    isActive: boolean;
    lastLoginAt?: string;
  };
}

interface Props {
  staff: Staff | null;
  onClose: () => void;
  onEdit: (staff: Staff) => void;
  onDeactivate: (staff: Staff) => void;
  onReactivate: (staff: Staff) => void;
}

const DEPT_META: Record<string, { bg: string; border: string; text: string }> = {
  FRONT_DESK:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a' },
  HOUSEKEEPING: { bg: 'var(--rp-teal-soft)', border: 'rgba(35,118,106,0.15)', text: 'var(--rp-text-accent)' },
  RESTAURANT:   { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  MAINTENANCE:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  SECURITY:     { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)', text: '#c43c3c' },
  MANAGEMENT:   { bg: '#1b342f', border: 'rgba(27,52,47,0.4)',    text: '#dfd9d0' },
};

const ROLE_META: Record<string, { bg: string; border: string; text: string }> = {
  OWNER:        { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  MANAGER:      { bg: '#1b342f', border: 'rgba(27,52,47,0.4)',    text: '#dfd9d0' },
  RECEPTIONIST: { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)', text: '#23766a' },
  CHEF:         { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.2)',  text: '#b8724a' },
  MARKETER:     { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.15)', text: '#b8724a' },
  DEVELOPER:    { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-subtle)' },
  SHAREHOLDER:  { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040' },
  STAFF:        { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)' },
};

function formatDept(d: string) {
  return d.replace(/_/g, ' ');
}

function getDaysEmployed(hireDate: string) {
  const days = Math.floor((Date.now() - new Date(hireDate).getTime()) / 86400000);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m > 0 ? `${y}y ${m}mo` : `${y}y`;
}

export function StaffDetailSheet({ staff, onClose, onEdit, onDeactivate, onReactivate }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (staff) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [staff]);

  if (!staff || !mounted) return null;

  const initials  = getInitials(staff.user.firstName, staff.user.lastName);
  const deptMeta  = DEPT_META[staff.department] ?? { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)', text: 'var(--rp-text-muted)' };
  const roleMeta  = ROLE_META[staff.user.role ?? 'STAFF'] ?? ROLE_META.STAFF;
  const tenure    = getDaysEmployed(staff.hireDate);

  const sheet = (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(27,52,47,0.3)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
        style={{ boxShadow: '-8px 0 40px rgba(27,52,47,0.18)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold"
                style={{ background: 'var(--rp-teal-bg)', color: '#23766a', border: `2px solid ${deptMeta.border}` }}>
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
                style={{ background: staff.isActive ? '#4ade80' : 'var(--rp-text-faint)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--rp-text)' }}>
                {staff.user.firstName} {staff.user.lastName}
              </h2>
              <p className="text-[12.5px]" style={{ color: 'var(--rp-text-muted)' }}>{staff.position}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors hover:bg-[#f4f1eb]"
            style={{ color: 'var(--rp-text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* Dept + Status pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[10px] py-[4px] text-[11.5px] font-semibold"
                style={{ background: deptMeta.bg, borderColor: deptMeta.border, color: deptMeta.text }}>
                <Building2 className="h-3 w-3" /> {formatDept(staff.department)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-[7px] border px-[10px] py-[4px] text-[11.5px] font-semibold"
                style={staff.isActive
                  ? { background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }
                  : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                <CheckCircle2 className="h-3 w-3" /> {staff.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Tenure', value: tenure },
                { label: 'Hired', value: formatDate(staff.hireDate) },
                { label: 'Last Login', value: staff.user.lastLoginAt ? formatDate(staff.user.lastLoginAt) : 'Never' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-[10px] p-3 text-center"
                  style={{ background: 'var(--rp-surface-3)' }}>
                  <p className="text-[10.5px]" style={{ color: 'var(--rp-text-muted)' }}>{label}</p>
                  <p className="mt-0.5 text-[12.5px] font-semibold truncate" style={{ color: 'var(--rp-text)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--rp-text-muted)' }}>Contact</p>
              <div className="space-y-2.5">
                {[
                  { key: 'email', icon: Mail,  value: staff.user.email },
                  { key: 'phone', icon: Phone, value: staff.phone ?? '—' },
                ].map(({ key, icon: Icon, value }) => (
                  <div key={key} className="flex items-center gap-3 text-[13px]">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: '#9bbdb7' }} />
                    <span style={{ color: value === '—' ? 'var(--rp-text-faint)' : 'var(--rp-text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Employment */}
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--rp-text-muted)' }}>Employment</p>
              <div className="space-y-2.5">
                {[
                  { icon: Briefcase, label: 'Position',   value: staff.position },
                  { icon: Building2, label: 'Department', value: formatDept(staff.department) },
                  { icon: Calendar,  label: 'Hire Date',  value: formatDate(staff.hireDate) },
                  { icon: Clock,     label: 'Tenure',     value: tenure },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 text-[13px]">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: '#9bbdb7' }} />
                    <span className="w-24 shrink-0" style={{ color: 'var(--rp-text-muted)' }}>{label}</span>
                    <span className="font-medium" style={{ color: 'var(--rp-text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* System Access */}
            <div className="rounded-[12px] border p-4 space-y-2.5"
              style={{ background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)' }}>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--rp-text)' }}>
                <Shield className="h-3.5 w-3.5" style={{ color: '#9bbdb7' }} /> System Access
              </p>
              <div className="flex items-center justify-between text-[12.5px]">
                <span style={{ color: 'var(--rp-text-muted)' }}>Login Email</span>
                <span className="font-medium" style={{ color: 'var(--rp-text)' }}>{staff.user.email}</span>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span style={{ color: 'var(--rp-text-muted)' }}>Role</span>
                <span className="rounded-[6px] border px-[8px] py-[3px] text-[11px] font-semibold"
                  style={{ background: roleMeta.bg, borderColor: roleMeta.border, color: roleMeta.text }}>
                  {staff.user.role ?? 'STAFF'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span style={{ color: 'var(--rp-text-muted)' }}>Account</span>
                <span className="font-medium" style={{ color: staff.user.isActive ? '#23766a' : '#c43c3c' }}>
                  {staff.user.isActive ? 'Active' : 'Deactivated'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button className="flex flex-1 items-center justify-center gap-2 rounded-[9px] border py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb]"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}
            onClick={() => onEdit(staff)}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
          {staff.isActive ? (
            <button className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-80"
              style={{ background: 'var(--rp-red-bg)', borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}
              onClick={() => onDeactivate(staff)}>
              <UserX className="h-4 w-4" /> Deactivate
            </button>
          ) : (
            <button className="flex items-center gap-2 rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-80"
              style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}
              onClick={() => onReactivate(staff)}>
              <Shield className="h-4 w-4" /> Reactivate
            </button>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(sheet, document.body);
}
