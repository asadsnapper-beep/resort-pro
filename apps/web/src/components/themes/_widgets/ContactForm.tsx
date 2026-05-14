'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import type { WidgetProps } from '../types';

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ── ContactForm ─────────────────────────────────────────────────────────────── */
export function ContactForm({ slug, primaryColor, accentColor }: WidgetProps) {
  const [type, setType] = useState<'FEEDBACK' | 'COMPLAINT' | 'REQUEST' | 'OTHER'>('FEEDBACK');
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      setError('Please fill all fields'); return;
    }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/site/${slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const j = await res.json();
        setError(j.error || 'Submission failed');
      }
    } catch { setError('Something went wrong.'); }
    setSubmitting(false);
  };

  if (sent) {
    return (
      <div className="text-center py-16 rounded-3xl border-2 border-dashed border-gray-200">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-4"
          style={{ backgroundColor: `${primaryColor}15` }}>
          <Send className="h-7 w-7" style={{ color: primaryColor }} />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Thank you!</h3>
        <p className="mt-2 text-gray-500">Our team will review your message and respond promptly.</p>
        <button
          onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
          className="mt-6 text-sm font-medium underline"
          style={{ color: primaryColor }}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 bg-gray-50 rounded-3xl p-8">
      {/* Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
        <div className="grid grid-cols-4 gap-2">
          {([
            { v: 'FEEDBACK',  label: '💬 Feedback'  },
            { v: 'COMPLAINT', label: '⚠️ Complaint' },
            { v: 'REQUEST',   label: '🙏 Request'   },
            { v: 'OTHER',     label: '📝 Other'     },
          ] as const).map(opt => (
            <button key={opt.v} type="button" onClick={() => setType(opt.v)}
              className="py-2.5 rounded-xl text-xs font-medium border-2 transition-all"
              style={{
                borderColor:     type === opt.v ? primaryColor : '#e5e7eb',
                backgroundColor: type === opt.v ? `${primaryColor}10` : 'white',
                color:           type === opt.v ? primaryColor : '#6b7280',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Jane Doe"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="jane@example.com"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
        <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
          placeholder="Brief subject of your message"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
        <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          rows={5} placeholder="Tell us about your experience or request in detail..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none" />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full py-4 rounded-xl text-white font-semibold text-sm tracking-wide flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: primaryColor }}>
        {submitting ? 'Sending...' : <><Send className="h-4 w-4" /> Send Message</>}
      </button>
    </form>
  );
}
