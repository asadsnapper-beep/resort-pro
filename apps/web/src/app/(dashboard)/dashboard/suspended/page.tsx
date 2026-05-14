'use client';

import { useAuthStore } from '@/store/auth';
import { AlertTriangle, Mail, LogOut } from 'lucide-react';

export default function SuspendedPage() {
  const { tenant, clearAuth } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Account Suspended</h1>
        <p className="text-gray-400 mb-2">
          Your account <strong className="text-gray-300">{tenant?.name}</strong> has been suspended.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          This may be due to a billing issue, a policy violation, or an administrative action.
          Your data is safe and preserved.
        </p>

        {/* Contact card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 text-left">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            Contact Support
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            If you believe this is a mistake or would like to reactivate your account,
            please reach out to our support team.
          </p>
          <a
            href={`mailto:support@resortpro.app?subject=Account Suspended - ${tenant?.name}&body=Hi, my account "${tenant?.name}" (slug: ${tenant?.slug}) has been suspended. I'd like to resolve this.`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email Support Team
          </a>
        </div>

        <button
          onClick={() => {
            clearAuth();
            window.location.href = '/auth/login';
          }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
