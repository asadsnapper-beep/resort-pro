'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/store/admin';
import { Loader2 } from 'lucide-react';

export default function AdminRootPage() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdminStore();

  useEffect(() => {
    if (isAdminAuthenticated()) {
      router.replace('/admin/dashboard');

    } else {
      router.replace('/admin/login');
    }
  }, [isAdminAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );
}
