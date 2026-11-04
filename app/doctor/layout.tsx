'use client';

import PortalShell from '@/components/PortalShell';

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell role="doctor" title="Doctor Portal">
      {children}
    </PortalShell>
  );
}
