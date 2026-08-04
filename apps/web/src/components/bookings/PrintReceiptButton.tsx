'use client';

/**
 * Print receipt button for BookingDetailSheet.
 *
 * Flow:
 *  1. Fetch /api/bookings/:id/invoice
 *  2. If QZ Tray is connected → ESC/POS raw print to selected printer
 *  3. If QZ Tray not available → open HTML receipt in new tab → window.print()
 */

import { useState } from 'react';
import { Printer, ChevronDown, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useQZTray } from '@/hooks/use-qz-tray';
import { buildEscPosReceipt, buildHtmlReceipt, type ReceiptData } from '@/lib/receipt-formatter';
import { bookingsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface Props {
  bookingId: string;
}

export function PrintReceiptButton({ bookingId }: Props) {
  const { status, printers, connect, listPrinters, print } = useQZTray();
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [selectedPrinter, setSP]  = useState<string>('');

  // ── Build ReceiptData from API ───────────────────────────────────────────────
  async function fetchReceiptData(): Promise<ReceiptData> {
    const res = await bookingsApi.getInvoice(bookingId);
    const d   = res.data.data;

    const checkIn  = new Date(d.booking.checkIn).toLocaleDateString();
    const checkOut = new Date(d.booking.checkOut).toLocaleDateString();

    return {
      hotelName:     d.tenant.name,
      hotelAddress:  d.tenant.address ?? undefined,
      hotelPhone:    d.tenant.phone   ?? undefined,
      confirmationNo: d.booking.confirmationNo,
      invoiceNumber:  d.booking.invoiceNumber ?? undefined,
      guestName:      `${d.guest.firstName} ${d.guest.lastName}`,
      guestPhone:     d.guest.phone ?? undefined,
      roomNumber:     d.room.number,
      roomName:       d.room.name,
      checkIn,
      checkOut,
      nights:         d.lineItems.room.nights,
      lineItems: {
        room:   { description: d.lineItems.room.description, amount: d.lineItems.room.amount },
        food:   d.lineItems.food,
        extras: d.lineItems.extras,
      },
      summary: {
        subtotal:   d.summary.subtotal,
        taxRate:    d.summary.taxRate,
        taxAmount:  d.summary.taxAmount,
        grandTotal: d.summary.grandTotal,
        paidAmount: d.summary.paidAmount,
        balanceDue: d.summary.balanceDue,
      },
      currency:  d.tenant.currency ?? 'BDT',
      printedAt: new Date().toLocaleString(),
    };
  }

  // ── Print via QZ Tray ────────────────────────────────────────────────────────
  async function printWithQZ(printer: string) {
    setLoading(true);
    try {
      const data = await fetchReceiptData();
      const commands = buildEscPosReceipt(data);
      await print({ printer, data: commands });
      toast({ title: 'Receipt sent to printer', description: printer });
      setOpen(false);
    } catch (err) {
      toast({ title: 'Print failed', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // ── HTML fallback (browser print dialog) ────────────────────────────────────
  async function printHtmlFallback() {
    setLoading(true);
    try {
      const data = await fetchReceiptData();
      const html = buildHtmlReceipt(data);
      const win  = window.open('', '_blank');
      if (!win) { throw new Error('Pop-up blocked. Allow pop-ups for this site.'); }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
      setOpen(false);
    } catch (err) {
      toast({ title: 'Could not open receipt', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // ── Connect + load printers ──────────────────────────────────────────────────
  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);

    if (status === 'disconnected' || status === 'error') {
      connect();
      // Give it a moment then try to list printers
      await new Promise(r => setTimeout(r, 1200));
    }

    if (status === 'connected' || printers.length === 0) {
      try {
        const list = await listPrinters();
        if (list.length > 0 && !selectedPrinter) setSP(list[0]);
      } catch {
        // QZ might not have responded yet; printers will stay empty — fallback shown
      }
    }
  }

  const isQZReady = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="relative">
      {/* Main button */}
      <button
        onClick={handleOpen}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#183153]/30 text-[#183153] hover:bg-[#183153]/5 text-xs font-medium transition-colors disabled:opacity-50"
      >
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Printer className="w-3.5 h-3.5" />
        }
        Print Receipt
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* QZ Tray status bar */}
          <div className={`flex items-center gap-2 px-3 py-2 text-xs border-b border-gray-100 dark:border-gray-800 ${
            isQZReady    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
            isConnecting ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                           'text-gray-500 bg-gray-50 dark:bg-gray-800'
          }`}>
            {isConnecting
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : isQZReady
              ? <Check className="w-3 h-3" />
              : <AlertCircle className="w-3 h-3" />
            }
            {isConnecting ? 'Connecting to QZ Tray…' :
             isQZReady    ? 'QZ Tray connected' :
                            'QZ Tray not found'}
          </div>

          {/* Printer list (when QZ is ready) */}
          {isQZReady && printers.length > 0 && (
            <div className="p-2 space-y-1 max-h-40 overflow-y-auto">
              {printers.map(p => (
                <button
                  key={p}
                  onClick={() => { setSP(p); printWithQZ(p); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedPrinter === p ? 'font-semibold text-[#183153]' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 flex-shrink-0" />
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Fallback: browser print */}
          <div className="p-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={printHtmlFallback}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 flex-shrink-0" />
              Print via browser
              <span className="ml-auto text-gray-400 text-[10px]">(any printer)</span>
            </button>
          </div>

          {/* Install hint when QZ not running */}
          {(status === 'disconnected' || status === 'error') && (
            <div className="px-3 pb-3 text-[10px] text-gray-400 leading-relaxed">
              For direct thermal printing, install{' '}
              <span className="font-medium text-gray-500">QZ Tray</span>{' '}
              (qz.io) and keep it running.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
