'use client';

import PortalShell from '@/components/PortalShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell role="admin" title="Admin Panel">
      {children}
    </PortalShell>
  );
}
