'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ID_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'OTHER'] as const;

const schema = z.object({
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  idType: z.enum(ID_TYPES).optional(),
  idNumber: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  address?: string;
  notes?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  loading: boolean;
  guest?: Guest | null;
}

export function GuestModal({ open, onClose, onSubmit, loading, guest }: Props) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (guest) {
      reset({
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone ?? '',
        nationality: guest.nationality ?? '',
        idType: (guest.idType as typeof ID_TYPES[number]) ?? undefined,
        idNumber: guest.idNumber ?? '',
        address: guest.address ?? '',
        notes: guest.notes ?? '',
      });
    } else {
      reset({ firstName: '', lastName: '', email: '', phone: '', nationality: '', idNumber: '', address: '', notes: '' });
    }
  }, [guest, reset, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={guest ? 'Edit Guest' : 'Add Guest'}
      description={guest ? `Editing ${guest.firstName} ${guest.lastName}` : 'Register a new guest profile'}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
            <Input {...register('firstName')} placeholder="John" />
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
            <Input {...register('lastName')} placeholder="Smith" />
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <Input {...register('email')} type="email" placeholder="john@example.com" />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <Input {...register('phone')} placeholder="+1 234 567 8900" />
          </div>
        </div>

        {/* Nationality + ID */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nationality</label>
            <Input {...register('nationality')} placeholder="American" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ID Type</label>
            <select
              {...register('idType')}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select ID type</option>
              {ID_TYPES.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ID Number</label>
          <Input {...register('idNumber')} placeholder="AB1234567" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
          <Input {...register('address')} placeholder="123 Main St, New York, NY 10001" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            {...register('notes')}
            rows={2}
            placeholder="Any special notes about this guest..."
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>
            {guest ? 'Save Changes' : 'Add Guest'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
