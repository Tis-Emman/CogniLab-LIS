'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader, Stethoscope, Users, ClipboardList, MapPin, History, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { fetchUsers, fetchAuditLogs } from '@/lib/database';
import { fetchDoctors, areaLabel, Doctor } from '@/lib/doctors';
import { roleLabel } from '@/lib/roles';

interface RequestRow {
  id: string;
  status: string;
  doctor_id?: string | null;
  requesting_physician?: string;
  created_at: string;
}

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [docs, usr, lg] = await Promise.all([fetchDoctors(), fetchUsers(), fetchAuditLogs()]);
      let reqs: RequestRow[] = [];
      if (!USE_MOCK_DATA) {
        const { data } = await supabase
          .from('test_requests')
          .select('id, status, doctor_id, requesting_physician, created_at');
        reqs = (data as RequestRow[]) || [];
      }
      setDoctors(docs);
      setUsers(usr || []);
      setRequests(reqs);
      setLogs((lg || []).slice(0, 8));
      setLoading(false);
    })();
  }, []);

  const activeDoctors = doctors.filter(d => d.status === 'active');

  const doctorsByArea = useMemo(() => {
    const m = new Map<string, number>();
    activeDoctors.forEach(d => m.set(areaLabel(d), (m.get(areaLabel(d)) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [activeDoctors]);

  const usersByRole = useMemo(() => {
    const m = new Map<string, number>();
    users.forEach(u => m.set(u.role, (m.get(u.role) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [users]);

  const requestsByStatus = useMemo(() => {
    const m: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    requests.forEach(r => { m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  }, [requests]);

  const topDoctors = useMemo(() => {
    const m = new Map<string, number>();
    requests.forEach(r => { if (r.doctor_id) m.set(r.doctor_id, (m.get(r.doctor_id) || 0) + 1); });
    return [...m.entries()]
      .map(([id, count]) => ({ doctor: doctors.find(d => d.id === id), count }))
      .filter(x => x.doctor)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [requests, doctors]);

  const unlinkedRequests = requests.filter(r => !r.doctor_id).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
      </div>
    );
  }

  const stat = (label: string, value: number | string, Icon: any, color: string, sub?: string) => (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <Icon className="w-10 h-10 text-[#8BA49A]" />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Admin Overview</h1>
        <p className="text-gray-600 text-sm mt-1">Doctors, users, and request activity across the laboratory.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stat('Active Doctors', activeDoctors.length, Stethoscope, 'border-[#3B6255]', `${doctors.length - activeDoctors.length} inactive`)}
        {stat('Areas Covered', doctorsByArea.length, MapPin, 'border-green-600')}
        {stat('System Users', users.length, Users, 'border-blue-600')}
        {stat('Test Requests', requests.length, ClipboardList, 'border-yellow-500', `${requestsByStatus.pending} pending`)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctors per area */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Doctors per Area</h2>
            <Link href="/admin/doctors" className="text-sm text-[#3B6255] font-semibold flex items-center gap-1 hover:underline">
              Manage <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {doctorsByArea.length === 0 ? (
            <p className="text-gray-500 text-sm">No doctors yet. Add them in the Doctors page.</p>
          ) : (
            <ul className="space-y-2">
              {doctorsByArea.map(([area, count]) => (
                <li key={area} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-700"><MapPin className="w-4 h-4 text-[#5A7669]" />{area}</span>
                  <span className="font-semibold text-gray-800">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Request status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Test Requests by Status</h2>
          <ul className="space-y-3">
            {Object.entries(requestsByStatus).map(([status, count]) => {
              const pct = requests.length ? Math.round((count / requests.length) * 100) : 0;
              return (
                <li key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-gray-700">{status.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-800">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded">
                    <div className="h-2 bg-[#3B6255] rounded" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {unlinkedRequests > 0 && (
            <p className="text-xs text-gray-500 mt-4">
              {unlinkedRequests} request(s) were entered with a typed physician name and aren&apos;t linked to a predefined doctor.
            </p>
          )}
        </div>

        {/* Top requesting doctors */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Top Requesting Doctors</h2>
          {topDoctors.length === 0 ? (
            <p className="text-gray-500 text-sm">No requests linked to a predefined doctor yet.</p>
          ) : (
            <ul className="space-y-2">
              {topDoctors.map(({ doctor, count }) => (
                <li key={doctor!.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {doctor!.full_name} <span className="text-gray-400">· {areaLabel(doctor!)}</span>
                  </span>
                  <span className="font-semibold text-gray-800">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Users by role */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Users by Role</h2>
            <Link href="/admin/users" className="text-sm text-[#3B6255] font-semibold flex items-center gap-1 hover:underline">
              Manage <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <ul className="space-y-2">
            {usersByRole.map(([role, count]) => (
              <li key={role} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{roleLabel(role)}</span>
                <span className="font-semibold text-gray-800">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><History className="w-5 h-5" /> Recent Activity</h2>
          <Link href="/admin/audit-log" className="text-sm text-[#3B6255] font-semibold flex items-center gap-1 hover:underline">
            Full audit log <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-sm">No activity recorded.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logs.map(l => (
              <li key={l.id} className="py-2 text-sm flex justify-between gap-4">
                <span className="text-gray-700">
                  <span className="font-semibold">{l.user_name}</span> — {l.description || `${l.action} ${l.resource}`}
                </span>
                <span className="text-gray-400 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
