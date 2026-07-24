'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi, bookingsApi } from '@/lib/api';
import { ModalShell } from '@/components/ui/modal-shell';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Car, Bike, Loader2, Receipt, LogOut, LogIn, X,
} from 'lucide-react';

interface Vehicle {
  id: string;
  type: string;
  name: string;
  registrationNumber?: string;
  capacity?: number;
  hourlyRate?: number;
  dailyRate?: number;
  depositAmount?: number;
  availability: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';
  notes?: string;
}

interface Rental {
  id: string;
  vehicleId: string;
  guestName: string;
  guestPhone?: string;
  bookingId?: string | null;
  startAt: string;
  endAt: string;
  actualReturnAt?: string;
  status: 'RESERVED' | 'OUT' | 'RETURNED' | 'CANCELLED';
  rate: number;
  totalAmount?: number;
  depositCollected?: number;
  depositReturned?: number;
  billed: boolean;
  vehicle: { id: string; name: string; type: string };
}

interface ActiveBooking { id: string; confirmationNo: string; guest: { firstName: string; lastName: string }; room: { number: string } }

const VEHICLE_TYPES = ['CAR', 'BIKE', 'SCOOTY', 'BICYCLE', 'VAN', 'OTHER'] as const;

const TYPE_ICON: Record<string, typeof Car> = { CAR: Car, VAN: Car, BIKE: Bike, SCOOTY: Bike, BICYCLE: Bike, OTHER: Car };

const AVAIL_META: Record<string, { bg: string; text: string; label: string }> = {
  AVAILABLE:   { bg: 'var(--rp-teal-bg)', text: '#23766a', label: 'Available' },
  RENTED:      { bg: 'var(--rp-red-bg)', text: '#c43c3c', label: 'Rented' },
  MAINTENANCE: { bg: 'var(--rp-amber-bg)', text: '#b89040', label: 'Maintenance' },
};

