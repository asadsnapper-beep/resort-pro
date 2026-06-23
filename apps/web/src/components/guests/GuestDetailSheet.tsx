'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { guestsApi } from '@/lib/api';
import { X, Mail, Phone, Globe, CreditCard, MapPin, FileText, Pencil, Trash2, CalendarDays } from 'lucide-react';
import { GuestDocumentList } from './GuestDocumentList';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';

const BOOKING_STATUS_META: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CONFIRMED:    { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.2)',  text: '#23766a', label: 'Confirmed' },
  CHECKED_IN:   { bg: 'var(--rp-teal-bg)', border: 'rgba(35,118,106,0.3)',  text: '#1b5c52', label: 'Checked In' },
  CHECKED_OUT:  { bg: 'var(--rp-surface-3)', border: 'var(--rp-border-md)',      text: 'var(--rp-text-muted)', label: 'Checked Out' },
  CANCELLED:    { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.15)',  text: '#c43c3c', label: 'Cancelled' },
  NO_SHOW:      { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'No Show' },
  PENDING:      { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.2)',  text: '#b89040', label: 'Pending' },
};

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
  createdAt: string;
}

interface Props {
  guest: Guest | null;
  onClose: () => void;
  onEdit: (guest: Guest) => void;
  onDelete: (guest: Guest) => void;
}

export function GuestDetailSheet({ guest, onClose, onEdit, onDelete }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (guest) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [guest]);

  const { data } = useQuery({
    queryKey: ['guest', guest?.id],
    queryFn: () => guestsApi.get(guest!.id),
    enabled: !!guest?.id,
  });

  if (!guest || !mounted) return null;

  const fullGuest = data?.data?.data ?? guest;
  const bookings: Record<string, unknown>[] = fullGuest.bookings ?? [];
  const totalSpend = bookings.reduce((sum: number, b: Record<string, unknown>) => sum + Number(b.totalAmount ?? 0), 0);
  const initials = getInitials(guest.firstName, guest.lastName);

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(27,52,47,0.3)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', inset: '0 0 0 auto', zIndex: 9999, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '440px', background: isDark ? '#1a2e2a' : 'var(--rp-surface)', boxShadow: '-8px 0 40px rgba(27,52,47,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--rp-btn-accent)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', fontSize: '15px', fontWeight: 700, color: 'var(--rp-btn-accent-text)' }}>
              {initials}
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rp-btn-accent-text)', margin: 0 }}>{guest.firstName} {guest.lastName}</h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Guest since {formatDate(guest.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: 'Stays', value: String(bookings.length) },
                { label: 'Total Spend', value: formatCurrency(totalSpend) },
                { label: 'Nationality', value: guest.nationality ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ borderRadius: '10px', background: 'var(--rp-surface-3)', padding: '10px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: 'var(--rp-text-muted)' }}>{label}</p>
                  <p style={{ marginTop: '3px', fontSize: '12.5px', fontWeight: 600, color: 'var(--rp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div>
              <p style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rp-text-muted)', marginBottom: '12px' }}>Contact</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { key: 'email', Icon: Mail,   value: guest.email },
                  { key: 'phone', Icon: Phone,  value: guest.phone ?? '—' },
                  { key: 'addr',  Icon: MapPin, value: guest.address ?? '—' },
                  { key: 'nat',   Icon: Globe,  value: guest.nationality ?? '—' },
                ].map(({ key, Icon, value }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                    <Icon style={{ width: '15px', height: '15px', color: '#9bbdb7', flexShrink: 0 }} />
                    <span style={{ color: value === '—' ? 'var(--rp-text-faint)' : 'var(--rp-text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ID */}
            {(guest.idType || guest.idNumber) && (
              <div>
                <p style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rp-text-muted)', marginBottom: '10px' }}>Identity</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.07)', background: 'var(--rp-surface-3)', padding: '10px 14px' }}>
                  <CreditCard style={{ width: '15px', height: '15px', color: '#9bbdb7', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)' }}>{guest.idType?.replace('_', ' ')}</p>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--rp-text)' }}>{guest.idNumber ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {guest.notes && (
              <div>
                <p style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rp-text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText style={{ width: '13px', height: '13px' }} /> Notes
                </p>
                <p style={{ fontSize: '13px', color: 'var(--rp-text-accent)', background: 'var(--rp-teal-soft)', border: '1px solid rgba(35,118,106,0.15)', borderRadius: '10px', padding: '10px 14px', lineHeight: 1.5 }}>{guest.notes}</p>
              </div>
            )}

            {/* Documents */}
            <GuestDocumentList guestId={guest.id} guestName={`${guest.firstName} ${guest.lastName}`} />

            {/* Booking History */}
            <div>
              <p style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rp-text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarDays style={{ width: '13px', height: '13px' }} /> Booking History
              </p>
              {bookings.length === 0 ? (
                <div style={{ border: '1.5px dashed rgba(0,0,0,0.1)', borderRadius: '12px', padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--rp-text-faint)' }}>
                  No bookings yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bookings.map((b) => {
                    const sm = BOOKING_STATUS_META[b.status as string] ?? BOOKING_STATUS_META.CONFIRMED;
                    return (
                      <div key={b.id as string} style={{ borderRadius: '10px', border: '1px solid rgba(0,0,0,0.07)', background: 'var(--rp-surface-2)', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#23766a' }}>{b.confirmationNo as string}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '2px 8px', background: sm.bg, border: `1px solid ${sm.border}`, color: sm.text }}>{sm.label}</span>
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--rp-text)' }}>{(b.room as { name: string })?.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                          <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)' }}>{formatDate(b.checkIn as string)} → {formatDate(b.checkOut as string)}</p>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#23766a' }}>{formatCurrency(Number(b.totalAmount))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px', padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.06)', background: 'var(--rp-surface-2)', flexShrink: 0 }}>
          <button onClick={() => onEdit(guest)}
            style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--rp-text-subtle)', cursor: 'pointer' }}>
            <Pencil style={{ width: '14px', height: '14px' }} /> Edit
          </button>
          <button onClick={() => onDelete(guest)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', border: '1px solid rgba(200,60,60,0.15)', background: 'var(--rp-red-bg)', padding: '8px 12px', cursor: 'pointer' }}>
            <Trash2 style={{ width: '15px', height: '15px', color: '#c43c3c' }} />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
