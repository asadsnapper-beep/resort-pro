'use client';

import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import {
  Printer, Send, ArrowLeft, Plus, Trash2, CheckCircle2,
  Building2, User, CalendarDays, Hash, Loader2, Mail, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface InvoiceData {
  booking: {
    id: string;
    confirmationNo: string;
    checkIn: string;
    checkOut: string;
    status: string;
    adults: number;
    children: number;
    invoiceNumber: string | null;
    invoiceSentAt: string | null;
    invoiceId: string | null;
  };
  guest: { firstName: string; lastName: string; email: string; phone?: string; address?: string; nationality?: string };
  room: { id: string; name: string; number: string; basePrice: number };
  tenant: { name: string; email?: string; phone?: string; address?: string; currency: string; taxRate: number };
  lineItems: {
    room: { description: string; amount: number; nights: number };
    food: { description: string; quantity: number; unitPrice: number; amount: number }[];
    extras: { id: string; description: string; quantity: number; amount: number; total: number }[];
  };
  summary: {
    roomTotal: number;
    foodTotal: number;
    extrasTotal: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    grandTotal: number;
    paidAmount: number;
    balanceDue: number;
  };
  payments: { id: string; amount: number; method: string; processedAt?: string }[];
}

function AddExtraModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [qty, setQty] = useState('1');

  const { mutate, isPending } = useMutation({
    mutationFn: () => bookingsApi.addInvoiceExtra(bookingId, {
      description: desc,
      amount: parseFloat(amount),
      quantity: parseInt(qty),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', bookingId] });
      toast({ title: 'Extra charge added' });
      onClose();
    },
    onError: () => toast({ title: 'Failed to add charge', variant: 'destructive' }),
  });

  return createPortal((
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-4">Add Extra Charge</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
            <input
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 bg-transparent"
              placeholder="e.g. Airport transfer, Minibar..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 bg-transparent"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Quantity</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resort-500 bg-transparent"
                value={qty}
                onChange={e => setQty(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            className="flex-1 bg-resort-600 hover:bg-resort-700 text-white"
            disabled={!desc || !amount || isPending}
            onClick={() => mutate()}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Charge
          </Button>
        </div>
      </div>
    </div>
  ), document.body);
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [showAddExtra, setShowAddExtra] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => bookingsApi.getInvoice(id),
    select: r => r.data.data as InvoiceData,
  });

  const { mutate: sendEmail, isPending: isSending } = useMutation({
    mutationFn: () => bookingsApi.sendInvoiceEmail(id),
    onSuccess: (res) => {
      const d = res.data.data;
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      toast({ title: `Invoice emailed to ${d.sentTo}` });
    },
    onError: () => toast({ title: 'Failed to send email', variant: 'destructive' }),
  });

  const { mutate: deleteExtra } = useMutation({
    mutationFn: (extraId: string) => bookingsApi.deleteInvoiceExtra(id, extraId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      toast({ title: 'Charge removed' });
    },
  });

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-resort-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">Invoice not found.</div>
    );
  }

  const { booking, guest, room, tenant, lineItems, summary, payments } = data;
  const fmt = (n: number) => formatCurrency(n, tenant.currency);
  const isPaid = summary.balanceDue <= 0;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print, #invoice-print * { visibility: visible !important; }
          #invoice-print { position: fixed !important; inset: 0 !important; background: white !important; z-index: 9999 !important; padding: 32px !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Toolbar — hidden on print */}
        <div className="no-print flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to booking
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddExtra(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Charge
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendEmail()}
              disabled={isSending}
            >
              {isSending
                ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                : <Mail className="h-4 w-4 mr-1" />}
              Email Invoice
            </Button>
            {booking.invoiceId && (
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/invoices/${booking.invoiceId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              </a>
            )}
            <Button size="sm" className="bg-resort-600 hover:bg-resort-700 text-white" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>

        {/* Invoice Document */}
        <div id="invoice-print" ref={printRef}>
          <Card className="overflow-hidden shadow-md">
            <CardContent className="p-0">
              {/* Header */}
              <div className="bg-gradient-to-br from-resort-700 to-resort-900 text-white p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">{tenant.name}</h1>
                    {tenant.address && <p className="mt-1 text-sm text-resort-200">{tenant.address}</p>}
                    {tenant.phone && <p className="text-sm text-resort-200">{tenant.phone}</p>}
                    {tenant.email && <p className="text-sm text-resort-200">{tenant.email}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold tracking-tight text-resort-100">INVOICE</p>
                    <p className="text-sm text-resort-300 mt-1">
                      #{booking.invoiceNumber ?? `INV-${booking.confirmationNo}`}
                    </p>
                    {booking.invoiceSentAt && (
                      <div className="mt-2 flex items-center justify-end gap-1 text-xs text-emerald-300">
                        <Send className="h-3 w-3" />
                        Sent {formatDate(booking.invoiceSentAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Guest + Booking Info */}
              <div className="grid grid-cols-2 gap-6 px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    <User className="h-3.5 w-3.5" /> Bill To
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">{guest.firstName} {guest.lastName}</p>
                  <p className="text-sm text-gray-500">{guest.email}</p>
                  {guest.phone && <p className="text-sm text-gray-500">{guest.phone}</p>}
                  {guest.address && <p className="text-sm text-gray-500">{guest.address}</p>}
                  {guest.nationality && <p className="text-sm text-gray-500">{guest.nationality}</p>}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    <CalendarDays className="h-3.5 w-3.5" /> Stay Details
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Room</span>
                      <span className="font-medium">{room.name} (#{room.number})</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Check-in</span>
                      <span className="font-medium">{formatDate(booking.checkIn)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Check-out</span>
                      <span className="font-medium">{formatDate(booking.checkOut)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Guests</span>
                      <span className="font-medium">{booking.adults} adults{booking.children > 0 ? `, ${booking.children} children` : ''}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Confirmation</span>
                      <span className="font-medium font-mono text-xs">{booking.confirmationNo}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="px-8 py-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-resort-600">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">Description</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">Qty</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">Unit</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {/* Room */}
                    <tr>
                      <td className="py-3 text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">Room Charge</span>
                        <span className="block text-xs text-gray-500">{room.name} · {lineItems.room.nights} nights</span>
                      </td>
                      <td className="py-3 text-right text-sm text-gray-600 dark:text-gray-400">{lineItems.room.nights}</td>
                      <td className="py-3 text-right text-sm text-gray-600 dark:text-gray-400">{fmt(Number(room.basePrice))}</td>
                      <td className="py-3 text-right text-sm font-medium">{fmt(summary.roomTotal)}</td>
                    </tr>

                    {/* Food */}
                    {lineItems.food.length > 0 && (
                      <>
                        <tr className="bg-gray-50 dark:bg-gray-900/30">
                          <td colSpan={4} className="pt-3 pb-1 px-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Food & Beverage
                          </td>
                        </tr>
                        {lineItems.food.map((f, i) => (
                          <tr key={i}>
                            <td className="py-2 text-sm text-gray-800 dark:text-gray-300">{f.description}</td>
                            <td className="py-2 text-right text-sm text-gray-600 dark:text-gray-400">{f.quantity}</td>
                            <td className="py-2 text-right text-sm text-gray-600 dark:text-gray-400">{fmt(f.unitPrice)}</td>
                            <td className="py-2 text-right text-sm">{fmt(f.amount)}</td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* Extras */}
                    {lineItems.extras.length > 0 && (
                      <>
                        <tr className="bg-gray-50 dark:bg-gray-900/30">
                          <td colSpan={4} className="pt-3 pb-1 px-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Additional Charges
                          </td>
                        </tr>
                        {lineItems.extras.map(e => (
                          <tr key={e.id}>
                            <td className="py-2 text-sm text-gray-800 dark:text-gray-300">
                              {e.description}
                              <button
                                className="no-print ml-2 text-red-400 hover:text-red-600 transition-colors"
                                onClick={() => deleteExtra(e.id)}
                                title="Remove charge"
                              >
                                <Trash2 className="inline h-3.5 w-3.5" />
                              </button>
                            </td>
                            <td className="py-2 text-right text-sm text-gray-600 dark:text-gray-400">{e.quantity}</td>
                            <td className="py-2 text-right text-sm text-gray-600 dark:text-gray-400">{fmt(e.amount)}</td>
                            <td className="py-2 text-right text-sm">{fmt(e.total)}</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-6 flex justify-end">
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Room Subtotal</span>
                      <span>{fmt(summary.roomTotal)}</span>
                    </div>
                    {summary.foodTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Food & Beverage</span>
                        <span>{fmt(summary.foodTotal)}</span>
                      </div>
                    )}
                    {summary.extrasTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Additional Charges</span>
                        <span>{fmt(summary.extrasTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{fmt(summary.subtotal)}</span>
                    </div>
                    {summary.taxRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tax ({summary.taxRate}%)</span>
                        <span>{fmt(summary.taxAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base border-t-2 border-resort-600 pt-2">
                      <span>Total</span>
                      <span>{fmt(summary.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                      <span>Amount Paid</span>
                      <span>− {fmt(summary.paidAmount)}</span>
                    </div>
                    <div className={`flex justify-between font-bold text-lg rounded-lg px-3 py-2 ${
                      isPaid
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    }`}>
                      <span>Balance Due</span>
                      <span>{fmt(Math.max(0, summary.balanceDue))}</span>
                    </div>
                    {isPaid && (
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium pt-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Fully Paid
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment history */}
                {payments.length > 0 && (
                  <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Payment History</p>
                    <div className="space-y-1.5">
                      {payments.map(p => (
                        <div key={p.id} className="flex justify-between text-sm">
                          <span className="text-gray-500">
                            {p.method.replace('_', ' ')}
                            {p.processedAt ? ` · ${formatDate(p.processedAt)}` : ''}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmt(Number(p.amount))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-10 border-t border-gray-100 dark:border-gray-800 pt-4 text-center text-xs text-gray-400">
                  Thank you for staying at {tenant.name}. We hope to welcome you again soon!
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showAddExtra && (
        <AddExtraModal bookingId={id} onClose={() => setShowAddExtra(false)} />
      )}
    </>
  );
}
