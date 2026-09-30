'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/store/admin';
import { adminEndpoints } from '@/lib/admin-api';
import { Shield, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAdmin, isAdminAuthenticated } = useAdminStore();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAdminAuthenticated()) {
      router.replace('/admin/dashboard');
    }
  }, [isAdminAuthenticated, router]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // Asked for only once the server says this account has a second factor, so
  // an account without one never sees a field it cannot fill.
  const [needsCode, setNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await adminEndpoints.login(email, password, needsCode ? code : undefined);
      const { token, admin } = res.data.data;
      setAdmin(admin, token);
      router.push('/admin/dashboard');
    } catch (err: any) {
      const body = err?.response?.data;
      if (body?.code === 'MFA_REQUIRED') {
        setNeedsCode(true);
        setError('');
      } else {
        // A wrong code leaves the field open; a wrong password sends it back to
        // the start, because the password is what has to be right first.
        if (body?.code !== 'MFA_INVALID') setNeedsCode(false);
        setCode('');
        setError(body?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-500 mt-1 text-sm">ResortPro Super Admin</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@resortpro.site"
                required
                className="w-full h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {needsCode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Authenticator code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="text"
                  required
                  className="w-full h-10 rounded-lg border border-gray-700 bg-gray-800 px-3 text-white placeholder:text-gray-500 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Six digits from your authenticator app, or one of your recovery codes.
                </p>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-400 text-center py-2 bg-red-500/10 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-6">
          Access restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
