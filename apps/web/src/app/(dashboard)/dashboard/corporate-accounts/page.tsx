'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { corporateAccountsApi } from '@/lib/api';
import { ModalShell } from '@/components/ui/modal-shell';
import { toast } from '@/hooks/use-toast';
import {
  Building, Plus, Loader2, Pencil, Trash2, FileText, ChevronRight,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/patterns';

interface CorporateAccount {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  paymentTermDays: number;
  discountPercent: number;
  bookingCount: number;
  outstanding: number;
  unpaidInvoices: number;
}

interface CorpBooking {
  id: string;
  confirmationNo: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  corporateInvoiceId: string | null;
  guest: { firstName: string; lastName: string };
  room: { name: string; number: string };
}

interface CorpInvoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  dueDate: string;
  bookings: { id: string; confirmationNo: string }[];
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'var(--rp-surface-3)', text: 'var(--rp-text-muted)' },
  SENT: { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  PARTIAL: { bg: 'var(--rp-amber-bg)', text: '#b89040' },
  PAID: { bg: 'var(--rp-teal-bg)', text: '#183153' },
  OVERDUE: { bg: 'var(--rp-red-bg, #fbeceb)', text: '#c43c3c' },
};

export default function CorporateAccountsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<CorporateAccount | null>(null);
  const [detailAccount, setDetailAccount] = useState<CorporateAccount | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['corporate-accounts'],
    queryFn: () => corporateAccountsApi.list().then((r) => r.data.data as CorporateAccount[]),
  });
  const accounts = data ?? [];
  const totalOutstanding = accounts.reduce((sum, a) => sum + a.outstanding, 0);

  const removeMutation = useMutation({
    mutationFn: (id: string) => corporateAccountsApi.remove(id),
    onSuccess: () => { toast({ title: 'Company removed' }); queryClient.invalidateQueries({ queryKey: ['corporate-accounts'] }); },
  });

  return (
    <PageShell gap={6}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'var(--rp-teal-bg)' }}>
            <Building className="h-4 w-4" style={{ color: '#183153' }} />
          </div>
          <PageHeader
            title="Corporate Accounts"
            subtitle="Company-level billing — individual guest na, consolidated invoice"
            tightSubtitle
          />
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold hover:opacity-90"
          style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
        >
          <Plus className="h-4 w-4" /> Add Company
        </button>
      </div>

      {!isLoading && accounts.length > 0 && (
        <div className="rounded-[14px] border bg-white p-5" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <p className="text-[13px] text-[#475569] dark:text-[#9db4c4]">
            Total Outstanding: <span className="text-[16px] font-semibold text-[#183153] dark:text-[#f8fafc]">৳{totalOutstanding.toLocaleString()}</span> across {accounts.length} compan{accounts.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: '#aac0d0' }} /></div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] border bg-white py-14 text-center" style={{ borderColor: 'var(--rp-border)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--rp-surface-3)' }}>
            <Building className="h-7 w-7 text-[#94a3b8] dark:text-[#7f99ab]" />
          </div>
          <p className="text-[13px] text-[#64748b] dark:text-[#a9c1d0]">Ekhono kono corporate account add kora hoyni.</p>
        </div>
      ) : (
        <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: 'var(--rp-border)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#fafaf8] transition-colors" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-[#183153] dark:text-[#f8fafc]">{a.companyName}</p>
                <p className="text-[12px] mt-0.5 text-[#64748b] dark:text-[#a9c1d0]">
                  {a.contactName} · Net-{a.paymentTermDays}{a.discountPercent > 0 && ` · ${a.discountPercent}% corporate rate`} · {a.bookingCount} booking{a.bookingCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-semibold" style={{ color: a.outstanding > 0 ? '#c43c3c' : '#183153' }}>
                  ৳{a.outstanding.toLocaleString()} {a.outstanding > 0 ? 'due' : 'paid'}
                </p>
                {a.unpaidInvoices > 0 && <p className="text-[11px] text-[#64748b] dark:text-[#a9c1d0]">{a.unpaidInvoices} unpaid invoice{a.unpaidInvoices !== 1 ? 's' : ''}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => setEditAccount(a)} className="rounded-[7px] p-1.5 hover:bg-[#f4f1eb]" style={{ color: 'var(--rp-text-subtle)' }}><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => { if (confirm(`Remove ${a.companyName}?`)) removeMutation.mutate(a.id); }} className="rounded-[7px] p-1.5 hover:bg-[#fbeceb]" style={{ color: '#c43c3c' }}><Trash2 className="h-3.5 w-3.5" /></button>
                <button
                  onClick={() => setDetailAccount(a)}
                  className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold hover:opacity-90"
                  style={{ background: 'var(--rp-amber-bg)', color: '#b89040' }}
                >
                  View <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(addOpen || editAccount) && (
        <AccountFormModal
          account={editAccount ?? undefined}
          onClose={() => { setAddOpen(false); setEditAccount(null); }}
          onDone={() => { setAddOpen(false); setEditAccount(null); queryClient.invalidateQueries({ queryKey: ['corporate-accounts'] }); }}
        />
      )}

      {detailAccount && (
        <CompanyDetailModal
          account={detailAccount}
          onClose={() => setDetailAccount(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ['corporate-accounts'] })}
        />
      )}
    </PageShell>
  );
}