const RENTAL_STATUS_META: Record<string, { bg: string; text: string }> = {
  RESERVED:  { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  OUT:       { bg: 'var(--rp-teal-bg)', text: '#23766a' },
  RETURNED:  { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)' },
  CANCELLED: { bg: 'var(--rp-red-bg)', text: '#c43c3c' },
};

const inputCls = 'w-full rounded-[8px] border border-black/5 bg-[#f4f1eb] px-3 py-[9px] text-[13px] text-[#18231f] placeholder:text-[#b5afa7] focus:outline-none focus:ring-2 focus:ring-[#23766a]/30';
const labelCls = 'block text-[11.5px] font-medium text-[#6b8880] mb-1.5';

function formatType(t: string) { return t.charAt(0) + t.slice(1).toLowerCase(); }

// ── Vehicle Modal ────────────────────────────────────────────────────────────
function VehicleModal({ open, onClose, loading, onSubmit, vehicle }: {
  open: boolean; onClose: () => void; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  vehicle?: Vehicle | null;
}) {
  const [form, setForm] = useState({ type: 'CAR', name: '', registrationNumber: '', capacity: '', hourlyRate: '', dailyRate: '', depositAmount: '', notes: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      setForm({
        type: vehicle?.type ?? 'CAR', name: vehicle?.name ?? '', registrationNumber: vehicle?.registrationNumber ?? '',
        capacity: vehicle?.capacity?.toString() ?? '', hourlyRate: vehicle?.hourlyRate?.toString() ?? '',
        dailyRate: vehicle?.dailyRate?.toString() ?? '', depositAmount: vehicle?.depositAmount?.toString() ?? '', notes: vehicle?.notes ?? '',
      });
    }
  }, [open, vehicle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast({ title: 'Vehicle name is required', variant: 'destructive' }); return; }
    onSubmit({
      type: form.type, name: form.name, registrationNumber: form.registrationNumber || undefined,
      capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
      hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
      dailyRate: form.dailyRate ? parseFloat(form.dailyRate) : undefined,
      depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <ModalShell open={open} onClose={onClose} title={vehicle ? 'Edit Vehicle' : 'Add Vehicle'} maxWidth="520px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button type="submit" form="veh-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {vehicle ? 'Save Changes' : 'Add Vehicle'}
          </button>
        </div>
      }>
      <form id="veh-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls + ' cursor-pointer'}>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{formatType(t)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Toyota Axio" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Registration Number</label>
            <input value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Seats <span style={{ color: 'var(--rp-text-faint)' }}>(optional)</span></label>
            <input value={form.capacity} onChange={e => set('capacity', e.target.value)} type="number" min="1" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Hourly Rate</label>
            <input value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Daily Rate</label>
            <input value={form.dailyRate} onChange={e => set('dailyRate', e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Deposit</label>
            <input value={form.depositAmount} onChange={e => set('depositAmount', e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
        </div>
      </form>
    </ModalShell>
  );
}

function FleetTab() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.list() });
  const vehicles: Vehicle[] = data?.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  const createMutation = useMutation({
    mutationFn: (d: unknown) => vehiclesApi.create(d),
    onSuccess: () => { invalidate(); toast({ title: 'Vehicle added' }); setAddOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => vehiclesApi.update(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Vehicle updated' }); setEditVehicle(null); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> Add Vehicle
        </button>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-[14px]" style={{ background: 'var(--rp-surface-2)' }} />
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border bg-white py-14 text-center" style={{ borderColor: 'var(--rp-border)' }}>
          <Car className="h-10 w-10" style={{ color: '#c5bdb4' }} />
          <p className="text-[13px]" style={{ color: 'var(--rp-text-muted)' }}>No vehicles in the fleet yet</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map(v => {
            const Icon = TYPE_ICON[v.type] ?? Car;
            const am = AVAIL_META[v.availability];
            return (
              <div key={v.id} className="rounded-[14px] border bg-white p-5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
                      <Icon className="h-4 w-4" style={{ color: '#23766a' }} />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#18231f] dark:text-[#dfd9d0]">{v.name}</p>
                      <p className="text-[11.5px] text-[#8aa29a] dark:text-[#94b8b0]">{formatType(v.type)}{v.registrationNumber ? ` · ${v.registrationNumber}` : ''}</p>
                    </div>
                  </div>
                  <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: am.bg, color: am.text }}>{am.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[12.5px] mt-3" style={{ color: 'var(--rp-text-muted)' }}>
                  {v.hourlyRate != null && <span>{formatCurrency(v.hourlyRate)}/hr</span>}
                  {v.dailyRate != null && <span>{formatCurrency(v.dailyRate)}/day</span>}
                  {v.depositAmount != null && <span>Deposit {formatCurrency(v.depositAmount)}</span>}
                </div>
                <button onClick={() => setEditVehicle(v)} className="mt-3 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Edit</button>
              </div>
            );
          })}
        </div>
      )}

      <VehicleModal open={addOpen} onClose={() => setAddOpen(false)} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <VehicleModal open={!!editVehicle} onClose={() => setEditVehicle(null)} vehicle={editVehicle} loading={updateMutation.isPending}
        onSubmit={d => editVehicle && updateMutation.mutate({ id: editVehicle.id, data: d })} />
    </div>
  );
}

// ── New Rental Modal ──────────────────────────────────────────────────────────
function NewRentalModal({ open, onClose, vehicles, activeBookings, loading, onSubmit }: {
  open: boolean; onClose: () => void; vehicles: Vehicle[]; activeBookings: ActiveBooking[]; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({ vehicleId: '', guestName: '', guestPhone: '', bookingId: '', startAt: '', endAt: '', rateType: 'HOURLY' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  useEffect(() => { if (open) setForm({ vehicleId: '', guestName: '', guestPhone: '', bookingId: '', startAt: '', endAt: '', rateType: 'HOURLY' }); }, [open]);

  const handleBookingSelect = (bookingId: string) => {
    set('bookingId', bookingId);
    const b = activeBookings.find(x => x.id === bookingId);
    if (b) set('guestName', `${b.guest.firstName} ${b.guest.lastName}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.guestName || !form.startAt || !form.endAt) {
      toast({ title: 'Vehicle, guest name, start and end are required', variant: 'destructive' }); return;
    }
    onSubmit({
      vehicleId: form.vehicleId, guestName: form.guestName, guestPhone: form.guestPhone || undefined,
      bookingId: form.bookingId || undefined,
      startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString(), rateType: form.rateType,
    });
  };

  return (
    <ModalShell open={open} onClose={onClose} title="New Rental" maxWidth="520px"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button type="submit" form="rental-form" disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Reserve
          </button>
        </div>
      }>
      <form id="rental-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Vehicle *</label>
          <select value={form.vehicleId} onChange={e => set('vehicleId', e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="">Select vehicle</option>
            {vehicles.filter(v => v.availability !== 'MAINTENANCE').map(v => <option key={v.id} value={v.id}>{v.name} ({formatType(v.type)})</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Link to a Room Booking <span style={{ color: 'var(--rp-text-faint)' }}>(optional — enables billing to room)</span></label>
          <select value={form.bookingId} onChange={e => handleBookingSelect(e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="">Not linked</option>
            {activeBookings.map(b => <option key={b.id} value={b.id}>{b.guest.firstName} {b.guest.lastName} — Room {b.room.number}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Guest Name *</label>
            <input value={form.guestName} onChange={e => set('guestName', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.guestPhone} onChange={e => set('guestPhone', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start *</label>
            <input value={form.startAt} onChange={e => set('startAt', e.target.value)} type="datetime-local" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End *</label>
            <input value={form.endAt} onChange={e => set('endAt', e.target.value)} type="datetime-local" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Rate</label>
          <div className="grid grid-cols-2 gap-2">
            {(['HOURLY', 'DAILY'] as const).map(r => (
              <button key={r} type="button" onClick={() => set('rateType', r)}
                className="rounded-[9px] border-2 p-2.5 text-[12.5px] font-medium"
                style={form.rateType === r ? { background: 'var(--rp-teal-bg)', borderColor: '#23766a', color: '#23766a' } : { background: 'var(--rp-surface-2)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-muted)' }}>
                {r === 'HOURLY' ? 'Hourly' : 'Daily'}
              </button>
            ))}
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Pickup / Return Modals ────────────────────────────────────────────────────
function PickupModal({ open, onClose, rental, deposit, loading, onSubmit }: {
  open: boolean; onClose: () => void; rental: Rental | null; deposit?: number; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [odometerOut, setOdometerOut] = useState('');
  const [fuelOut, setFuelOut] = useState('Full');
  const [conditionNotesOut, setConditionNotesOut] = useState('');
  const [depositCollected, setDepositCollected] = useState('');
  useEffect(() => { if (open) { setOdometerOut(''); setFuelOut('Full'); setConditionNotesOut(''); setDepositCollected(deposit != null ? String(deposit) : ''); } }, [open, deposit]);

  return (
    <ModalShell open={open} onClose={onClose} title="Mark Picked Up" description={rental ? `${rental.vehicle.name} — ${rental.guestName}` : ''} maxWidth="460px"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button onClick={() => onSubmit({ odometerOut: odometerOut ? parseInt(odometerOut, 10) : undefined, fuelOut, conditionNotesOut: conditionNotesOut || undefined, depositCollected: depositCollected ? parseFloat(depositCollected) : undefined })}
            disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} <LogOut className="h-3.5 w-3.5" /> Confirm Pickup
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Odometer</label>
            <input value={odometerOut} onChange={e => setOdometerOut(e.target.value)} type="number" min="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fuel Level</label>
            <input value={fuelOut} onChange={e => setFuelOut(e.target.value)} placeholder="Full, 3/4, Half…" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Deposit Collected</label>
          <input value={depositCollected} onChange={e => setDepositCollected(e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Condition Notes</label>
          <input value={conditionNotesOut} onChange={e => setConditionNotesOut(e.target.value)} placeholder="Small scratch on left door…" className={inputCls} />
        </div>
      </div>
    </ModalShell>
  );
}

function ReturnModal({ open, onClose, rental, loading, onSubmit }: {
  open: boolean; onClose: () => void; rental: Rental | null; loading: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [odometerIn, setOdometerIn] = useState('');
  const [fuelIn, setFuelIn] = useState('');
  const [conditionNotesIn, setConditionNotesIn] = useState('');
  const [depositReturned, setDepositReturned] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  useEffect(() => {
    if (open && rental) {
      setOdometerIn(''); setFuelIn(''); setConditionNotesIn('');
      setDepositReturned(rental.depositCollected != null ? String(rental.depositCollected) : '');
      setFinalAmount(rental.totalAmount != null ? String(rental.totalAmount) : '');
    }
  }, [open, rental]);

  return (
    <ModalShell open={open} onClose={onClose} title="Mark Returned" description={rental ? `${rental.vehicle.name} — ${rental.guestName}` : ''} maxWidth="460px"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="rounded-[9px] border px-4 py-2 text-[13px] font-medium hover:bg-[#f4f1eb]" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button onClick={() => onSubmit({
            odometerIn: odometerIn ? parseInt(odometerIn, 10) : undefined, fuelIn: fuelIn || undefined,
            conditionNotesIn: conditionNotesIn || undefined,
            depositReturned: depositReturned ? parseFloat(depositReturned) : undefined,
            finalAmount: finalAmount ? parseFloat(finalAmount) : undefined,
          })} disabled={loading} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} <LogIn className="h-3.5 w-3.5" /> Confirm Return
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Odometer</label>
            <input value={odometerIn} onChange={e => setOdometerIn(e.target.value)} type="number" min="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fuel Level</label>
            <input value={fuelIn} onChange={e => setFuelIn(e.target.value)} placeholder="Full, 3/4, Half…" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Final Amount</label>
            <input value={finalAmount} onChange={e => setFinalAmount(e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Deposit Returned</label>
            <input value={depositReturned} onChange={e => setDepositReturned(e.target.value)} type="number" min="0" step="0.01" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Damage / Condition Notes</label>
          <input value={conditionNotesIn} onChange={e => setConditionNotesIn(e.target.value)} placeholder="Any new damage…" className={inputCls} />
        </div>
      </div>
    </ModalShell>
  );
}

function RentalsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [pickupRental, setPickupRental] = useState<Rental | null>(null);
  const [returnRental, setReturnRental] = useState<Rental | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['vehicle-rentals', statusFilter], queryFn: () => vehiclesApi.rentals({ status: statusFilter || undefined }) });
  const { data: vehiclesData } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.list() });
  const { data: bookingsData } = useQuery({ queryKey: ['active-bookings-for-rental'], queryFn: () => bookingsApi.list({ status: 'CHECKED_IN', limit: 100 }) });

  const rentals: Rental[] = data?.data?.data ?? [];
  const vehicles: Vehicle[] = vehiclesData?.data?.data ?? [];
  const activeBookings: ActiveBooking[] = bookingsData?.data?.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['vehicle-rentals'] });
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  };

  const createMutation = useMutation({
    mutationFn: (d: unknown) => vehiclesApi.createRental(d),
    onSuccess: () => { invalidate(); toast({ title: 'Rental reserved' }); setAddOpen(false); },
    onError: (err: { response?: { data?: { error?: string } } }) => toast({ title: 'Error', description: err?.response?.data?.error ?? 'Failed to reserve', variant: 'destructive' }),
  });
  const outMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => vehiclesApi.markOut(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Marked as picked up' }); setPickupRental(null); },
  });
  const returnMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => vehiclesApi.markReturned(id, data),
    onSuccess: () => { invalidate(); toast({ title: 'Marked as returned' }); setReturnRental(null); },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => vehiclesApi.cancelRental(id),
    onSuccess: () => { invalidate(); toast({ title: 'Rental cancelled' }); },
  });
  const billMutation = useMutation({
    mutationFn: async (r: Rental) => {
      await bookingsApi.addInvoiceExtra(r.bookingId!, { description: `Vehicle rental: ${r.vehicle.name} (${formatDate(r.startAt)} – ${formatDate(r.endAt)})`, amount: r.totalAmount ?? 0, quantity: 1 });
      return vehiclesApi.markBilled(r.id);
    },
    onSuccess: () => { invalidate(); toast({ title: 'Added to guest bill' }); },
    onError: () => toast({ title: 'Error', description: 'Failed to bill — check the booking has an active invoice', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {['', 'RESERVED', 'OUT', 'RETURNED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={statusFilter === s ? { background: 'var(--rp-btn-accent)', borderColor: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' } : { background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)', color: 'var(--rp-text-subtle)' }}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-[9px] px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}>
          <Plus className="h-4 w-4" /> New Rental
        </button>
      </div>

      <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div className="h-32 animate-pulse" style={{ background: 'var(--rp-surface-2)' }} />
        ) : rentals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Car className="h-10 w-10" style={{ color: '#c5bdb4' }} />
            <p className="text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">No rentals yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--rp-surface-2)' }}>
                {['Vehicle', 'Guest', 'Period', 'Amount', 'Status', 'Billed', ''].map(h => <th key={h} className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8aa29a]">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rentals.map(r => {
                const sm = RENTAL_STATUS_META[r.status];
                const vehicle = vehicles.find(v => v.id === r.vehicleId);
                return (
                  <tr key={r.id} className="hover:bg-[#faf9f7] dark:hover:bg-white/5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{r.vehicle.name}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[#8aa29a] dark:text-[#94b8b0]">{r.guestName}</td>
                    <td className="px-5 py-3.5 text-[12.5px] text-[#8aa29a] dark:text-[#94b8b0]">{new Date(r.startAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} → {new Date(r.endAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#18231f] dark:text-[#dfd9d0]">{r.totalAmount != null ? formatCurrency(r.totalAmount) : '—'}</td>
                    <td className="px-5 py-3.5"><span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: sm.bg, color: sm.text }}>{r.status}</span></td>
                    <td className="px-5 py-3.5">
                      {r.billed ? <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: 'var(--rp-teal-bg)', color: '#23766a' }}>Billed</span>
                        : <span className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold" style={{ background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>Pending</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 flex-wrap">
                        {r.status === 'RESERVED' && (
                          <>
                            <button onClick={() => setPickupRental(r)} className="flex items-center gap-1 rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e3f2ef]" style={{ borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                              <LogOut className="h-3 w-3" /> Pickup
                            </button>
                            <button onClick={() => cancelMutation.mutate(r.id)} className="rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#faf0ee]" style={{ borderColor: 'rgba(200,60,60,0.2)', color: '#c43c3c' }}>
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        )}
                        {r.status === 'OUT' && (
                          <button onClick={() => setReturnRental(r)} className="flex items-center gap-1 rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e3f2ef]" style={{ borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                            <LogIn className="h-3 w-3" /> Return
                          </button>
                        )}
                        {!r.billed && r.bookingId && r.status === 'RETURNED' && (
                          <button onClick={() => billMutation.mutate(r)} className="flex items-center gap-1 rounded-[7px] border px-2.5 py-1 text-[11.5px] font-medium hover:bg-[#e3f2ef]" style={{ borderColor: 'rgba(35,118,106,0.2)', color: '#23766a' }}>
                            <Receipt className="h-3 w-3" /> Bill
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NewRentalModal open={addOpen} onClose={() => setAddOpen(false)} vehicles={vehicles} activeBookings={activeBookings} loading={createMutation.isPending} onSubmit={d => createMutation.mutate(d)} />
      <PickupModal open={!!pickupRental} onClose={() => setPickupRental(null)} rental={pickupRental}
        deposit={vehicles.find(v => v.id === pickupRental?.vehicleId)?.depositAmount} loading={outMutation.isPending}
        onSubmit={d => pickupRental && outMutation.mutate({ id: pickupRental.id, data: d })} />
      <ReturnModal open={!!returnRental} onClose={() => setReturnRental(null)} rental={returnRental} loading={returnMutation.isPending}
        onSubmit={d => returnRental && returnMutation.mutate({ id: returnRental.id, data: d })} />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function VehiclesPage() {
  const [tab, setTab] = useState<'fleet' | 'rentals'>('fleet');

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
          <Car className="h-4 w-4" style={{ color: '#23766a' }} />
        </div>
        <div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#18231f] dark:text-[#dfd9d0]">Vehicle Rental</h1>
          <p className="text-[13px] text-[#7a9890] dark:text-[#94b8b0]">Car, bike, scooty, cycle — rent to guests</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-[10px] p-1 w-fit" style={{ background: 'var(--rp-surface-3)' }}>
        {([{ key: 'fleet', label: 'Fleet' }, { key: 'rentals', label: 'Rentals' }] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="rounded-[8px] px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={tab === t.key ? { background: 'var(--rp-surface)', color: 'var(--rp-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: 'var(--rp-text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fleet' ? <FleetTab /> : <RentalsTab />}
    </div>
  );
}
