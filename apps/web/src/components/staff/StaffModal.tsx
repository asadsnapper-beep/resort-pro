'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DEPARTMENTS = ['FRONT_DESK', 'HOUSEKEEPING', 'RESTAURANT', 'MAINTENANCE', 'SECURITY', 'MANAGEMENT'] as const;

const createSchema = z.object({
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  department: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Select a department' }) }),
  position: z.string().min(1, 'Position required'),
  phone: z.string().optional(),
  hireDate: z.string().min(1, 'Hire date required'),
});

const editSchema = z.object({
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
  department: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Select a department' }) }),
  position: z.string().min(1, 'Position required'),
  phone: z.string().optional(),
  hireDate: z.string().min(1, 'Hire date required'),
});

type CreateData = z.infer<typeof createSchema>;
type EditData = z.infer<typeof editSchema>;
type FormData = CreateData;

interface Staff {
  id: string;
  department: string;
  position: string;
  phone?: string;
  hireDate: string;
  user: { firstName: string; lastName: string; email: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData | EditData) => void;
  loading: boolean;
  staff?: Staff | null;
}

export function StaffModal({ open, onClose, onSubmit, loading, staff }: Props) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(staff ? (editSchema as unknown as typeof createSchema) : createSchema),
  });

  useEffect(() => {
    if (staff) {
      reset({
        firstName: staff.user.firstName,
        lastName: staff.user.lastName,
        email: staff.user.email,
        department: staff.department as typeof DEPARTMENTS[number],
        position: staff.position,
        phone: staff.phone ?? '',
        hireDate: staff.hireDate?.split('T')[0] ?? '',
      } as FormData);
    } else {
      reset({ firstName: '', lastName: '', email: '', password: '', department: undefined, position: '', phone: '', hireDate: '' });
    }
  }, [staff, reset, open]);

  const formatDept = (d: string) => d.replace('_', ' ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={staff ? 'Edit Staff Member' : 'Add Staff Member'}
      description={staff ? `Editing ${staff.user.firstName} ${staff.user.lastName}` : 'Create a new staff account'}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit(onSubmit as (d: FormData) => void)} className="space-y-4">
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

        {/* Email + Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <Input {...register('email')} type="email" placeholder="jane@resort.com" disabled={!!staff} />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <Input {...register('phone')} placeholder="+1 234 567 8900" />
          </div>
        </div>

        {/* Password (create only) */}
        {!staff && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <Input {...register('password')} type="password" placeholder="Min. 8 characters" />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
        )}

        {/* Department + Position */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
            <select
              {...register('department')}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{formatDept(d)}</option>
              ))}
            </select>
            {errors.department && <p className="mt-1 text-xs text-red-500">{errors.department.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Position / Title</label>
            <Input {...register('position')} placeholder="Front Desk Manager" />
            {errors.position && <p className="mt-1 text-xs text-red-500">{errors.position.message}</p>}
          </div>
        </div>

        {/* Hire Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Hire Date</label>
          <Input {...register('hireDate')} type="date" />
          {errors.hireDate && <p className="mt-1 text-xs text-red-500">{errors.hireDate.message}</p>}
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {staff ? 'Save Changes' : 'Add Staff Member'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
