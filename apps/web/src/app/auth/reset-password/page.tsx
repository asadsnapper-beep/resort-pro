'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { LockKeyhole, Eye, EyeOff, CheckCircle } from 'lucide-react';

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters').regex(/(?=.*[A-Z])/, 'Must have uppercase').regex(/(?=.*[0-9])/, 'Must have number'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Reset failed');
      setDone(true);
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Reset failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Invalid reset link. Please request a new one.</p>
        <Link href="/auth/forgot-password"><Button className="mt-4">Request New Link</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      {done ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Password Reset!</h3>
          <p className="text-gray-500 text-sm">Redirecting to login...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div className="relative">
              <Input
                {...register('password')}
                type={showPw ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className={errors.password ? 'border-red-400 pr-10' : 'pr-10'}
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <Input
              {...register('confirmPassword')}
              type={showPw ? 'text' : 'password'}
              placeholder="Repeat your password"
              className={errors.confirmPassword ? 'border-red-400' : ''}
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-[#1a6b5e] hover:bg-[#145a4f] text-white">
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a6b5e] via-[#145a4f] to-[#0d3d36] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#1a6b5e] to-[#145a4f] px-8 py-8 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <LockKeyhole className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Set New Password</h1>
            <p className="text-[#a8d5cf] mt-1 text-sm">Choose a strong password</p>
          </div>
          <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
