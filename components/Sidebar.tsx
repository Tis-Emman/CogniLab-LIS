'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  Menu,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(true); // Always show full sidebar on mobile when open
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut();
    // signOut handles redirect internally via window.location.href
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



  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="fixed top-4 left-4 z-50 p-2 bg-[#3B6255] text-white rounded-lg shadow-lg md:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-[#3B6255] to-green-900 text-white transition-all duration-300 shadow-lg z-40
          ${isMobile 
            ? `w-64 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}` 
            : `${isOpen ? 'w-64' : 'w-20'}`
          }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#8BA49A]">
          {(isOpen || isMobile) && user && (
            <div className="mb-4 pb-4 border-b border-[#8BA49A]">
              <p className="text-xs text-[#CBDED3] font-semibold">LOGGED IN AS</p>
              <p className="text-sm font-semibold text-white mt-1">{user.full_name || user.email}</p>
              <p className="text-xs text-[#CBDED3] capitalize">{user.role}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${!isOpen && !isMobile && 'justify-center w-full'}`}>
              <div className="w-10 h-10 bg-[#CBDED3] rounded-lg flex items-center justify-center text-[#3B6255] font-bold">
                C
              </div>
              {(isOpen || isMobile) && (
                <div>
                  <h1 className="font-bold text-sm">CogniLab</h1>
                  <p className="text-xs text-[#CBDED3]">Laboratory</p>
                </div>
              )}
            </div>
            {!isMobile && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 hover:bg-[#8BA49A] rounded transition"
              >
                {isOpen ? '◀' : '▶'}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-8 px-3 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
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
                title={!isOpen && !isMobile ? item.label : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {(isOpen || isMobile) && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}

        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-6 left-0 right-0 px-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-[#CBDED3] hover:bg-red-700 hover:text-white rounded-lg transition"
            title={!isOpen && !isMobile ? 'Logout' : ''}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {(isOpen || isMobile) && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}