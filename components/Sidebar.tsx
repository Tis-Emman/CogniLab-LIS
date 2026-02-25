'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import {
  BarChart3,
  Users,
  Beaker,
  CreditCard,
  FileText,
  History,
  LogOut,
  User,
  Shield,
  Activity,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
    { label: 'Patients', path: '/dashboard/patients', icon: Users },
    { label: 'Test Results', path: '/dashboard/results', icon: Beaker },
    { label: 'Billing', path: '/dashboard/billing', icon: CreditCard },
    { label: 'Reports', path: '/dashboard/report', icon: FileText },
    { label: 'Access History', path: '/dashboard/history', icon: History },
    { label: 'Profile', path: '/dashboard/profile', icon: User },
  ];

  const adminItems =
    user?.role === 'faculty'
      ? [
          { label: 'Manage Users', path: '/admin/users', icon: Shield },
          { label: 'Audit Log', path: '/admin/audit-log', icon: Activity },
        ]
      : [];

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-[#3B6255] to-green-900 text-white transition-all duration-300 ${
          isOpen ? 'w-64' : 'w-20'
        } shadow-lg z-40`}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#8BA49A]">
          {isOpen && user && (
            <div className="mb-4 pb-4 border-b border-[#8BA49A]">
              <p className="text-xs text-[#CBDED3] font-semibold">LOGGED IN AS</p>
              <p className="text-sm font-semibold text-white mt-1">{user.full_name}</p>
              <p className="text-xs text-[#CBDED3] capitalize">{user.role}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${!isOpen && 'justify-center w-full'}`}>
            <div className="w-10 h-10 bg-[#CBDED3] rounded-lg flex items-center justify-center text-[#3B6255] font-bold">
                L
              </div>
              {isOpen && (
                <div>
                  <h1 className="font-bold text-sm">LIS</h1>
                  <p className="text-xs text-[#CBDED3]">System</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 hover:bg-[#8BA49A] rounded transition"
            >
              {isOpen ? '◀' : '▶'}
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-8 px-3 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive(item.path)
                    ? 'bg-[#8BA49A] text-white'
                    : 'text-[#CBDED3] hover:bg-[#5A7669] hover:text-white'
                }`}
                title={!isOpen ? item.label : ''}
              >
                <Icon className="w-5 h-5" />
                {isOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}

          {/* Admin Section Divider */}
          {isOpen && <div className="border-t border-[#8BA49A] my-4"></div>}

          {/* Admin Items */}
          {isOpen && <p className="text-xs text-[#8BA49A] font-semibold px-4 py-2">ADMINISTRATION</p>}
          {adminItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive(item.path)
                    ? 'bg-[#8BA49A] text-white'
                    : 'text-[#CBDED3] hover:bg-[#5A7669] hover:text-white'
                }`}
                title={!isOpen ? item.label : ''}
              >
                <Icon className="w-5 h-5" />
                {isOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-6 left-0 right-0 px-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-[#CBDED3] hover:bg-red-700 hover:text-white rounded-lg transition"
            title={!isOpen ? 'Logout' : ''}
          >
            <LogOut className="w-5 h-5" />
            {isOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Margin */}
      <div className={`transition-all duration-300 ${isOpen ? 'ml-64' : 'ml-20'}`}>
        {/* This spacing is managed by the parent layout */}
      </div>
    </>
  );
}
