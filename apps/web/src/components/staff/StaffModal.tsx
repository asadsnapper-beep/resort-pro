'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Monitor, UserCheck, Loader2, X } from 'lucide-react';

const DEPARTMENTS = ['FRONT_DESK', 'HOUSEKEEPING', 'RESTAURANT', 'MAINTENANCE', 'SECURITY', 'MANAGEMENT'] as const;

const ROLES = [
  { value: 'MANAGER',      emoji: '👔', label: 'General Manager',    desc: 'Full access except billing' },
  { value: 'RECEPTIONIST', emoji: '🛎️', label: 'Receptionist',       desc: 'Bookings, guests, check-in/out' },
  { value: 'CHEF',         emoji: '👨‍🍳', label: 'Chef',               desc: 'Kitchen display, F&B orders' },
  { value: 'STAFF',        emoji: '🧹', label: 'Housekeeping Staff',  desc: 'Own tasks only' },
  { value: 'SHAREHOLDER',  emoji: '📊', label: 'Shareholder',         desc: 'Read-only: revenue, analytics' },
  { value: 'MARKETER',     emoji: '📣', label: 'Marketing Manager',   desc: 'CRM, offers, website' },
  { value: 'DEVELOPER',    emoji: '💻', label: 'Developer',           desc: 'Website, embed settings' },
] as const;

const baseSchema = z.object({
  firstName:  z.string().min(1, 'First name required').max(50),
  lastName:   z.string().min(1, 'Last name required').max(50),
  department: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Select a department' }) }),
  position:   z.string().min(1, 'Position required'),
  phone:      z.string().optional(),
  hireDate:   z.string().min(1, 'Hire date required'),
  shiftStartTime: z.string().optional(),
  deviceUserId:   z.string().optional(),
});

const editSchema = baseSchema;

const createNoAccessSchema = baseSchema;

const createWithAccessSchema = baseSchema.extend({
  email: z.string().email('Valid email required'),
  role:  z.string().min(1, 'Select a role'),
});

type BaseData     = z.infer<typeof baseSchema>;
type CreateData   = z.infer<typeof createWithAccessSchema>;
type EditData     = z.infer<typeof editSchema>;

interface Staff {
  id: string;
  department: string;
  position: string;
  phone?: string;
  hireDate: string;
  shiftStartTime?: string;
  deviceUserId?: string;
  user: { firstName: string; lastName: string; email: string };
}

interface Props {
  open:     boolean;
  onClose:  () => void;
  onSubmit: (data: BaseData | CreateData | EditData, giveAccess: boolean) => void;
  loading:  boolean;
  staff?:   Staff | null;
}

