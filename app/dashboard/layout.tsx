'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import Sidebar from '@/components/Sidebar';
import { Loader, KeyRound, LogOut } from 'lucide-react';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import { isDoctor, isAdmin } from '@/lib/roles';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, authUser, loading, signOut } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && isDoctor(user)) {
      // Doctors have their own portal and must not see lab staff pages.
      router.push('/doctor');
    } else if (!loading && isAdmin(user)) {
      // Separation of duties: administrators manage the system, not lab work.
      router.push('/admin');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="w-12 h-12 text-[#3B6255] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || isDoctor(user) || isAdmin(user)) {
    return null;
  }

  // Accounts created by the admin start with a temporary password
  if (authUser?.user_metadata?.must_change_password) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#3B6255] to-green-900 p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <KeyRound className="w-10 h-10 text-[#3B6255] mb-3" />
          <h1 className="text-2xl font-bold text-gray-800">Set your own password</h1>
          <p className="text-sm text-gray-600 mt-1 mb-6">
            Welcome, {user.full_name}. You signed in with a temporary password from the administrator.
            Choose a new one that only you know before continuing.
          </p>
          <ChangePasswordForm forced />
          <button
            onClick={() => signOut()}
            className="w-full mt-3 px-6 py-2 text-sm text-gray-600 hover:text-red-700 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isMobile ? 'ml-0' : sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className={`text-lg md:text-2xl font-bold text-gray-800 ${isMobile ? 'ml-12' : ''}`}>
              CogniLab - KRRAX-JAM Inc
            </h2>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-800">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-base">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto px-4 md:px-8 py-4 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
