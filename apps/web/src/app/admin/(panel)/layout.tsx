'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAdminStore } from '@/store/admin';
import { LogOut, ChevronRight, Loader2, Lock, Menu, X } from 'lucide-react';
import NotificationBell from '@/components/admin/NotificationBell';
import ReauthPrompt from '@/components/admin/ReauthPrompt';
import { cn } from '@/lib/utils';
import { navFor, canOpen, ADMIN_ROLE_LABEL } from '@/lib/admin-nav';

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { clearAdmin, admin, isAdminAuthenticated, adminRole } = useAdminStore();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = navFor(adminRole);
  const roleLabel = adminRole ? ADMIN_ROLE_LABEL[adminRole] : 'Admin';
  const allowed = canOpen(adminRole, pathname);

  useEffect(() => {
    setMounted(true);
    if (!isAdminAuthenticated()) {
      router.push('/admin/login');
    }
  }, [isAdminAuthenticated, router]);

  // Arriving somewhere is the end of navigating, so the drawer closes itself.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [drawerOpen]);

  // Show spinner until client-side mount — avoids SSR/localStorage mismatch
  if (!mounted) {
    return (
      <div className="admin-shell min-h-screen bg-rp-surface-2 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rp-brand" />
      </div>
    );
  }

  if (!isAdminAuthenticated()) return null;

  const handleLogout = () => {
    clearAdmin();
    router.push('/admin/login');
  };

  return (
    <div className="admin-shell flex h-screen overflow-hidden bg-rp-surface-2 text-rp-text">
      {/* Mounted once so every screen gets the password prompt, including
          the ones written before it existed. */}
      <ReauthPrompt />
      {/* On a phone the sidebar is 240px of a 390px screen, which left the
          panel itself about 150px wide — every table and form in it unusable
          (release-readiness review M-04). Below md it slides in over the page
          instead, and the header gets the button that opens it. */}
      {drawerOpen && (
        /* Tapping beside the drawer closes it, which is what a phone user
           expects — but it is hidden from assistive tech on purpose. A
           keyboard or screen-reader user already has the X inside the drawer
           and Escape, and a second control announcing the same "Close menu"
           is just one more identical thing to move past. */
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-rp-text/40 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'w-60 flex flex-col bg-rp-surface border-r-2 border-rp-border shrink-0',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
          'md:static md:z-auto md:translate-x-0 md:transition-none',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-5 border-b-2 border-rp-border">
          <Image src="/logo/resortpro-icon-64.png" alt="ResortPro" width={32} height={32} priority className="h-8 w-8 shrink-0 mix-blend-multiply" />
          <div className="min-w-0">
            <p className="admin-nav-brand text-rp-text">ResortPro</p>
            <p className="admin-nav-meta text-rp-muted">{roleLabel}</p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="ml-auto p-1 rounded-lg text-rp-muted hover:text-rp-text hover:bg-rp-surface-3 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-normal transition-colors',
                  isActive
                    ? 'bg-rp-teal-bg text-rp-brand border border-rp-border-md'
                    : 'text-rp-muted hover:text-rp-text hover:bg-rp-surface-3'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t-2 border-rp-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-rp-teal-bg border border-rp-border-md rounded-full flex items-center justify-center">
              <span className="text-rp-brand text-xs font-bold uppercase">
                {admin?.email?.[0] || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-rp-text text-xs font-medium truncate">{admin?.email || 'Admin'}</p>
              <p className="text-rp-brand text-xs">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rp-muted hover:text-rp-danger hover:bg-rp-red-bg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b-2 border-rp-border bg-rp-surface flex items-center px-4 md:px-6 gap-2 shrink-0">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 mr-1 p-2 rounded-lg text-rp-muted hover:text-rp-text hover:bg-rp-surface-3 md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          {/* Breadcrumb — "Admin ›" is the part a narrow header can spare. */}
          <span className="text-rp-muted text-sm hidden sm:inline">Admin</span>
          <ChevronRight className="w-3 h-3 text-rp-faint hidden sm:inline" />
          <span className="text-rp-text text-sm font-medium capitalize truncate">
            {pathname === '/admin' ? 'Overview' : pathname.split('/').pop()}
          </span>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <NotificationBell />
            <span className="text-xs text-rp-brand bg-rp-teal-bg border border-rp-border-md px-2 py-1 rounded-full hidden sm:inline">
              {roleLabel}
            </span>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-y-auto bg-rp-surface-2 p-5 md:p-6 xl:p-8">
          {allowed ? children : (
            /* The page would render a shell and then sit empty while the API
               answered 403 to everything it asked for. Saying so is kinder and
               shorter than letting someone wonder whether it is still loading. */
            <div className="max-w-md mx-auto mt-16 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rp-surface-3 border border-rp-border flex items-center justify-center">
                <Lock className="w-5 h-5 text-rp-muted" />
              </div>
              <h1 className="text-rp-text text-lg font-medium mb-2">This page is not part of your role</h1>
              <p className="text-rp-muted text-sm">
                You are signed in as <span className="text-rp-text">{roleLabel}</span>.
                Ask a Super Admin if you need it.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
