'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import {
  Loader, ClipboardList, Clock, FlaskConical, CheckCircle, MapPin, Building2, Search,
  ChevronDown, ChevronUp, AlertTriangle, Stethoscope, Printer, Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/authContext';
import { logActivity, getAbnormalStatus } from '@/lib/database';
import { Doctor, fetchDoctorByUser, areaLabel } from '@/lib/doctors';

interface RequestedTest { section: string; test_name: string }

interface TestRequest {
  id: string;
  patient_id: string;
  patient_name: string;
  requesting_physician: string;
  doctor_id?: string | null;
  requested_tests: RequestedTest[];
  sample_collection_datetime: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

interface TestResult {
  id: string;
  patient_name: string;
  section: string;
  test_name: string;
  result_value: string;
  reference_range: string;
  unit: string;
  status: string;
  date_created: string;
  created_at?: string;
  updated_at?: string;
  patient_id?: string | null;
  test_request_id?: string | null;
}

const STATUS: Record<TestRequest['status'], { label: string; cls: string }> = {
  pending:     { label: 'Pending',     cls: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-800' },
  completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-800' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-800' },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' });

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [requests, setRequests] = useState<TestRequest[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  // Results released since the doctor's previous visit
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: 'CogniLab Released Results' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const doc = await fetchDoctorByUser(user);
      setDoctor(doc);
      if (!doc) { setLoading(false); return; }

      // Requests linked by doctor_id, plus older ones typed with the doctor's exact name.
      const [byId, byName] = await Promise.all([
        supabase.from('test_requests').select('*').eq('doctor_id', doc.id),
        supabase.from('test_requests').select('*').is('doctor_id', null).ilike('requesting_physician', doc.full_name),
      ]);
      const map = new Map<string, TestRequest>();
      [...(byId.data || []), ...(byName.data || [])].forEach((r: TestRequest) => map.set(r.id, r));
      const reqs = [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRequests(reqs);

      // Only released results for this doctor's requests: linked by request id,
      // plus older unlinked results matched by patient name.
      const cols = 'id, patient_name, section, test_name, result_value, reference_range, unit, status, date_created, created_at, updated_at, patient_id, test_request_id';
      const reqIds = reqs.map(r => r.id);
      const names = [...new Set(reqs.map(r => r.patient_name))];
      let released: TestResult[] = [];
      if (reqIds.length) {
        const [linked, byName] = await Promise.all([
          supabase.from('test_results').select(cols).eq('status', 'released').in('test_request_id', reqIds),
          supabase.from('test_results').select(cols).eq('status', 'released').is('test_request_id', null).in('patient_name', names),
        ]);
        // Before migration 004 the link column doesn't exist; fall back to names only.
        const nameRows = byName.error
          ? (await supabase.from('test_results')
              .select('id, patient_name, section, test_name, result_value, reference_range, unit, status, date_created, created_at, updated_at')
              .eq('status', 'released').in('patient_name', names)).data
          : byName.data;
        const m = new Map<string, TestResult>();
        [...((linked.data as TestResult[]) || []), ...((nameRows as TestResult[]) || [])].forEach(x => m.set(x.id, x));
        released = [...m.values()];
      }
      setResults(released);

      // "New since last visit" — remembered per doctor on this device
      const seenKey = `cognilab_doctor_seen_${doc.id}`;
      const lastSeen = Number(localStorage.getItem(seenKey) || 0);
      setNewIds(new Set(
        released
          .filter(x => new Date(x.updated_at || x.created_at || x.date_created).getTime() > lastSeen)
          .map(x => x.id),
      ));
      localStorage.setItem(seenKey, String(Date.now()));

      await logActivity({
        user_id: user.id,
        user_name: user.full_name,
        encryption_key: user.encryption_key,
        action: 'view',
        resource: 'Doctor Portal',
        resource_type: 'Doctor Dashboard',
        description: `${user.full_name} opened the doctor dashboard`,
      });
      setLoading(false);
    })();
  }, [user]);

  const resultsFor = (r: TestRequest) => {
    const wanted = new Set((r.requested_tests || []).map(t => t.test_name.toLowerCase()));
    return results.filter(x =>
      x.test_request_id
        ? x.test_request_id === r.id
        : x.patient_name === r.patient_name &&
          // match a requested test, or a component of a panel (e.g. CBC → Hemoglobin) in the same section
          (wanted.has(x.test_name.toLowerCase()) || (r.requested_tests || []).some(t => t.section === x.section)),
    );
  };

  const counts = useMemo(() => {
    const c = { total: requests.length, pending: 0, in_progress: 0, completed: 0 };
    requests.forEach(r => { if (r.status in c) (c as any)[r.status]++; });
    return c;
  }, [requests]);


  const filtered = requests.filter(r =>
    (!statusFilter || r.status === statusFilter) &&
    (!search || r.patient_name.toLowerCase().includes(search.toLowerCase())),
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-8 h-8 text-[#3B6255] animate-spin" /></div>;
  }

  if (!doctor) {
    return (
      <div className="bg-white rounded-lg shadow p-8 max-w-xl">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mb-3" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Your account isn&apos;t linked to a doctor profile</h1>
        <p className="text-gray-600 text-sm">
          Ask the administrator to add you under Admin Panel → Doctors with the email <b>{user?.email}</b>.
        </p>
      </div>
    );
  }

  const stat = (label: string, value: number, Icon: any, color: string) => (
    <div className={`bg-white rounded-lg shadow p-5 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <Icon className="w-9 h-9 text-[#8BA49A]" />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Profile */}
      <div className="bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-xl shadow-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#CBDED3] text-[#3B6255] flex items-center justify-center">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{doctor.full_name}</h1>
            <p className="text-[#CBDED3] text-sm">{doctor.specialization || 'Physician'}</p>
          </div>
        </div>
        <div className="text-sm space-y-1">
          <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {areaLabel(doctor)}</p>
          {doctor.clinic_name && <p className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {doctor.clinic_name}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stat('My Requests', counts.total, ClipboardList, 'border-[#3B6255]')}
        {stat('Pending', counts.pending, Clock, 'border-yellow-500')}
        {stat('In Progress', counts.in_progress, FlaskConical, 'border-blue-500')}
        {stat('Completed', counts.completed, CheckCircle, 'border-green-600')}
        {stat('New Results', newIds.size, Bell, 'border-purple-500')}
      </div>

      {newIds.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <Bell className="w-4 h-4" /> {newIds.size} result(s) were released since your last visit. They are marked <b>NEW</b> below.
        </div>
      )}

      {/* Requests */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-800">My Patients&apos; Test Requests</h2>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient…"
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-gray-800 bg-white text-sm"
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 bg-white text-sm">
              <option value="">All statuses</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-8 text-gray-500 text-sm">No test requests yet. Requests appear here when the lab selects you as the requesting physician.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(r => {
              const res = resultsFor(r);
              const open = expanded === r.id;
              return (
                <li key={r.id}>
                  <button onClick={() => setExpanded(open ? null : r.id)} className="w-full text-left px-6 py-4 hover:bg-[#F0F4F1] transition flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">{r.patient_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {fmt(r.created_at)} · {(r.requested_tests || []).map(t => t.test_name).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {res.some(x => newIds.has(x.id)) && <span className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">NEW</span>}
                      {res.length > 0 && <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded">{res.length} result(s)</span>}
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS[r.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS[r.status]?.label || r.status}
                      </span>
                      {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {open && (
                    <div className="px-6 pb-6 bg-gray-50">
                      <div className="grid md:grid-cols-2 gap-4 py-4 text-sm">
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Requested tests</p>
                          <ul className="text-gray-600 space-y-0.5">
                            {(r.requested_tests || []).map((t, i) => <li key={i}>{t.test_name} <span className="text-gray-400">({t.section})</span></li>)}
                          </ul>
                        </div>
                        <div className="space-y-1 text-gray-600">
                          <p><span className="font-semibold text-gray-700">Sample collected:</span> {fmt(r.sample_collection_datetime)}</p>
                          {r.notes && <p><span className="font-semibold text-gray-700">Notes:</span> {r.notes}</p>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-gray-700 text-sm">Released results</p>
                        {res.length > 0 && (
                          <button
                            onClick={() => handlePrint()}
                            className="text-sm font-semibold text-[#3B6255] hover:underline flex items-center gap-1"
                          >
                            <Printer className="w-4 h-4" /> Print / Save as PDF
                          </button>
                        )}
                      </div>
                      {res.length === 0 ? (
                        <p className="text-sm text-gray-500">No released results yet. Results show here once the lab releases them.</p>
                      ) : (
                        <div ref={printRef} className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                          {/* Shown only on the printout */}
                          <div className="hidden print:block p-4 border-b border-gray-300 text-sm">
                            <p className="font-bold text-base">CogniLab — KRRAX-JAM Inc. Laboratory</p>
                            <p>Patient: <b>{r.patient_name}</b></p>
                            <p>Requesting physician: {doctor.full_name}</p>
                            <p>Requested: {fmt(r.created_at)} · Printed: {fmt(new Date().toISOString())}</p>
                            <p className="text-xs mt-1">Copy of released results for the requesting physician. The signed laboratory report is issued by the laboratory.</p>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-gray-700">
                              <tr>
                                {['Test', 'Result', 'Unit', 'Reference', 'Flag', 'Date'].map(h => <th key={h} className="text-left px-4 py-2 font-semibold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {res.map(x => {
                                const flag = getAbnormalStatus(x.result_value, x.test_name, x.section);
                                return (
                                  <tr key={x.id} className="border-t border-gray-100">
                                    <td className="px-4 py-2 text-gray-800">
                                      {x.test_name}
                                      {newIds.has(x.id) && <span className="ml-2 text-[10px] font-bold text-white bg-purple-600 px-1.5 py-0.5 rounded print:hidden">NEW</span>}
                                    </td>
                                    <td className={`px-4 py-2 font-semibold whitespace-pre-line ${flag === 'normal' ? 'text-gray-800' : 'text-red-600'}`}>{x.result_value}</td>
                                    <td className="px-4 py-2 text-gray-600">{x.unit}</td>
                                    <td className="px-4 py-2 text-gray-600">{x.reference_range}</td>
                                    <td className="px-4 py-2">
                                      {flag === 'normal' ? <span className="text-gray-400">—</span> : <span className="text-xs font-bold text-red-600 uppercase">{flag.replace('-', ' ')}</span>}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500">{x.date_created}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
