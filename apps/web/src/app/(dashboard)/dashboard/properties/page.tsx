'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyApi } from '@/lib/api';
import { ModalShell } from '@/components/ui/modal-shell';
import { toast } from '@/hooks/use-toast';
import { Plus, Building2, MapPin, Phone, Mail, BedDouble, Lock, ChevronRight } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  isActive: boolean;
  _count?: { rooms: number };
  roomStats?: Record<string, number>;
}

const emptyForm = {
  name: '', slug: '', address: '', phone: '', email: '',
  timezone: 'Asia/Dhaka', checkInTime: '14:00', checkOutTime: '11:00',
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function PropertiesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, error } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyApi.list({ limit: 50 }).then(r => r.data),
    retry: false,
  });

  const isForbidden = (error as { response?: { status?: number } })?.response?.status === 403;

  const createMut = useMutation({
    mutationFn: (d: typeof emptyForm) => propertyApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); closeModal(); toast({ title: 'Property created' }); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: e.response?.data?.error || 'Failed', variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) => propertyApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); closeModal(); toast({ title: 'Property updated' }); },
    onError: (e: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: e.response?.data?.error || 'Failed', variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => propertyApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setDeleteId(null); toast({ title: 'Property deleted' }); },
    onError: (e: { response?: { data?: { error?: string } } }) => { setDeleteId(null); toast({ title: 'Error', description: e.response?.data?.error || 'Failed', variant: 'destructive' }); },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: Property) {
    setEditingId(p.id);
    setForm({ name: p.name, slug: p.slug, address: p.address || '', phone: p.phone || '', email: p.email || '', timezone: p.timezone, checkInTime: p.checkInTime, checkOutTime: p.checkOutTime });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.slug.trim()) return toast({ title: 'Name and slug are required', variant: 'destructive' });
    if (editingId) {
      updateMut.mutate({ id: editingId, data: form });
    } else {
      createMut.mutate(form);
    }
  }

  const properties: Property[] = data?.data || [];

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--rp-text)', margin: 0 }}>Properties</h1>
          <p style={{ fontSize: 13, color: 'var(--rp-text-muted)', marginTop: 4 }}>
            Manage multiple resort properties under one account
          </p>
        </div>
        {!isForbidden && (
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1a6b5e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={16} /> Add Property
          </button>
        )}
      </div>

      {/* Enterprise gate */}
      {isForbidden && (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--rp-surface)', border: '1px solid var(--rp-border)', borderRadius: 12 }}>
          <div style={{ width: 56, height: 56, background: 'var(--rp-surface-2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={24} color="var(--rp-text-muted)" />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--rp-text)', margin: '0 0 8px' }}>Multi-Property — Enterprise Only</h2>
          <p style={{ fontSize: 14, color: 'var(--rp-text-muted)', marginBottom: 24 }}>
            Manage multiple resort locations from one account. Upgrade to Enterprise to unlock.
          </p>
          <a href="/dashboard/billing" style={{ display: 'inline-block', padding: '10px 24px', background: '#1a6b5e', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Upgrade to Enterprise
          </a>
        </div>
      )}

      {/* Loading */}
      {isLoading && !isForbidden && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 160, background: 'var(--rp-surface)', borderRadius: 12, border: '1px solid var(--rp-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isForbidden && properties.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--rp-surface)', border: '1px solid var(--rp-border)', borderRadius: 12 }}>
          <Building2 size={40} color="var(--rp-text-muted)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--rp-text)', margin: '0 0 8px' }}>No properties yet</h2>
          <p style={{ fontSize: 13, color: 'var(--rp-text-muted)', marginBottom: 20 }}>Add your first property to get started.</p>
          <button onClick={openCreate} style={{ padding: '8px 20px', background: '#1a6b5e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Add Property
          </button>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isForbidden && properties.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {properties.map(p => (
            <div key={p.id} style={{ background: 'var(--rp-surface)', border: '1px solid var(--rp-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: 'var(--rp-teal-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} color="#1a6b5e" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rp-text)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--rp-text-muted)' }}>{p.slug}</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: p.isActive ? 'var(--rp-teal-bg)' : 'var(--rp-surface-2)', color: p.isActive ? '#1a6b5e' : 'var(--rp-text-muted)', border: `1px solid ${p.isActive ? 'rgba(26,107,94,0.2)' : 'var(--rp-border)'}` }}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--rp-text-muted)' }}>
                    <MapPin size={12} /> {p.address}
                  </div>
                )}
                {p.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--rp-text-muted)' }}>
                    <Phone size={12} /> {p.phone}
                  </div>
                )}
                {p.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--rp-text-muted)' }}>
                    <Mail size={12} /> {p.email}
                  </div>
                )}
              </div>

              {/* Room stats */}
              {p._count && p._count.rooms > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { key: 'AVAILABLE',   label: 'Available',   color: '#1a6b5e', bg: 'var(--rp-teal-bg)' },
                    { key: 'OCCUPIED',    label: 'Occupied',    color: '#b89040', bg: 'var(--rp-amber-bg)' },
                    { key: 'CLEANING',    label: 'Cleaning',    color: '#b8724a', bg: 'var(--rp-coral-bg)' },
                    { key: 'MAINTENANCE', label: 'Maint.',      color: '#c43c3c', bg: 'var(--rp-red-bg)' },
                  ].filter(s => (p.roomStats?.[s.key] ?? 0) > 0).map(s => (
                    <span key={s.key} style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: s.bg, color: s.color }}>
                      {p.roomStats![s.key]} {s.label}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--rp-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--rp-text-muted)' }}>
                  <BedDouble size={13} /> {p._count?.rooms ?? 0} room{(p._count?.rooms ?? 0) !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(p)} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--rp-surface-2)', border: '1px solid var(--rp-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--rp-text)' }}>Edit</button>
                  <button onClick={() => setDeleteId(p.id)} style={{ fontSize: 12, padding: '4px 10px', background: 'transparent', border: '1px solid rgba(200,60,60,0.3)', borderRadius: 6, cursor: 'pointer', color: '#c43c3c' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <ModalShell
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Property' : 'Add Property'}
        description="Configure a resort property under your account"
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={closeModal} style={{ padding: '8px 16px', background: 'var(--rp-surface-2)', border: '1px solid var(--rp-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--rp-text)', fontSize: 13 }}>Cancel</button>
            <button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} style={{ padding: '8px 20px', background: '#1a6b5e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: (createMut.isPending || updateMut.isPending) ? 0.6 : 1 }}>
              {(createMut.isPending || updateMut.isPending) ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Property')}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Property Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: editingId ? f.slug : slugify(e.target.value) }))}
                placeholder="Beach Villa Resort"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Slug * (URL-friendly)</label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="beach-villa"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Address</label>
            <input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="123 Beach Road, Cox's Bazar"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Phone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+880 1700-000000"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Email</label>
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="info@beachvilla.com"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Timezone</label>
              <select
                value={form.timezone}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13 }}
              >
                <option value="Asia/Dhaka">Asia/Dhaka (BD)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IN)</option>
                <option value="Asia/Colombo">Asia/Colombo (LK)</option>
                <option value="Asia/Kathmandu">Asia/Kathmandu (NP)</option>
                <option value="Asia/Bangkok">Asia/Bangkok (TH)</option>
                <option value="Asia/Jakarta">Asia/Jakarta (ID)</option>
                <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (MY)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (KE)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Check-in Time</label>
              <input
                type="time"
                value={form.checkInTime}
                onChange={e => setForm(f => ({ ...f, checkInTime: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--rp-text-muted)', display: 'block', marginBottom: 6 }}>Check-out Time</label>
              <input
                type="time"
                value={form.checkOutTime}
                onChange={e => setForm(f => ({ ...f, checkOutTime: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--rp-border)', borderRadius: 8, background: 'var(--rp-canvas)', color: 'var(--rp-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Delete confirm */}
      {deleteId && (
        <ModalShell
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          title="Delete Property"
          description="This action cannot be undone."
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 16px', background: 'var(--rp-surface-2)', border: '1px solid var(--rp-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--rp-text)', fontSize: 13 }}>Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} style={{ padding: '8px 16px', background: '#c43c3c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--rp-text)', margin: 0 }}>
            Are you sure you want to delete this property? All rooms must be unassigned first.
          </p>
        </ModalShell>
      )}
    </div>
  );
}