export function StaffModal({ open, onClose, onSubmit, loading, staff }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [isMounted, setIsMounted] = useState(false);
  const [giveAccess, setGiveAccess] = useState(false);
  const [selectedRole, setSelectedRole] = useState('RECEPTIONIST');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [open]);

  const schema = staff
    ? editSchema
    : giveAccess
      ? createWithAccessSchema
      : createNoAccessSchema;

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CreateData>({
    resolver: zodResolver(schema as z.ZodType<CreateData>),
  });

  useEffect(() => {
    if (open) {
      if (staff) {
        reset({
          firstName:  staff.user.firstName,
          lastName:   staff.user.lastName,
          department: staff.department as typeof DEPARTMENTS[number],
          position:   staff.position,
          phone:      staff.phone ?? '',
          hireDate:   staff.hireDate?.split('T')[0] ?? '',
          shiftStartTime: staff.shiftStartTime ?? '',
          deviceUserId:   staff.deviceUserId ?? '',
        });
        setGiveAccess(false);
      } else {
        reset({ firstName: '', lastName: '', department: undefined, position: '', phone: '', hireDate: '', shiftStartTime: '', deviceUserId: '', email: '', role: 'RECEPTIONIST' });
        setGiveAccess(false);
        setSelectedRole('RECEPTIONIST');
      }
    }
  }, [staff, reset, open]);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setValue('role', role);
  };

  const formatDept = (d: string) => d.replace(/_/g, ' ');

  const inputCls = `w-full rounded-[8px] border border-black/5 dark:border-white/10 px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30 ${isDark ? 'bg-white/5 text-[#dfd9d0] placeholder:text-white/30' : 'bg-[#f4f1eb]'}`;
  const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';
  const errCls   = 'mt-1 text-[11.5px] text-[#c43c3c]';

  if (!isMounted || !open) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#1a2e2a] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <div>
            <h2 className="font-semibold text-base text-gray-900 dark:text-[#dfd9d0]">
              {staff ? 'Edit Staff Member' : 'Add Staff Member'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#94b8b0] mt-0.5">
              {staff ? `Editing ${staff.user.firstName} ${staff.user.lastName}` : 'Add a new team member'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto max-h-[calc(100vh-180px)]">
          <form onSubmit={handleSubmit(d => onSubmit(d, giveAccess))} className="space-y-4">

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name</label>
            <input {...register('firstName')} placeholder="Jane" className={inputCls} />
            {errors.firstName && <p className={errCls}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input {...register('lastName')} placeholder="Doe" className={inputCls} />
            {errors.lastName && <p className={errCls}>{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Department + Position */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Department</label>
            <select {...register('department')}
              className={inputCls + ' cursor-pointer'}>
              <option value="">Select department</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{formatDept(d)}</option>)}
            </select>
            {errors.department && <p className={errCls}>{errors.department.message}</p>}
          </div>
          <div>
            <label className={labelCls}>Position / Title</label>
            <input {...register('position')} placeholder="Front Desk Manager" className={inputCls} />
            {errors.position && <p className={errCls}>{errors.position.message}</p>}
          </div>
        </div>

        {/* Phone + Hire Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
            <input {...register('phone')} placeholder="+1 234 567 8900" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Hire Date</label>
            <input {...register('hireDate')} type="date" className={inputCls} />
            {errors.hireDate && <p className={errCls}>{errors.hireDate.message}</p>}
          </div>
        </div>

        {/* Attendance settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Shift Start Time <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
            <input {...register('shiftStartTime')} type="time" className={inputCls} />
            <p className="mt-1 text-[11px]" style={{ color: 'var(--rp-text-faint)' }}>Used to mark clock-ins Late</p>
          </div>
          <div>
            <label className={labelCls}>Fingerprint Device ID <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
            <input {...register('deviceUserId')} placeholder="e.g. 1024" className={inputCls} />
            <p className="mt-1 text-[11px]" style={{ color: 'var(--rp-text-faint)' }}>ID configured on the attendance device</p>
          </div>
        </div>

        {/* System Access Toggle — create mode only */}
        {!staff && (
          <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)' }}>
            <div className="px-4 py-3" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface-2)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)'}` }}>
              <p className="text-[13px] font-medium" style={{ color: isDark ? '#dfd9d0' : 'var(--rp-text)' }}>Dashboard Access</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--rp-text-muted)' }}>Will this person log in to ResortPro?</p>
            </div>
            <div className="grid grid-cols-2" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)'}` }}>
              {[
                { value: false, Icon: UserCheck, label: 'No Access', sub: 'HR record only — no login' },
                { value: true,  Icon: Monitor,   label: 'Give Access', sub: 'Send invite to log in' },
              ].map(({ value, Icon, label, sub }) => (
                <button key={String(value)} type="button" onClick={() => setGiveAccess(value)}
                  className="p-4 flex flex-col items-center gap-2 transition-colors"
                  style={giveAccess === value
                    ? { background: isDark ? 'rgba(255,255,255,0.10)' : 'var(--rp-surface)' }
                    : { background: isDark ? 'rgba(255,255,255,0.04)' : 'var(--rp-surface-2)' }}>
                  <Icon className="h-5 w-5"
                    style={{ color: giveAccess === value ? '#23766a' : 'var(--rp-text-faint)' }} />
                  <span className="text-[12.5px] font-medium" style={{ color: giveAccess === value ? (isDark ? '#dfd9d0' : 'var(--rp-text)') : 'var(--rp-text-muted)' }}>{label}</span>
                  <span className="text-[11px] text-center leading-tight" style={{ color: 'var(--rp-text-faint)' }}>{sub}</span>
                  {giveAccess === value && (
                    <span className="text-[10.5px] font-semibold rounded-full px-2 py-0.5"
                      style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Access fields */}
        {!staff && giveAccess && (
          <div className="space-y-4 rounded-[12px] border p-4"
            style={{ background: isDark ? 'rgba(35,118,106,0.1)' : 'var(--rp-teal-soft)', borderColor: 'rgba(35,118,106,0.2)' }}>
            <div>
              <label className={labelCls}>Email Address</label>
              <input {...register('email')} type="email" placeholder="jane@resort.com" className={inputCls} />
              {errors.email && <p className={errCls}>{errors.email.message}</p>}
              <p className="mt-1 text-[11.5px]" style={{ color: 'var(--rp-text-muted)' }}>An invite will be sent to this email</p>
            </div>
            <div>
              <label className={labelCls}>System Role</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ value, emoji, label, desc }) => (
                  <button key={value} type="button" onClick={() => handleRoleSelect(value)}
                    className="p-3 rounded-[10px] border text-left transition-all"
                    style={selectedRole === value
                      ? { borderColor: '#23766a', background: isDark ? 'rgba(35,118,106,0.15)' : 'var(--rp-surface)', boxShadow: '0 0 0 3px rgba(35,118,106,0.12)' }
                      : { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)', background: isDark ? 'rgba(255,255,255,0.05)' : 'var(--rp-surface)' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span>{emoji}</span>
                      <span className="text-[12px] font-semibold" style={{ color: selectedRole === value ? '#23766a' : (isDark ? '#dfd9d0' : 'var(--rp-text)') }}>{label}</span>
                    </div>
                    <p className="text-[11px] leading-tight" style={{ color: 'var(--rp-text-muted)' }}>{desc}</p>
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('role')} value={selectedRole} />
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'var(--rp-border)'}` }}>
          <button type="button" onClick={onClose}
            className="rounded-[9px] border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f4f1eb] dark:hover:bg-white/10"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {staff ? 'Save Changes' : giveAccess ? 'Add & Send Invite' : 'Add Staff Member'}
          </button>
        </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
