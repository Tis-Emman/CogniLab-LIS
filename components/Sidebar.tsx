'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import {
  BarChart3,
  Users,
  ClipboardList,
  Beaker,
  CreditCard,
  ShieldCheck,
  FileText,
  History,
  LogOut,
  User,
  Menu,
  X,
  FlaskConical,
  LayoutDashboard,
  Stethoscope,
  UserCog,
  KeyRound,
  Tag,
} from 'lucide-react';
import { isSeniorMedtech, roleLabel } from '@/lib/roles';
import { supabase } from '@/lib/supabaseClient';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** staff = lab dashboard (default), admin = admin panel, doctor = doctor portal */
  variant?: 'staff' | 'admin' | 'doctor';
}


export default function Sidebar({ isOpen, setIsOpen, variant = 'staff' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Work-queue badges: results waiting for a senior's QC, and results returned for correction
  const [badges, setBadges] = useState<Record<string, number>>({});
  useEffect(() => {
    if (variant !== 'staff' || !user) return;
    let active = true;
    const load = async () => {
      const me = user.full_name || '';
      const [waiting, returned] = await Promise.all([
        // Waiting for QC that *you* may check (not results you encoded yourself)
        supabase.from('test_results').select('id', { head: true, count: 'exact' })
          .eq('status', 'for_verification').or(`created_by.is.null,created_by.neq."${me.replace(/"/g, '')}"`),
        // Returned for correction: results *you* encoded
        supabase.from('test_results').select('id', { head: true, count: 'exact' })
          .eq('status', 'encoding').eq('created_by', me),
      ]);
      if (!active) return;
      setBadges({
        '/dashboard/quality-checking': waiting.count ?? 0,
        '/dashboard/results': returned.count ?? 0,
      });
    };
    load();
    const t = setInterval(load, 60000);
    return () => { active = false; clearInterval(t); };
  }, [variant, user, pathname]);

  const handleLogout = async () => {
    await signOut();
  };

  const isActive = (path: string) => pathname === path;

  const allMenuItems = [
    { label: 'Dashboard',           path: '/dashboard',                      icon: BarChart3,     seniorOnly: false },
    { label: 'Patients',            path: '/dashboard/patients',             icon: Users,         seniorOnly: false },
    { label: 'Test Request',        path: '/dashboard/test-request',         icon: ClipboardList, seniorOnly: false },
    { label: 'Billing',             path: '/dashboard/billing',              icon: CreditCard,    seniorOnly: false },
    { label: 'Specimen Tracking',   path: '/dashboard/specimen-tracking',    icon: FlaskConical,  seniorOnly: false },
    { label: 'Test Results',        path: '/dashboard/results',              icon: Beaker,        seniorOnly: false },
    { label: 'Quality Checking',    path: '/dashboard/quality-checking',     icon: ShieldCheck,   seniorOnly: true  },
    { label: 'Reports',             path: '/dashboard/report',               icon: FileText,      seniorOnly: false },
    { label: 'Access History',      path: '/dashboard/history',              icon: History,       seniorOnly: false },
    { label: 'Profile',             path: '/dashboard/profile',              icon: User,          seniorOnly: false },
  ];

  const adminMenuItems = [
    { label: 'Overview',        path: '/admin',            icon: LayoutDashboard, seniorOnly: false },
    { label: 'Doctors',         path: '/admin/doctors',    icon: Stethoscope,     seniorOnly: false },
    { label: 'Test Prices',     path: '/admin/prices',     icon: Tag,             seniorOnly: false },
    { label: 'Users',           path: '/admin/users',      icon: UserCog,         seniorOnly: false },
    { label: 'Audit Log',       path: '/admin/audit-log',  icon: History,         seniorOnly: false },
  ];

  const doctorMenuItems = [
    { label: 'My Dashboard',    path: '/doctor',           icon: LayoutDashboard, seniorOnly: false },
    { label: 'Change Password', path: '/doctor/password',  icon: KeyRound,        seniorOnly: false },
  ];

  // Quality Checking is for senior MedTechs/faculty only (separation of duties)
  const canAccessQC = isSeniorMedtech(user);
  const staffItems = allMenuItems.filter(item => !item.seniorOnly || canAccessQC);
  const menuItems =
    variant === 'admin' ? adminMenuItems : variant === 'doctor' ? doctorMenuItems : staffItems;

  // Divider before Access History (staff) or before the switch link (admin)
  const dividerPath = variant === 'admin' ? '/admin/audit-log' : '/dashboard/history';
  const historyIndex = menuItems.findIndex(i => i.path === dividerPath);

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
              <p className="text-xs text-[#CBDED3]">{roleLabel(user.role)}</p>
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
        <nav className="mt-8 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const showDivider = index === historyIndex;

            return (
              <div key={item.path}>
                {showDivider && (
                  <div className="border-t border-[#8BA49A] my-2" />
                )}
                <Link
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive(item.path)
                      ? 'bg-[#8BA49A] text-white'
                      : 'text-[#CBDED3] hover:bg-[#5A7669] hover:text-white'
                  }`}
                  title={!isOpen && !isMobile ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {(isOpen || isMobile) && (
                    <span className="text-sm font-medium flex-1">{item.label}</span>
                  )}
                  {badges[item.path] > 0 && (
                    <span
                      title={item.path === '/dashboard/results' ? 'Returned by QC for correction' : 'Waiting for Senior MedTech verification'}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.path === '/dashboard/results' ? 'bg-red-500' : 'bg-yellow-400 text-gray-900'}`}
                    >
                      {badges[item.path]}
                    </span>
                  )}
                </Link>
              </div>
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