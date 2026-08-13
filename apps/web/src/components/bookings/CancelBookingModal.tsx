'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ModalShell } from '@/components/ui/modal-shell';
import { formatCurrency } from '@/lib/utils';

const REASONS = [
  'Guest changed travel plans',
  'Guest found a better rate elsewhere',
  'Duplicate booking',
  'Payment issue',
  'Resort-initiated (overbooking / maintenance)',
  'Other',
];

const NO_SHOW_REASONS = [
  'Guest did not arrive',
  'Guest did not call ahead',
  'Other',
];

const REFUND_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
  { value: 'CARD', label: 'Card' },
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'OTHER', label: 'Other' },
];

export interface CancelBookingPayload {
  reason?: string;
  cancellationFee?: number;
  refund?: { amount: number; method: string; reference?: string; note?: string };
  notifyGuest?: boolean;
  isNoShow?: boolean;
}

/**
 * CancelBookingModal — reason, cancellation fee, and a manual refund record.
 * No payment-gateway refund call yet (v1) — this just books an auditable
 * Payment row (negative amount, REFUNDED status) alongside the cancellation.
 *
 * Pass `isNoShow` to reuse this same fee/refund flow for a guest who simply
 * never arrived — the backend records a distinct NO_SHOW status instead of
 * CANCELLED (see PATCH /:id/cancel), but the fee/refund handling is identical.
 */
export function CancelBookingModal({
  open,
  onClose,
  onConfirm,
  paidAmount,
  loading,
  isNoShow = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: CancelBookingPayload) => void;
  /** Amount already paid on this booking — caps the refund and seeds the default. */
  paidAmount: number;
  loading: boolean;
  /** Reuse this modal for marking a confirmed booking as a no-show. */
  isNoShow?: boolean;
}) {
  const reasonOptions = isNoShow ? NO_SHOW_REASONS : REASONS;
  const [reason, setReason] = useState(reasonOptions[0]);
  const [customReason, setCustomReason] = useState('');
  const [fee, setFee] = useState('0');
  const [refundAmount, setRefundAmount] = useState(String(paidAmount));
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [refundReference, setRefundReference] = useState('');
  const [notifyGuest, setNotifyGuest] = useState(true);
  const [error, setError] = useState('');

  const feeNum = Math.max(0, Number(fee) || 0);
  const refundNum = Math.max(0, Number(refundAmount) || 0);
  const maxRefundable = Math.max(0, paidAmount - feeNum);

  function handleSubmit() {
    if (refundNum > paidAmount) {
      setError(`Refund can't exceed the amount already paid (${formatCurrency(paidAmount)}).`);
      return;
    }
    setError('');
    onConfirm({
      reason: reason === 'Other' ? (customReason || 'Other') : reason,
      // Was `feeNum || undefined` — 0 is the common, default "no fee"
      // case, and 0 is falsy in JS, so that omitted the field from every
      // request where staff didn't charge a fee. Prisma's update treats an
      // undefined field as "leave unchanged," not "set to 0," so
      // cancellationFee stayed NULL forever on the vast majority of
      // cancellations (confirmed via direct DB check after cancelling a
      // test booking with fee=0: cancellationFee was NULL, not 0). feeNum
      // is always >= 0 (Math.max(0, ...) above), so just send it plainly.
      cancellationFee: feeNum,
      refund: refundNum > 0 ? { amount: refundNum, method: refundMethod, reference: refundReference || undefined } : undefined,
      notifyGuest,
      isNoShow: isNoShow || undefined,
    });
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isNoShow ? 'Mark as no-show' : 'Cancel booking'}
      description={isNoShow ? "The guest never arrived — this releases the room. Can't be undone." : "This can't be undone — the room and dates will be released."}
      variant="resort"
      maxWidth="480px"
      showCloseButton={!loading}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
            Go back
          </button>
          <button onClick={handleSubmit} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isNoShow ? 'Mark no-show' : 'Cancel booking'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wide">This can&apos;t be undone</span>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">{isNoShow ? 'No-show reason' : 'Cancellation reason'}</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
            {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {reason === 'Other' && (
            <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Describe the reason…" className="mt-2 h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          )}
        </label>

        <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Already paid</span>
          <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(paidAmount)}</span>
        </div>

        {paidAmount > 0 && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Cancellation fee (withheld from refund)</span>
              <input type="number" min={0} max={paidAmount} value={fee} onChange={(e) => { setFee(e.target.value); setRefundAmount(String(Math.max(0, paidAmount - (Number(e.target.value) || 0)))); }} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Refundable amount</span>
              <input type="number" min={0} max={paidAmount} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              <span className="mt-1 block text-xs text-gray-500">Suggested: {formatCurrency(maxRefundable)} (paid − fee). You can override it.</span>
            </label>

            {refundNum > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Refund method</span>
                  <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    {REFUND_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">Reference (optional)</span>
                  <input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} placeholder="Transaction ID" className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </label>
              </div>
            )}

            <p className="text-xs text-gray-500">
              This records the refund for your own accounting only — it doesn&apos;t send money back automatically. Actually transfer the {formatCurrency(refundNum)} via {REFUND_METHODS.find((m) => m.value === refundMethod)?.label ?? refundMethod} yourself.
            </p>
          </>
        )}

        {!isNoShow && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={notifyGuest} onChange={(e) => setNotifyGuest(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            Email the guest that their booking was cancelled
          </label>
        )}

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </div>
    </ModalShell>
  );
}
