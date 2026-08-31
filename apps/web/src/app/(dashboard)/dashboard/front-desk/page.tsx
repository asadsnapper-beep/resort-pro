'use client';

import { ModalShell } from '@/components/ui/modal-shell';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { frontDeskApi, bookingsApi, roomsApi, ratePlansApi, guestsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth';
import {
  BedDouble, Users, Sparkles, Wrench, LogIn, LogOut, Clock,
  Plus, Phone, Banknote, LayoutGrid, List, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';
import { AddDocumentInline, type PendingDocument } from '@/components/guests/AddDocumentInline';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Guest { id: string; firstName: string; lastName: string; phone?: string; email?: string }
interface Room  { id: string; number: string; name: string; type: string; floor?: number }
interface Booking {
  id: string; confirmationNo: string; checkIn: string; checkOut: string;
  adults: number; children: number; totalAmount: number; paidAmount: number;
  paymentStatus: string; status: string; source: string; walkIn: boolean;
  specialRequests?: string; roomNotes?: string;
  guest: Guest; room: Room;
}
interface RoomMapRoom {
  id: string; number: string; name: string; type: string; status: string; floor?: number;
  basePrice: number; maxOccupancy: number;
  booking: (Booking & { guest: Guest }) | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, currency = 'BDT') {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}
function nights(ci: string, co: string) {
  return Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86_400_000);
}

const ROOM_STATUS_PILL: Record<string, { bg: string; border: string; text: string; label: string }> = {
  AVAILABLE:   { bg: 'var(--rp-teal-bg)', border: 'rgba(24,49,83,0.25)',  text: '#183153', label: 'Available'   },
  OCCUPIED:    { bg: 'var(--rp-amber-bg)', border: 'rgba(184,144,64,0.25)',  text: '#b89040', label: 'Occupied'    },
  CLEANING:    { bg: 'var(--rp-coral-bg)', border: 'rgba(184,114,74,0.25)',  text: '#b8724a', label: 'Cleaning'    },
  MAINTENANCE: { bg: 'var(--rp-red-bg)', border: 'rgba(200,60,60,0.2)',   text: '#c43c3c', label: 'Maintenance' },
  RESERVED:    { bg: '#f5f0fe', border: 'rgba(120,70,200,0.2)',  text: '#7846c8', label: 'Reserved'    },
};


function ModalInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-semibold text-[#183153]">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-[9px] border border-black/[0.07] bg-[#f5f4f1] px-4 py-[10px] text-[13px] text-[#183153] placeholder:text-[#64748b] focus:outline-none focus:ring-1 focus:ring-resort-600/25";

// ── Check-In Modal ─────────────────────────────────────────────────────────────
function CheckInModal({ booking, onClose, onSuccess }: { booking: Booking; onClose: () => void; onSuccess: () => void }) {
  const { tenant } = useAuthStore();
  const qc = useQueryClient();
  const [deposit, setDeposit]     = useState('');
  const [roomNotes, setRoomNotes] = useState('');
  const balance = Number(booking.totalAmount) - Number(booking.paidAmount);

  const mutation = useMutation({
    mutationFn: () => bookingsApi.checkIn(booking.id, { deposit: deposit ? Number(deposit) : undefined, roomNotes: roomNotes || undefined }),
    onSuccess: () => {
      toast({ title: 'Guest checked in!', description: `${booking.guest.firstName} ${booking.guest.lastName} — Room ${booking.room.number}` });
      qc.invalidateQueries({ queryKey: ['front-desk-today'] });
      qc.invalidateQueries({ queryKey: ['front-desk-map'] });
      onSuccess();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: e.response?.data?.error || 'Check-in failed', variant: 'destructive' }),
  });

  return (
    <ModalShell open={true} title="Check In" description={`${booking.guest.firstName} ${booking.guest.lastName}`} onClose={onClose} maxWidth="480px" footer={
      <>
        <button onClick={onClose} className="flex-1 rounded-[9px] border px-4 py-[10px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex-1 rounded-[9px] px-4 py-[10px] text-[13px] font-medium text-[#f8fafc] disabled:opacity-60" style={{ background: 'var(--rp-btn-accent)' }}>
          {mutation.isPending ? 'Checking in…' : 'Confirm Check-In'}
        </button>
      </>
    }>
      {/* Summary */}
      <div className="rounded-[12px] border p-4 space-y-2 text-[13px]" style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)' }}>
        {[
          ['Booking', `#${booking.confirmationNo}`],
          ['Room', `${booking.room.number} — ${booking.room.name}`],
          ['Stay', `${new Date(booking.checkIn).toLocaleDateString()} → ${new Date(booking.checkOut).toLocaleDateString()} (${nights(booking.checkIn, booking.checkOut)} nights)`],
          ['Guests', `${booking.adults} adults${booking.children > 0 ? `, ${booking.children} children` : ''}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-[#64748b]">{k}</span>
            <span className="font-medium text-[#183153]">{v}</span>
          </div>
        ))}
        {balance > 0 && (
          <div className="flex justify-between border-t pt-2 font-semibold" style={{ borderColor: 'var(--rp-border)', color: '#b89040' }}>
            <span>Balance due</span><span>{fmt(balance, tenant?.currency)}</span>
          </div>
        )}
      </div>
      <ModalInput label="Deposit collected (optional)">
        <div className="relative">
          <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
          <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0" className={`${inputCls} pl-9`} />
        </div>
      </ModalInput>
      <ModalInput label="Notes (key card, requests…)">
        <textarea value={roomNotes} onChange={e => setRoomNotes(e.target.value)} rows={2} placeholder="e.g. Key card #3 issued." className={`${inputCls} resize-none`} />
      </ModalInput>
      {booking.specialRequests && (
        <div className="rounded-[9px] border border-[rgba(184,144,64,0.2)] bg-[#f4ecda] p-3 text-[12px] text-[#b89040]">
          <span className="font-semibold">Special request: </span>{booking.specialRequests}
        </div>
      )}
    </ModalShell>
  );
}

/** One line of the server's bill calculation (GET /bookings/:id/bill). */
type BillLine = { sourceType: string; sourceId: string; description: string; quantity: number; total: number };
type Bill = {
  currency: string; nights: number; lines: BillLine[];
  roomTotal: number; packagesTotal: number; foodTotal: number; extrasTotal: number;
  subtotal: number; discountAmount: number; taxRate: number; taxAmount: number;
  grandTotal: number; paidAmount: number; balanceDue: number;
  warnings: { kind: string; sourceId: string; description: string; amount: number }[];
};

/** A bill line, expandable to the individual charges behind it — a guest who
 *  asks "what is this for?" should be answered at the desk, not by opening
 *  the invoice page. */
function BillRow({ label, amount, currency, detail }: { label: string; amount: number; currency?: string; detail?: BillLine[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-rp-muted">
          {label}
          {detail && detail.length > 0 && (
            <button type="button" onClick={() => setOpen(v => !v)} className="ml-1.5 text-rp-micro underline">
              {open ? 'hide' : `${detail.length} item${detail.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </span>
        <span className="text-rp-text">{fmt(amount, currency)}</span>
      </div>
      {open && detail?.map(d => (
        <div key={d.sourceId} className="flex justify-between pl-3 text-rp-micro text-rp-muted">
          <span className="truncate pr-2">{d.description}</span><span>{fmt(d.total, currency)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Check-Out Modal ────────────────────────────────────────────────────────────
function CheckOutModal({ booking, onClose, onSuccess }: { booking: Booking; onClose: () => void; onSuccess: () => void }) {
  const { tenant } = useAuthStore();
  const qc = useQueryClient();

  // The bill comes from the server's single calculation rather than being
  // re-derived here. This box used to show room-minus-paid: a guest who had
  // eaten, used the minibar or broken something settled the room and walked
  // out, and the rest sat unpaid on an invoice nobody opened.
  const { data: billData, isLoading: billLoading } = useQuery({
    queryKey: ['booking-bill', booking.id],
    queryFn: () => bookingsApi.bill(booking.id).then(r => r.data.data as Bill),
  });

  const balance = billData ? billData.balanceDue : Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));
  const [extraPayment, setExtraPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const n = billData?.nights ?? nights(booking.checkIn, booking.checkOut);

  // Prefill the collection box once the real balance is known, without
  // overwriting an amount the receptionist has already typed.
  const [touchedAmount, setTouchedAmount] = useState(false);

  // Adding a charge at check-out, rather than only from the invoice page.
  // "The guest broke a glass" is learned at this counter, at this moment —
  // making staff leave check-out, find the invoice page and come back means
  // on a busy desk the charge simply never gets added.
  const [showCharge, setShowCharge] = useState(false);
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');

  const addCharge = useMutation({
    mutationFn: () => bookingsApi.addInvoiceExtra(booking.id, {
      description: chargeDesc.trim(), amount: Number(chargeAmount),
    }),
    onSuccess: () => {
      // The balance must move with the charge, so re-read rather than patch
      // it locally — the server's calculation stays the only one.
      qc.invalidateQueries({ queryKey: ['booking-bill', booking.id] });
      setTouchedAmount(false);
      setChargeDesc(''); setChargeAmount(''); setShowCharge(false);
      toast({ title: 'Charge added' });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: e.response?.data?.error || 'Could not add the charge', variant: 'destructive' }),
  });
  useEffect(() => {
    if (!touchedAmount && billData) setExtraPayment(billData.balanceDue > 0 ? String(billData.balanceDue) : '');
  }, [billData, touchedAmount]);

  const mutation = useMutation({
    mutationFn: () => bookingsApi.checkOut(booking.id, { additionalPayment: extraPayment ? Number(extraPayment) : undefined, paymentMethod }),
    onSuccess: (res) => {
      const summary = (res as { data: { data: { checkoutSummary: { balanceDue: number } } } }).data?.data?.checkoutSummary;
      toast({ title: 'Checked out!', description: summary?.balanceDue ? `Balance remaining: ${fmt(summary.balanceDue, tenant?.currency)}` : 'All settled.' });
      qc.invalidateQueries({ queryKey: ['front-desk-today'] });
      qc.invalidateQueries({ queryKey: ['front-desk-map'] });
      onSuccess();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: e.response?.data?.error || 'Check-out failed', variant: 'destructive' }),
  });

  return (
    <ModalShell open={true} title="Check Out" description={`${booking.guest.firstName} ${booking.guest.lastName} · Room ${booking.room.number}`} onClose={onClose} maxWidth="480px" footer={
      <>
        <button onClick={onClose} className="flex-1 rounded-[9px] border px-4 py-[10px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="flex-1 rounded-[9px] px-4 py-[10px] text-[13px] font-medium text-[#f8fafc] disabled:opacity-60" style={{ background: 'var(--rp-btn-accent)' }}>
          {mutation.isPending ? 'Processing…' : 'Confirm Check-Out'}
        </button>
      </>
    }>
      <div className="rounded-[12px] border p-4 space-y-2 text-[13px]" style={{ background: 'var(--rp-surface-3)', borderColor: 'var(--rp-border)' }}>
        {billLoading && <p className="text-rp-muted">Loading bill…</p>}
        {billData && (
          <>
            <BillRow label={`Room (${n} night${n !== 1 ? 's' : ''})`} amount={billData.roomTotal} currency={billData.currency} />
            {billData.packagesTotal > 0 && <BillRow label="Packages" amount={billData.packagesTotal} currency={billData.currency} />}
            {billData.foodTotal > 0 && (
              <BillRow label="Food &amp; beverage" amount={billData.foodTotal} currency={billData.currency}
                detail={billData.lines.filter(l => l.sourceType === 'FOOD_ORDER')} />
            )}
            {billData.extrasTotal > 0 && (
              <BillRow label="Other charges" amount={billData.extrasTotal} currency={billData.currency}
                detail={billData.lines.filter(l => l.sourceType === 'EXTRA')} />
            )}
            {billData.discountAmount > 0 && <BillRow label="Discount" amount={-billData.discountAmount} currency={billData.currency} />}
            {billData.taxAmount > 0 && <BillRow label={`Tax (${billData.taxRate}%)`} amount={billData.taxAmount} currency={billData.currency} />}
            <div className="flex justify-between border-t pt-2 font-semibold" style={{ borderColor: 'var(--rp-border)' }}>
              <span className="text-rp-text">Total</span><span className="text-rp-text">{fmt(billData.grandTotal, billData.currency)}</span>
            </div>
            <div className="flex justify-between text-rp-text"><span>Already paid</span><span>-{fmt(billData.paidAmount, billData.currency)}</span></div>
            <div className={`flex justify-between border-t pt-2 text-[14px] font-bold ${balance > 0 ? 'text-rp-danger' : 'text-rp-text'}`} style={{ borderColor: 'var(--rp-border)' }}>
              <span>Balance due</span><span>{fmt(balance, billData.currency)}</span>
            </div>
          </>
        )}
      </div>

      {/* Food that has not reached the guest yet. Deliberately not decided for
          the desk: billing it charges for a meal nobody ate, dropping it
          silently loses real money. */}
      {billData && billData.warnings.length > 0 && (
        <div className="mt-3 rounded-rp-btn border border-rp-border-md bg-rp-amber-bg p-3 text-rp-body">
          <p className="font-semibold text-rp-text">
            {billData.warnings.length} food order{billData.warnings.length !== 1 ? 's' : ''} not delivered yet
          </p>
          <p className="text-rp-micro text-rp-muted">
            Not included in this bill ({fmt(billData.warnings.reduce((s, w) => s + w.amount, 0), billData.currency)}).
            Deliver or cancel them before checking out, or they go unpaid.
          </p>
        </div>
      )}

      {!showCharge ? (
        <button type="button" onClick={() => setShowCharge(true)}
          className="mt-3 w-full rounded-rp-ctrl border border-dashed border-rp-border-md py-[9px] text-rp-body font-medium text-rp-muted hover:text-rp-text">
          + Add charge
        </button>
      ) : (
        <div className="mt-3 rounded-rp-btn border border-rp-border-md p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {['Damage', 'Extra bed', 'Lost key', 'Laundry'].map(preset => (
              <button key={preset} type="button" onClick={() => setChargeDesc(preset)}
                className="rounded-rp-ctrl border border-rp-border-md px-2 py-[3px] text-rp-micro text-rp-muted hover:text-rp-text">
                {preset}
              </button>
            ))}
          </div>
          <input value={chargeDesc} onChange={e => setChargeDesc(e.target.value)}
            placeholder="What is this for?" className={`${inputCls} mb-2`} />
          {/* No preset amounts: a broken glass and a broken table are not the
              same money, and a wrong default is worse than an empty box. */}
          <input type="number" min="0" value={chargeAmount} onChange={e => setChargeAmount(e.target.value)}
            placeholder="Amount" className={`${inputCls} mb-2`} />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowCharge(false); setChargeDesc(''); setChargeAmount(''); }}
              className="flex-1 rounded-rp-ctrl border border-rp-border-md py-[7px] text-rp-meta font-medium text-rp-text">
              Cancel
            </button>
            <button type="button" onClick={() => addCharge.mutate()}
              disabled={addCharge.isPending || !chargeDesc.trim() || !(Number(chargeAmount) > 0)}
              className="flex-1 rounded-rp-ctrl bg-rp-btn-accent py-[7px] text-rp-meta font-medium text-rp-btn-accent-text disabled:opacity-50">
              {addCharge.isPending ? 'Adding…' : 'Add to bill'}
            </button>
          </div>
        </div>
      )}
      {balance > 0 && (
        <ModalInput label="Collect payment">
          <input type="number" value={extraPayment} onChange={e => { setTouchedAmount(true); setExtraPayment(e.target.value); }} placeholder={String(balance)} className={`${inputCls} mb-2`} />
          <div className="flex gap-2">
            {(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className="flex-1 rounded-[8px] border-2 py-[8px] text-[12px] font-semibold transition-all"
                style={paymentMethod === m
                  ? { borderColor: '#183153', background: 'var(--rp-teal-bg)', color: '#183153' }
                  : { borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                {m === 'CASH' ? '💵 Cash' : m === 'CARD' ? '💳 Card' : '🏦 Bank'}
              </button>
            ))}
          </div>
        </ModalInput>
      )}
    </ModalShell>
  );
}

/** A previous guest the phone number turned up, as returned by /guests/lookup. */
type GuestMatch = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  stayCount: number;
  lastStay: string | null;
};

// ── Walk-In Modal ──────────────────────────────────────────────────────────────
function WalkInModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { tenant } = useAuthStore();
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split('T')[0];
  const dayAfter = (d: string) => new Date(new Date(d).getTime() + 86_400_000).toISOString().split('T')[0];
  const tomorrowStr = dayAfter(todayStr);

  const [form, setForm] = useState({
    guestName: '', guestPhone: '', adults: 1, children: 0,
    roomId: '', checkIn: todayStr, checkOut: tomorrowStr,
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'LATER',
    advanceAmount: '', roomNotes: '',
  });
  const [pendingDoc, setPendingDoc] = useState<PendingDocument | null>(null);
  const [showDocPicker, setShowDocPicker] = useState(false);

  // ── Returning-guest lookup ────────────────────────────────────────────────
  // Most walk-ins are people who have stayed before. Surfacing that here,
  // before the booking exists, is what lets the desk put the stay on their
  // real record instead of a fourth copy of the same person — which is what
  // used to happen silently on every visit.
  const [linkedGuest, setLinkedGuest] = useState<GuestMatch | null>(null);
  const [dismissedPhone, setDismissedPhone] = useState<string | null>(null);
  const [debouncedPhone, setDebouncedPhone] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhone(form.guestPhone), 350);
    return () => clearTimeout(t);
  }, [form.guestPhone]);

  const phoneDigits = debouncedPhone.replace(/\D/g, '');
  const { data: guestMatches } = useQuery({
    queryKey: ['guest-lookup', phoneDigits],
    // Seven digits is the server's floor too: below that a "phone number" is
    // a room number or a half-typed field, and matching on it finds strangers.
    enabled: phoneDigits.length >= 7 && !linkedGuest,
    queryFn: () => guestsApi.lookup(debouncedPhone).then(r => (r.data.data as { matches: GuestMatch[] }).matches),
  });
  const suggestedGuest = !linkedGuest && dismissedPhone !== phoneDigits ? guestMatches?.[0] ?? null : null;

  // A walk-in stored with a one-word name has "-" as its last name; that is a
  // placeholder, not something to show a guest or write back into the field.
  const displayName = (g: GuestMatch) => `${g.firstName} ${g.lastName}`.replace(/ -$/, '').trim();

  const linkGuest = (g: GuestMatch) => {
    setLinkedGuest(g);
    // Adopt the stored spelling: the record is the name of account, and the
    // desk has just confirmed this is the same person.
    setForm(f => ({ ...f, guestName: displayName(g) }));
  };

  const unlinkGuest = () => {
    setLinkedGuest(null);
    // Remember the refusal, or the suggestion reappears on the next keystroke.
    setDismissedPhone(phoneDigits);
  };

  const { data: roomData } = useQuery({
    queryKey: ['rooms-available', form.checkIn, form.checkOut],
    queryFn: () => roomsApi.availability(form.checkIn, form.checkOut).then(r => r.data.data),
  });

  const n = nights(form.checkIn, form.checkOut);
  const selectedRoom = (roomData as { id: string; number: string; name: string; basePrice: number }[] | undefined)?.find(r => r.id === form.roomId);

  // Rate-plan-aware price preview — mirrors what the backend will actually
  // charge (resolveRate), so staff aren't quoting a base-price estimate that
  // turns out wrong once a seasonal/weekend/promo plan kicks in.
  const { data: rateResolved } = useQuery({
    queryKey: ['walkin-rate-resolve', form.roomId, form.checkIn, form.checkOut],
    queryFn: () => ratePlansApi.resolve(form.roomId, form.checkIn, form.checkOut).then(r => r.data.data),
    enabled: !!form.roomId && !!form.checkIn && !!form.checkOut && form.checkOut > form.checkIn,
  });
  const effectiveNightlyRate = (rateResolved as { effectivePrice?: number } | undefined)?.effectivePrice
    ?? (selectedRoom ? Number(selectedRoom.basePrice) : 0);
  const activePlanName = (rateResolved as { resolved?: { planName?: string } | null } | undefined)?.resolved?.planName ?? null;
  const estimatedTotal = selectedRoom ? effectiveNightlyRate * Math.max(n, 1) : 0;
  // "Later" never records a payment on the backend (see /walk-in), so an
  // amount typed here before switching to Later must not be shown as paid —
  // selectPaymentMethod() below already clears it, this is defense in depth.
  const advanceNum = form.paymentMethod !== 'LATER' && form.advanceAmount ? Number(form.advanceAmount) : 0;
  const balanceDue = Math.max(0, estimatedTotal - advanceNum);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await bookingsApi.walkIn({ ...form, advanceAmount: advanceNum || undefined, guestId: linkedGuest?.id });
      const booking = res.data.data as { id: string; guestId: string };
      // Document is attached after the guest/booking actually exist —
      // best-effort: a failed upload shouldn't undo an otherwise-successful
      // check-in, so it's swallowed rather than surfaced as the main error.
      if (pendingDoc) {
        const docForm = new FormData();
        docForm.append('file', pendingDoc.file);
        docForm.append('docType', pendingDoc.docType);
        docForm.append('bookingId', booking.id);
        await guestsApi.uploadDocument(booking.guestId, docForm).catch(() => {
          toast({ title: 'Checked in, but document upload failed', description: 'You can add it later from the guest profile.', variant: 'destructive' });
        });
      }
      return res;
    },
    onSuccess: () => {
      toast({ title: 'Walk-in checked in!', description: `${form.guestName} — Room assigned` });
      qc.invalidateQueries({ queryKey: ['front-desk-today'] });
      qc.invalidateQueries({ queryKey: ['front-desk-map'] });
      onSuccess();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Error', description: e.response?.data?.error || 'Walk-in failed', variant: 'destructive' }),
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Changing check-in keeps check-out one night later unless the guest has
  // already pushed check-out further out than that — and check-out can
  // never land on or before check-in (min enforces this in the input too).
  const setCheckIn = (ci: string) => {
    setForm(f => ({ ...f, checkIn: ci, checkOut: f.checkOut > ci ? f.checkOut : dayAfter(ci) }));
  };

  // Switching to "Later" clears any typed advance — the backend never
  // records a payment for LATER, so leaving a stale amount here would show
  // staff a "paid" balance that was never actually collected.
  const selectPaymentMethod = (m: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'LATER') => {
    setForm(f => ({ ...f, paymentMethod: m, advanceAmount: m === 'LATER' ? '' : f.advanceAmount }));
  };

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title="New Walk-In"
      maxWidth="520px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="flex-1 rounded-[9px] border px-4 py-[10px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text)' }}>Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.guestName || !form.roomId}
            className="flex-1 rounded-[9px] px-4 py-[10px] text-[13px] font-medium text-[#f8fafc] disabled:opacity-50" style={{ background: 'var(--rp-btn-accent)' }}>
            {mutation.isPending ? 'Checking in…' : 'Check In Guest'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex items-end gap-2">
              <div className="flex-1">
                <ModalInput label="Guest name *">
                  <input value={form.guestName} onChange={e => set('guestName', e.target.value)} placeholder="Rahman Ahmed" className={inputCls} />
                </ModalInput>
              </div>
              <button type="button" onClick={() => setShowDocPicker(v => !v)}
                className={`flex items-center gap-1.5 rounded-rp-ctrl border-2 px-3 py-[10px] text-rp-meta font-semibold shrink-0 transition-all ${
                  pendingDoc ? 'border-rp-brand bg-rp-teal-bg text-rp-brand' : 'border-rp-border-md text-rp-muted'
                }`}>
                {pendingDoc ? 'Document added' : '+ Add Document'}
              </button>
            </div>
            {showDocPicker && (
              <div className="col-span-2">
                <AddDocumentInline value={pendingDoc} onChange={setPendingDoc} />
              </div>
            )}
            <ModalInput label="Phone">
              <input value={form.guestPhone} onChange={e => set('guestPhone', e.target.value)} placeholder="01712-345678" className={inputCls} />
            </ModalInput>
            {(suggestedGuest || linkedGuest) && (
              <div className="col-span-2 order-last rounded-rp-btn border border-rp-border-md bg-rp-teal-bg p-3 text-rp-body">
                {linkedGuest ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-rp-text">
                        Returning guest — {displayName(linkedGuest)}
                      </p>
                      <p className="text-rp-micro text-rp-muted">
                        This stay will be added to their existing record.
                      </p>
                    </div>
                    <button type="button" onClick={unlinkGuest}
                      className="shrink-0 rounded-rp-ctrl border border-rp-border-md px-3 py-[6px] text-rp-micro font-semibold text-rp-text">
                      Not them
                    </button>
                  </div>
                ) : suggestedGuest && (
                  <div className="space-y-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-rp-text">
                        {displayName(suggestedGuest)} has this number
                      </p>
                      <p className="text-rp-micro text-rp-muted">
                        {suggestedGuest.stayCount > 0
                          ? `${suggestedGuest.stayCount} previous stay${suggestedGuest.stayCount === 1 ? '' : 's'}`
                          : 'On file, no completed stays yet'}
                        {suggestedGuest.lastStay
                          ? ` · last ${new Date(suggestedGuest.lastStay).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => linkGuest(suggestedGuest)}
                        className="rounded-rp-ctrl bg-rp-btn-accent px-3 py-[6px] text-rp-micro font-semibold text-rp-btn-accent-text">
                        Same guest
                      </button>
                      <button type="button" onClick={() => setDismissedPhone(phoneDigits)}
                        className="rounded-rp-ctrl border border-rp-border-md px-3 py-[6px] text-rp-micro font-semibold text-rp-text">
                        Someone new
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <ModalInput label="Adults">
                <input type="number" min={1} value={form.adults} onChange={e => set('adults', Number(e.target.value))} className={inputCls} />
              </ModalInput>
              <ModalInput label="Children">
                <input type="number" min={0} value={form.children} onChange={e => set('children', Number(e.target.value))} className={inputCls} />
              </ModalInput>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ModalInput label="Check-in">
              <input type="date" value={form.checkIn} min={todayStr} onChange={e => setCheckIn(e.target.value)} className={inputCls} />
            </ModalInput>
            <ModalInput label="Check-out">
              <input type="date" value={form.checkOut} min={dayAfter(form.checkIn)} onChange={e => set('checkOut', e.target.value)} className={inputCls} />
            </ModalInput>
          </div>
          <ModalInput label="Room *">
            <select value={form.roomId} onChange={e => set('roomId', e.target.value)} className={`${inputCls} bg-[#f5f4f1]`}>
              <option value="">Select available room…</option>
              {(roomData as { id: string; number: string; name: string; basePrice: number }[] | undefined)?.map(r => (
                <option key={r.id} value={r.id}>Room {r.number} — {r.name} ({fmt(Number(r.basePrice), tenant?.currency)}/night)</option>
              ))}
            </select>
          </ModalInput>
          {estimatedTotal > 0 && (
            <div className="rounded-[10px] border p-3 text-[13px] space-y-1.5" style={{ background: 'var(--rp-teal-bg)', borderColor: 'rgba(24,49,83,0.2)' }}>
              <div className="flex justify-between">
                <span className="text-[#183153]">{n} night{n !== 1 ? 's' : ''} × {fmt(effectiveNightlyRate, tenant?.currency)}</span>
                <span className="font-bold text-[#183153]">{fmt(estimatedTotal, tenant?.currency)}</span>
              </div>
              {activePlanName && (
                <p className="text-rp-micro font-medium text-rp-brand">Rate plan applied: {activePlanName}</p>
              )}
              {advanceNum > 0 && (
                <>
                  <div className="flex justify-between text-rp-text">
                    <span>Advance paid</span><span>-{fmt(advanceNum, tenant?.currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-rp-border-md pt-1.5 font-bold text-rp-text">
                    <span>Balance due</span><span>{fmt(balanceDue, tenant?.currency)}</span>
                  </div>
                </>
              )}
            </div>
          )}
          <ModalInput label="Advance payment">
            <input type="number" value={form.advanceAmount} onChange={e => set('advanceAmount', e.target.value)} placeholder="0" className={`${inputCls} mb-2`} />
            <div className="flex gap-2">
              {(['CASH', 'CARD', 'BANK_TRANSFER', 'LATER'] as const).map(m => (
                <button key={m} onClick={() => selectPaymentMethod(m)}
                  className="flex-1 rounded-[8px] border-2 py-[7px] text-[11.5px] font-semibold transition-all"
                  style={form.paymentMethod === m
                    ? { borderColor: '#183153', background: 'var(--rp-teal-bg)', color: '#183153' }
                    : { borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
                  {m === 'CASH' ? '💵' : m === 'CARD' ? '💳' : m === 'BANK_TRANSFER' ? '🏦' : '⏳'} {m === 'BANK_TRANSFER' ? 'Bank' : m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </ModalInput>
          <ModalInput label="Notes">
            <textarea value={form.roomNotes} onChange={e => set('roomNotes', e.target.value)} rows={2} placeholder="Key card issued, special requests…" className={`${inputCls} resize-none`} />
          </ModalInput>
      </div>
    </ModalShell>
  );
}

// ── Booking Card ───────────────────────────────────────────────────────────────
function BookingCard({ booking, onCheckIn, onCheckOut }: { booking: Booking; onCheckIn?: () => void; onCheckOut?: () => void }) {
  const { tenant } = useAuthStore();
  const balance = Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));
  const n = nights(booking.checkIn, booking.checkOut);

  return (
    <div className="rounded-[14px] border p-4 transition-shadow hover:shadow-sm bg-white dark:bg-white/5"
      style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[14px] font-semibold text-[#183153]">{booking.guest.firstName} {booking.guest.lastName}</span>
            {booking.walkIn && (
              <span className="rounded-[6px] border border-[rgba(184,144,64,0.2)] bg-[#f4ecda] px-[8px] py-[3px] text-[10.5px] font-bold text-[#b89040]">Walk-in</span>
            )}
            {booking.source === 'BOOKING_COM' && (
              <span className="rounded-[6px] bg-[#e5f0f7] px-[8px] py-[3px] text-[10.5px] font-bold text-[#183153]">Booking.com</span>
            )}
            {booking.source === 'AIRBNB' && (
              <span className="rounded-[6px] bg-[#fceee4] px-[8px] py-[3px] text-[10.5px] font-bold text-[#b8724a]">Airbnb</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-[#64748b]">
            <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />Room {booking.room.number}</span>
            {booking.guest.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{booking.guest.phone}</span>}
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{booking.adults + booking.children} guests</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{n} night{n !== 1 ? 's' : ''}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11.5px] text-[#b6c9d7]">
            <span>#{booking.confirmationNo}</span>
            <span>{new Date(booking.checkIn).toLocaleDateString()} → {new Date(booking.checkOut).toLocaleDateString()}</span>
          </div>
          {balance > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-[7px] border border-[rgba(184,144,64,0.2)] bg-[#f4ecda] px-[10px] py-[4px] text-[11.5px] font-semibold text-[#b89040]">
              <AlertTriangle className="h-3 w-3" />{fmt(balance, tenant?.currency)} due
            </div>
          )}
          {booking.specialRequests && (
            <p className="mt-1.5 text-[11.5px] text-[#b6c9d7] truncate">📝 {booking.specialRequests}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {onCheckIn && (
            <button onClick={onCheckIn}
              className="flex items-center gap-1.5 rounded-[8px] px-[12px] py-[7px] text-[12px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80"
              style={{ background: 'var(--rp-btn-accent)' }}>
              <LogIn className="h-3.5 w-3.5" /> Check In
            </button>
          )}
          {onCheckOut && (
            <button onClick={onCheckOut}
              className="flex items-center gap-1.5 rounded-[8px] border px-[12px] py-[7px] text-[12px] font-medium transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
              style={{ borderColor: 'rgba(0,0,0,0.1)', color: 'var(--rp-text)' }}>
              <LogOut className="h-3.5 w-3.5" /> Check Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Room Map ───────────────────────────────────────────────────────────────────
function RoomMap({ onCheckIn, onCheckOut }: { onCheckIn: (b: Booking) => void; onCheckOut: (b: Booking) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['front-desk-map'],
    queryFn: () => frontDeskApi.roomMap().then(r => r.data.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="py-16 text-center text-[13px] text-[#64748b]">Loading room map…</div>;
  const floors = (data as { floors: { floor: number; rooms: RoomMapRoom[] }[] } | undefined)?.floors ?? [];

  return (
    <div className="space-y-8">
      {floors.map(({ floor, rooms }) => (
        <div key={floor}>
          <h3 className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#64748b]">Floor {floor}</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rooms.map(room => {
              const s = ROOM_STATUS_PILL[room.status] ?? ROOM_STATUS_PILL.AVAILABLE;
              return (
                <div key={room.id} className="rounded-[12px] border p-3 select-none"
                  style={{ background: s.bg, borderColor: s.border }}>
                  <div className="text-[16px] font-bold leading-none" style={{ color: s.text }}>{room.number}</div>
                  <div className="mt-0.5 truncate text-[11px] opacity-70" style={{ color: s.text }}>{room.name}</div>
                  <div className="mt-1.5 text-[10.5px] font-semibold" style={{ color: s.text }}>{s.label}</div>
                  {room.booking && (
                    <div className="mt-1 truncate text-[11px] opacity-75" style={{ color: s.text }}>
                      {room.booking.guest.firstName} {room.booking.guest.lastName}
                    </div>
                  )}
                  {room.booking?.status === 'CONFIRMED' && (
                    <button onClick={() => onCheckIn(room.booking as unknown as Booking)}
                      className="mt-2 w-full rounded-[7px] py-[5px] text-[11px] font-semibold text-[#f8fafc] transition-opacity hover:opacity-80"
                      style={{ background: 'var(--rp-btn-accent)' }}>Check In</button>
                  )}
                  {room.booking?.status === 'CHECKED_IN' && (
                    <button onClick={() => onCheckOut(room.booking as unknown as Booking)}
                      className="mt-2 w-full rounded-[7px] border py-[5px] text-[11px] font-semibold transition-colors hover:bg-white/30"
                      style={{ borderColor: s.border, color: s.text }}>Check Out</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {floors.length === 0 && <div className="py-12 text-center text-[13px] text-[#64748b]">No rooms found</div>}
      {/* Legend */}
      <div className="flex flex-wrap gap-2 border-t pt-5" style={{ borderColor: 'var(--rp-border)' }}>
        {Object.entries(ROOM_STATUS_PILL).map(([, s]) => (
          <span key={s.label} className="rounded-[7px] border px-[10px] py-[5px] text-[11px] font-semibold"
            style={{ background: s.bg, borderColor: s.border, color: s.text }}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FrontDeskPage() {
  const [tab,         setTab]         = useState<'arrivals' | 'departures' | 'inhouse'>('arrivals');
  const [view,        setView]        = useState<'list' | 'map'>('list');
  const [checkInFor,  setCheckInFor]  = useState<Booking | null>(null);
  const [checkOutFor, setCheckOutFor] = useState<Booking | null>(null);
  const [walkInOpen,  setWalkInOpen]  = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['front-desk-today'],
    queryFn: () => frontDeskApi.today().then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const d = data as {
    date: string;
    roomStats: { total: number; occupied: number; available: number; cleaning: number; maintenance: number };
    totalGuests: number;
    arrivals:   { count: number; pending: number; bookings: Booking[] };
    departures: { count: number; pending: number; bookings: Booking[] };
    inHouse:    { count: number; bookings: Booking[] };
  } | undefined;

  const stats = d?.roomStats;

  const STAT_CARDS = [
    { label: 'Total Rooms', value: stats?.total,       bg: 'var(--rp-surface-3)', color: 'var(--rp-text)', icon: BedDouble },
    { label: 'Occupied',    value: stats?.occupied,    bg: 'var(--rp-amber-bg)', color: '#b89040', icon: Users     },
    { label: 'Available',   value: stats?.available,   bg: 'var(--rp-teal-bg)', color: '#183153', icon: Sparkles  },
    { label: 'Cleaning',    value: stats?.cleaning,    bg: 'var(--rp-coral-bg)', color: '#b8724a', icon: Sparkles  },
    { label: 'Maintenance', value: stats?.maintenance, bg: 'var(--rp-red-bg)', color: '#c43c3c', icon: Wrench    },
  ];

  const TABS = [
    { id: 'arrivals'   as const, label: 'Arrivals',   count: d?.arrivals.count,   pending: d?.arrivals.pending   },
    { id: 'departures' as const, label: 'Departures', count: d?.departures.count, pending: d?.departures.pending },
    { id: 'inhouse'    as const, label: 'In-House',   count: d?.inHouse.count,    pending: undefined              },
  ];

  const currentBookings =
    tab === 'arrivals'   ? d?.arrivals.bookings   :
    tab === 'departures' ? d?.departures.bookings  :
    d?.inHouse.bookings ?? [];

  if (isLoading) return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e5f0f7] border-t-[#183153]" />
    </div>
  );

  return (
    <PageShell gap={4}>
      {/* Header */}
      <PageHeader
        title="Front Desk"
        subtitle={
          <>
            {d?.date ? new Date(d.date).toLocaleDateString('en-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            {d?.totalGuests ? ` · ${d.totalGuests} guests in-house` : ''}
          </>
        }
        align="end"
        actions={
          <div className="flex items-center gap-2">
          <button onClick={() => refetch()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border transition-colors hover:bg-[#faf9f7] dark:hover:bg-white/5"
            style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-muted)' }}>
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="flex overflow-hidden rounded-[9px] border" style={{ borderColor: 'var(--rp-border-md)' }}>
            <button onClick={() => setView('list')}
              className="px-3 py-[9px] text-[12.5px] font-medium transition-colors"
              style={view === 'list' ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' } : { color: 'var(--rp-text-muted)' }}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView('map')}
              className="px-3 py-[9px] text-[12.5px] font-medium transition-colors"
              style={view === 'map' ? { background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' } : { color: 'var(--rp-text-muted)' }}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setWalkInOpen(true)}
            className="flex items-center gap-1.5 rounded-[9px] px-4 py-[9px] text-[13px] font-medium text-[#f8fafc] transition-opacity hover:opacity-80"
            style={{ background: 'var(--rp-btn-accent)' }}>
            <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} /> Walk-In
          </button>
          </div>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map(({ label, value, bg, color, icon: Icon }) => (
          <div key={label} className="flex items-center gap-[11px] rounded-[12px] border px-[16px] py-[13px] bg-white dark:bg-white/5"
            style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px]" style={{ background: bg }}>
              <Icon className="h-[13px] w-[13px]" strokeWidth={2} style={{ color }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[#64748b]">{label}</div>
              <div className="text-[20px] font-semibold leading-none tracking-[-0.02em] text-[#183153]">{value ?? 0}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Arrivals quick-stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Today's Arrivals",   value: d?.arrivals.count,   sub: `${d?.arrivals.pending ?? 0} pending`,   bg: '#183153', text: '#f8fafc', sub2: 'var(--rp-text-accent)' },
          { label: "Today's Departures", value: d?.departures.count, sub: `${d?.departures.pending ?? 0} pending`, bg: '#183153', text: 'var(--rp-teal-bg)', sub2: '#91adbf' },
          { label: 'Guests In-House',    value: d?.inHouse.count,    sub: `${d?.totalGuests ?? 0} total guests`,  bg: 'var(--rp-amber-bg)', text: 'var(--rp-text)', sub2: 'var(--rp-text-muted)' },
        ].map(({ label, value, sub, bg, text, sub2 }) => (
          <div key={label} className="rounded-[14px] p-5" style={{ background: bg }}>
            <div className="text-[38px] font-semibold leading-none tracking-[-0.03em]" style={{ color: text }}>{value ?? 0}</div>
            <div className="mt-[6px] text-[12.5px] font-semibold" style={{ color: text }}>{label}</div>
            <div className="mt-[2px] text-[11.5px]" style={{ color: sub2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Content: List or Map */}
      {view === 'map' ? (
        <div className="rounded-[14px] border p-6 bg-white dark:bg-white/5"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <h2 className="mb-6 text-[13px] font-semibold text-[#183153]">Room Map</h2>
          <RoomMap onCheckIn={b => setCheckInFor(b)} onCheckOut={b => setCheckOutFor(b)} />
        </div>
      ) : (
        <div className="rounded-[14px] border overflow-hidden bg-white dark:bg-white/5"
          style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          {/* Tabs */}
          <div className="flex border-b px-4" style={{ borderColor: 'var(--rp-border)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-2 border-b-2 px-4 py-4 text-[13px] font-medium transition-colors"
                style={tab === t.id
                  ? { borderColor: '#183153', color: '#183153' }
                  : { borderColor: 'transparent', color: 'var(--rp-text-muted)' }}>
                {t.label}
                {t.count !== undefined && (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={tab === t.id ? { background: 'var(--rp-teal-bg)', color: '#183153' } : { background: 'var(--rp-surface-3)', color: 'var(--rp-text-muted)' }}>
                    {t.count}
                  </span>
                )}
                {(t.pending ?? 0) > 0 && (
                  <span className="rounded-full bg-[#f4ecda] px-1.5 py-0.5 text-[10.5px] font-bold text-[#b89040]">
                    {t.pending} pending
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="space-y-2.5 p-4">
            {(currentBookings?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f4f1]">
                  <BedDouble className="h-6 w-6 text-[#94a3b8]" />
                </div>
                <p className="text-[13px] text-[#64748b]">
                  {tab === 'arrivals' ? 'No arrivals today' : tab === 'departures' ? 'No departures today' : 'No guests currently in-house'}
                </p>
              </div>
            ) : (
              (currentBookings ?? []).map(b => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onCheckIn={tab === 'arrivals'   ? () => setCheckInFor(b)  : undefined}
                  onCheckOut={tab === 'departures' || tab === 'inhouse' ? () => setCheckOutFor(b) : undefined}
                />
              ))
            )}
          </div>
        </div>
      )}

      {checkInFor  && <CheckInModal  booking={checkInFor}  onClose={() => setCheckInFor(null)}  onSuccess={() => setCheckInFor(null)}  />}
      {checkOutFor && <CheckOutModal booking={checkOutFor} onClose={() => setCheckOutFor(null)} onSuccess={() => setCheckOutFor(null)} />}
      {walkInOpen  && <WalkInModal onClose={() => setWalkInOpen(false)} onSuccess={() => setWalkInOpen(false)} />}
    </PageShell>
  );
}
