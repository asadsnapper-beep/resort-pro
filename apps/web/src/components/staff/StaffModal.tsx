'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Monitor, UserCheck } from 'lucide-react';

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
  const [giveAccess, setGiveAccess] = useState(false);
  const [selectedRole, setSelectedRole] = useState('RECEPTIONIST');

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
        });
        setGiveAccess(false);
      } else {
        reset({ firstName: '', lastName: '', department: undefined, position: '', phone: '', hireDate: '', email: '', role: 'RECEPTIONIST' });
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={staff ? 'Edit Staff Member' : 'Add Staff Member'}
      description={staff ? `Editing ${staff.user.firstName} ${staff.user.lastName}` : 'Add a new team member'}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit(d => onSubmit(d, giveAccess))} className="space-y-4">

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
            <Input {...register('firstName')} placeholder="Jane" />
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
            <Input {...register('lastName')} placeholder="Doe" />
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Department + Position */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
            <select
              {...register('department')}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{formatDept(d)}</option>)}
            </select>
            {errors.department && <p className="mt-1 text-xs text-red-500">{errors.department.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Position / Title</label>
            <Input {...register('position')} placeholder="Front Desk Manager" />
            {errors.position && <p className="mt-1 text-xs text-red-500">{errors.position.message}</p>}
          </div>
        </div>

        {/* Phone + Hire Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone <span className="text-gray-400">(optional)</span></label>
            <Input {...register('phone')} placeholder="+1 234 567 8900" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hire Date</label>
            <Input {...register('hireDate')} type="date" />
            {errors.hireDate && <p className="mt-1 text-xs text-red-500">{errors.hireDate.message}</p>}
          </div>
        </div>

        {/* System Access Toggle — create mode only */}
        {!staff && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <p className="text-sm font-medium text-gray-700">Dashboard Access</p>
              <p className="text-xs text-gray-500 mt-0.5">Will this person log in to ResortPro?</p>
            </div>
            <div className="grid grid-cols-2 divide-x">
              <button
                type="button"
                onClick={() => setGiveAccess(false)}
                className={`p-4 flex flex-col items-center gap-2 transition-colors ${
                  !giveAccess ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                <UserCheck className={`h-5 w-5 ${!giveAccess ? 'text-gray-600' : 'text-gray-300'}`} />
                <span className="text-xs font-medium">No Access</span>
                <span className="text-[11px] text-center leading-tight text-gray-400">HR record only — no login</span>
                {!giveAccess && <span className="text-[10px] font-semibold text-[#1a6b5e] bg-[#f0faf8] px-2 py-0.5 rounded-full">Selected</span>}
              </button>
              <button
                type="button"
                onClick={() => setGiveAccess(true)}
                className={`p-4 flex flex-col items-center gap-2 transition-colors ${
                  giveAccess ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                <Monitor className={`h-5 w-5 ${giveAccess ? 'text-[#1a6b5e]' : 'text-gray-300'}`} />
                <span className="text-xs font-medium">Give Access</span>
                <span className="text-[11px] text-center leading-tight text-gray-400">Send invite to log in</span>
                {giveAccess && <span className="text-[10px] font-semibold text-[#1a6b5e] bg-[#f0faf8] px-2 py-0.5 rounded-full">Selected</span>}
              </button>
            </div>
          </div>
        )}

        {/* Access fields — shown only when giveAccess = true */}
        {!staff && giveAccess && (
          <div className="space-y-4 rounded-xl border border-[#1a6b5e]/20 bg-[#f0faf8] p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
              <Input {...register('email')} type="email" placeholder="jane@resort.com" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              <p className="mt-1 text-xs text-gray-500">An invite will be sent to this email</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">System Role</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ value, emoji, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleRoleSelect(value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedRole === value
                        ? 'border-[#1a6b5e] bg-white shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span>{emoji}</span>
                      <span className={`text-xs font-semibold ${selectedRole === value ? 'text-[#1a6b5e]' : 'text-gray-800'}`}>{label}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('role')} value={selectedRole} />
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {staff ? 'Save Changes' : giveAccess ? 'Add & Send Invite' : 'Add Staff Member'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
