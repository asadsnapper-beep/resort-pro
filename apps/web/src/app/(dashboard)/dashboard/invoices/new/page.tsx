'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { invoiceApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, FileText, User, Mail, Phone, Calendar, StickyNote, Percent, Tag } from 'lucide-react';

export default function NewInvoicePage() {
  const router = useRouter();
  const { tenant } = useAuthStore();

  const [form, setForm] = useState({
    guestName:    '',
    guestEmail:   '',
    guestPhone:   '',
    dueDate:      '',
    taxRate:      String(tenant?.taxRate ?? 0),
    discountAmt:  '0',
    discountNote: '',
    notes:        '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMut = useMutation({
    mutationFn: () => invoiceApi.create({
      guestName:    form.guestName.trim(),
      guestEmail:   form.guestEmail.trim() || undefined,
      guestPhone:   form.guestPhone.trim() || undefined,
      dueDate:      form.dueDate || undefined,
      taxRate:      Number(form.taxRate) || 0,
      discountAmt:  Number(form.discountAmt) || 0,
      discountNote: form.discountNote.trim() || undefined,
      notes:        form.notes.trim() || undefined,
    }),
    onSuccess: (res) => {
      const inv = res.data?.data;
      toast({ title: 'Invoice created', description: `#${inv?.invoiceNumber}` });
      router.push(`/dashboard/invoices/${inv?.id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Failed to create invoice';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.guestName.trim()) e.guestName = 'Guest name is required';
    if (form.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guestEmail)) e.guestEmail = 'Invalid email';
    if (Number(form.taxRate) < 0 || Number(form.taxRate) > 100) e.taxRate = '0–100 only';
    if (Number(form.discountAmt) < 0) e.discountAmt = 'Cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) createMut.mutate();
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#a9c1d0] hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#f8fafc]">New Invoice</h1>
          <p className="text-sm text-muted-foreground">Create a manual invoice for a guest</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Guest Info */}
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-resort-600" />
            <h2 className="font-semibold text-gray-800 dark:text-[#f8fafc]">Guest Information</h2>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-[#a9c1d0]">Guest Name <span className="text-red-500">*</span></label>
            <Input
              value={form.guestName}
              onChange={set('guestName')}
              placeholder="e.g. Karim Hossain"
              className={errors.guestName ? 'border-red-400' : ''}
            />
            {errors.guestName && <p className="text-xs text-red-500">{errors.guestName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-[#a9c1d0] flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Email
              </label>
              <Input
                type="email"
                value={form.guestEmail}
                onChange={set('guestEmail')}
                placeholder="guest@email.com"
                className={errors.guestEmail ? 'border-red-400' : ''}
              />
              {errors.guestEmail && <p className="text-xs text-red-500">{errors.guestEmail}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-[#a9c1d0] flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Phone
              </label>
              <Input
                value={form.guestPhone}
                onChange={set('guestPhone')}
                placeholder="+880 1xxx-xxxxxx"
              />
            </div>
          </div>
        </div>

        {/* Invoice Settings */}
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-resort-600" />
            <h2 className="font-semibold text-gray-800 dark:text-[#f8fafc]">Invoice Settings</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-[#a9c1d0] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Due Date
              </label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={set('dueDate')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-[#a9c1d0] flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" /> Tax Rate (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.taxRate}
                onChange={set('taxRate')}
                className={errors.taxRate ? 'border-red-400' : ''}
              />
              {errors.taxRate && <p className="text-xs text-red-500">{errors.taxRate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-[#a9c1d0] flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Discount Amount ({tenant?.currency ?? 'BDT'})
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.discountAmt}
                onChange={set('discountAmt')}
                className={errors.discountAmt ? 'border-red-400' : ''}
              />
              {errors.discountAmt && <p className="text-xs text-red-500">{errors.discountAmt}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-[#a9c1d0]">Discount Note</label>
              <Input
                value={form.discountNote}
                onChange={set('discountNote')}
                placeholder="e.g. Loyalty discount"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-resort-600" />
            <h2 className="font-semibold text-gray-800 dark:text-[#f8fafc]">Notes</h2>
          </div>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            placeholder="Internal notes or message for the guest..."
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Info box */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
          <strong>Note:</strong> Invoice will be created as <strong>Draft</strong>. You can add line items and record payments on the next screen.
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-8">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={createMut.isPending} className="gap-2">
            <FileText className="h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}
