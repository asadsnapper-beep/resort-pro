'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';

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
  dateOfBirth: z.string().optional(), // ISO date "yyyy-MM-dd"
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
  dateOfBirth?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  loading: boolean;
  guest?: Guest | null;
}

export function GuestModal({ open, onClose, onSubmit, loading, guest }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

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
        dateOfBirth: guest.dateOfBirth ? guest.dateOfBirth.slice(0, 10) : '',
      });
    } else {
      reset({ firstName: '', lastName: '', email: '', phone: '', nationality: '', idNumber: '', address: '', notes: '', dateOfBirth: '' });
    }
  }, [guest, reset, open]);

  if (!isMounted || !open) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-base text-gray-900">
              {guest ? 'Edit Guest' : 'Add Guest'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {guest ? `Editing ${guest.firstName} ${guest.lastName}` : 'Register a new guest profile'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(100vh-180px)]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
            <input
              {...register('firstName')}
              placeholder="John"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'var(--rp-surface-3)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--rp-text)',
                outline: 'none',
              }}
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
            <input
              {...register('lastName')}
              placeholder="Smith"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'var(--rp-surface-3)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--rp-text)',
                outline: 'none',
              }}
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="john@example.com"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'var(--rp-surface-3)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--rp-text)',
                outline: 'none',
              }}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input
              {...register('phone')}
              placeholder="+1 234 567 8900"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'var(--rp-surface-3)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--rp-text)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Nationality + ID */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nationality</label>
            <input
              {...register('nationality')}
              placeholder="American"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'var(--rp-surface-3)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--rp-text)',
                outline: 'none',
              }}
            />
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
          <input
            {...register('idNumber')}
            placeholder="AB1234567"
            style={{
              width: '100%',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.05)',
              background: 'var(--rp-surface-3)',
              padding: '9px 12px',
              fontSize: '13px',
              color: 'var(--rp-text)',
              outline: 'none',
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
            <input
              {...register('address')}
              placeholder="123 Main St, New York, NY 10001"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'var(--rp-surface-3)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--rp-text)',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Date of Birth
              <span className="ml-1 text-xs text-muted-foreground font-normal">(for birthday offers)</span>
            </label>
            <input
              {...register('dateOfBirth')}
              type="date"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'var(--rp-surface-3)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--rp-text)',
                outline: 'none',
              }}
            />
          </div>
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
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '9px',
              border: '1px solid rgba(0,0,0,0.08)',
              background: 'transparent',
              color: 'var(--rp-text-subtle)',
              fontSize: '13px',
              fontWeight: 500,
              padding: '9px 12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '9px',
              border: 'none',
              background: 'var(--rp-btn-accent)',
              color: 'var(--rp-btn-accent-text)',
              fontSize: '13px',
              fontWeight: 500,
              padding: '9px 12px',
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
            disabled={loading}
          >
            {guest ? 'Save Changes' : 'Add Guest'}
          </button>
        </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