function AccountFormModal({ account, onClose, onDone }: { account?: CorporateAccount; onClose: () => void; onDone: () => void }) {
  const [companyName, setCompanyName] = useState(account?.companyName ?? '');
  const [contactName, setContactName] = useState(account?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(account?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(account?.contactPhone ?? '');
  const [paymentTermDays, setPaymentTermDays] = useState(String(account?.paymentTermDays ?? 30));
  const [discountPercent, setDiscountPercent] = useState(String(account?.discountPercent ?? 0));

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        companyName, contactName, contactEmail, contactPhone,
        paymentTermDays: Number(paymentTermDays), discountPercent: Number(discountPercent),
      };
      return account ? corporateAccountsApi.update(account.id, data) : corporateAccountsApi.create(data);
    },
    onSuccess: () => { toast({ title: account ? 'Company updated' : 'Company added' }); onDone(); },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not save company', variant: 'destructive' }),
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title={account ? `Edit — ${account.companyName}` : 'Add Company'}
      description="B2B client — bar bar guest pathay, consolidated bill hoy"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!companyName || !contactName || !contactEmail || !contactPhone || mutation.isPending}
            className="flex items-center gap-2 rounded-[9px] px-4 py-[9px] text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#475569] dark:text-[#a9c1d0]">Company Name</label>
          <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ABC Corporation"
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#475569] dark:text-[#a9c1d0]">Contact Person</label>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#475569] dark:text-[#a9c1d0]">Phone</label>
            <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-[#475569] dark:text-[#a9c1d0]">Contact Email</label>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#475569] dark:text-[#a9c1d0]">Payment Terms (days)</label>
            <input type="number" min={0} value={paymentTermDays} onChange={(e) => setPaymentTermDays(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#475569] dark:text-[#a9c1d0]">Corporate Discount %</label>
            <input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)}
              className="w-full rounded-[9px] border px-3.5 py-2.5 text-[13.5px] outline-none" style={{ borderColor: 'var(--rp-border-md)', background: 'var(--rp-surface)' }} />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function CompanyDetailModal({ account, onClose, onChanged }: { account: CorporateAccount; onClose: () => void; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['corporate-account-bookings', account.id],
    queryFn: () => corporateAccountsApi.bookings(account.id).then((r) => r.data.data as CorpBooking[]),
  });
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['corporate-account-invoices', account.id],
    queryFn: () => corporateAccountsApi.invoices(account.id).then((r) => r.data.data as CorpInvoice[]),
  });

  const uninvoiced = (bookingsData ?? []).filter((b) => !b.corporateInvoiceId);
  const invoices = invoicesData ?? [];
  const selectedTotal = uninvoiced.filter((b) => selected.has(b.id)).reduce((sum, b) => sum + b.totalAmount, 0);
  const discountAmount = selectedTotal * (account.discountPercent / 100);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const generateMutation = useMutation({
    mutationFn: () => corporateAccountsApi.generateInvoice(account.id, Array.from(selected)),
    onSuccess: (res) => {
      toast({ title: res.data.message ?? 'Invoice generated' });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['corporate-account-bookings', account.id] });
      queryClient.invalidateQueries({ queryKey: ['corporate-account-invoices', account.id] });
      onChanged();
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast({ title: 'Failed', description: err?.response?.data?.error ?? 'Could not generate invoice', variant: 'destructive' }),
  });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => corporateAccountsApi.updateInvoice(invoiceId, { status: 'PAID' }),
    onSuccess: () => {
      toast({ title: 'Invoice marked paid' });
      queryClient.invalidateQueries({ queryKey: ['corporate-account-invoices', account.id] });
      onChanged();
    },
  });

  return (
    <ModalShell
      open
      onClose={onClose}
      title={account.companyName}
      description={`${account.contactName} · Net-${account.paymentTermDays}${account.discountPercent > 0 ? ` · ${account.discountPercent}% corporate rate` : ''}`}
      maxWidth="760px"
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onClose} className="rounded-[9px] border px-4 py-[9px] text-[13px] font-medium" style={{ borderColor: 'var(--rp-border-md)', color: 'var(--rp-text-subtle)' }}>Close</button></div>}
    >
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">Uninvoiced Bookings</h3>
          {bookingsLoading ? (
            <div className="flex h-16 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: '#aac0d0' }} /></div>
          ) : uninvoiced.length === 0 ? (
            <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">Kono uninvoiced booking nai.</p>
          ) : (
            <div className="space-y-1.5">
              {uninvoiced.map((b) => (
                <label key={b.id} className="flex items-center gap-3 rounded-[9px] border px-3.5 py-2.5 cursor-pointer" style={{ borderColor: 'var(--rp-border)' }}>
                  <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4" />
                  <span className="flex-1 text-[12.5px] text-[#183153] dark:text-[#f8fafc]">
                    {b.guest.firstName} {b.guest.lastName} — {b.room.name} — {new Date(b.checkIn).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  </span>
                  <span className="text-[12.5px] font-medium">৳{b.totalAmount.toLocaleString()}</span>
                </label>
              ))}
              {selected.size > 0 && (
                <div className="mt-3 rounded-[10px] p-3.5 text-[12.5px]" style={{ background: 'var(--rp-surface-3)' }}>
                  <div className="flex justify-between"><span>Subtotal</span><span>৳{selectedTotal.toLocaleString()}</span></div>
                  {account.discountPercent > 0 && (
                    <div className="flex justify-between text-[#183153]"><span>Corporate discount ({account.discountPercent}%)</span><span>-৳{discountAmount.toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between mt-1 pt-1 font-semibold" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                    <span>Total</span><span>৳{(selectedTotal - discountAmount).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--rp-btn-accent)', color: 'var(--rp-btn-accent-text)' }}
                  >
                    {generateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Generate Invoice
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-[#183153] dark:text-[#f8fafc]">Invoice History</h3>
          {invoicesLoading ? (
            <div className="flex h-16 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: '#aac0d0' }} /></div>
          ) : invoices.length === 0 ? (
            <p className="text-[12.5px] text-[#64748b] dark:text-[#a9c1d0]">Ekhono kono invoice generate hoyni.</p>
          ) : (
            <div className="space-y-1.5">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-[9px] border px-3.5 py-2.5" style={{ borderColor: 'var(--rp-border)' }}>
                  <FileText className="h-4 w-4 shrink-0" style={{ color: '#64748b' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-[#183153] dark:text-[#f8fafc]">{inv.invoiceNumber}</p>
                    <p className="text-[11px] text-[#64748b] dark:text-[#a9c1d0]">
                      {inv.bookings.length} booking{inv.bookings.length !== 1 ? 's' : ''} · Due {new Date(inv.dueDate).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold">৳{inv.totalAmount.toLocaleString()}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: STATUS_STYLE[inv.status].bg, color: STATUS_STYLE[inv.status].text }}>{inv.status}</span>
                  {inv.status !== 'PAID' && (
                    <button
                      onClick={() => markPaidMutation.mutate(inv.id)}
                      disabled={markPaidMutation.isPending}
                      className="rounded-[7px] px-2.5 py-1 text-[11px] font-medium hover:bg-[#f4f1eb]"
                      style={{ color: 'var(--rp-text-subtle)' }}
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
