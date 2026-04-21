import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'ResortPro – Resort Management Platform' };

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-resort-900 via-resort-800 to-resort-700 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 font-display text-lg font-bold text-resort-900">R</div>
          <span className="font-display text-2xl font-semibold tracking-tight">ResortPro</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm font-medium text-white/80 hover:text-white transition-colors">Sign in</Link>
          <Link href="/auth/register" className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-semibold text-resort-900 hover:bg-gold-400 transition-colors">Start free trial</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-8 py-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          Now in beta — free for 3 months
        </div>
        <h1 className="font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Run your resort,<br />
          <span className="text-gold-400">not spreadsheets</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
          The all-in-one platform built for small resort owners. Bookings, housekeeping, restaurant, support, and a stunning website — all in one place.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/register" className="w-full sm:w-auto rounded-xl bg-gold-500 px-8 py-4 text-base font-semibold text-resort-900 hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/25">
            Get started for free
          </Link>
          <Link href="#features" className="w-full sm:w-auto rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all backdrop-blur-sm">
            See how it works
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-8 py-16">
        <h2 className="text-center font-display text-3xl font-bold">Everything you need</h2>
        <p className="mt-3 text-center text-white/60">One platform, complete control</p>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: '🏨', title: 'Room Management', desc: 'Manage rooms, villas, and bungalows. Real-time availability with smart housekeeping scheduling.' },
            { icon: '📅', title: 'Booking Engine', desc: 'Direct bookings with calendar view, auto confirmation, and built-in payment tracking.' },
            { icon: '🌐', title: 'Resort Website', desc: 'A beautiful, SEO-ready website for your resort. Update content without a developer.' },
            { icon: '🍽️', title: 'Restaurant & F&B', desc: 'Full menu management, room-service orders, and kitchen status tracking.' },
            { icon: '🎫', title: 'Guest Support', desc: 'Live chat, email ticketing, and issue tracking. Keep guests happy around the clock.' },
            { icon: '📱', title: 'Owner Mobile App', desc: 'Stay on top of bookings, staff updates, and revenue from your iOS or Android phone.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <div className="mb-4 text-4xl">{f.icon}</div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-white/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-20 text-center">
        <h2 className="font-display text-3xl font-bold">Ready to take control?</h2>
        <p className="mt-3 text-white/60">Join resort owners who replaced 5 tools with one.</p>
        <Link href="/auth/register" className="mt-8 inline-block rounded-xl bg-gold-500 px-10 py-4 font-semibold text-resort-900 hover:bg-gold-400 transition-colors shadow-lg shadow-gold-500/25">
          Start your free trial
        </Link>
      </section>

      <footer className="border-t border-white/10 px-8 py-8 text-center text-sm text-white/40">
        © {new Date().getFullYear()} ResortPro. Built for resort owners who want more time with their guests.
      </footer>
    </main>
  );
}
