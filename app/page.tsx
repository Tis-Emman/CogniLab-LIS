'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { homePathForRole } from '@/lib/roles';

/** Entry point: send signed-in users to their home page, everyone else to login. */
export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? homePathForRole(user.role) : '/login');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#3B6255] to-green-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
        <p className="text-[#CBDED3]">Loading CogniLab…</p>
      </div>
    </div>
  );
}
