'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader, Wallet, Clock, Receipt, TrendingUp, Download, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchBilling, logActivity } from '@/lib/database';
import { useAuth } from '@/lib/authContext';
import { toPHDate } from '@/lib/dates';

/**
 * Admin → Revenue: read-only view of the laboratory's finances, from the billing table.
 *  - Collected = PAID bills, dated by when they were paid (date_paid; older bills
 *    without it fall back to the date the bill was created)
 *  - Outstanding = UNPAID bills right now, whatever the period
 * Admins can read billing but not change it (RLS, migration 005); payments are
 * still recorded by the lab staff in Billing.
 */

interface Bill {
  id: string;
  patient_name: string;
  test_name: string;
  section: string;
  amount: number;
  status: 'paid' | 'unpaid';
  date_created: string;
  created_at?: string;
  date_paid?: string | null;
  or_number?: string | null;
}

type Period = 'today' | '7d' | 'month' | 'last_month' | 'year' | 'all' | 'custom';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

const BAR = '#25845E'; // validated single-series chart green (contrast + chroma)

const peso = (n: number) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pesoShort = (n: number) =>
  n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `₱${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k` : `₱${n}`;

/** date_paid is stored without a time zone (UTC); read it as UTC, then take the PH calendar date. */
const phDateOf = (ts?: string | null): string | null => {
  if (!ts) return null;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : toPHDate(d);
};

/** The day a paid bill counts as revenue */
const paidDay = (b: Bill) => phDateOf(b.date_paid) || b.date_created;

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function AdminRevenuePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const today = toPHDate();
  const [customFrom, setCustomFrom] = useState(today.slice(0, 8) + '01');
  const [customTo, setCustomTo] = useState(today);

  useEffect(() => {
    (async () => {
      const data = await fetchBilling();
      setBills(((data as Bill[]) || []).map(b => ({ ...b, amount: Number(b.amount) || 0 })));
      setLoading(false);
      if (user) {
        await logActivity({
          user_id: user.id,
          user_name: user.full_name,
          encryption_key: user.encryption_key,
          action: 'view',
          resource: 'Revenue',
          resource_type: 'Finances',
          description: `${user.full_name} opened the revenue report`,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [from, to] inclusive, PH calendar dates
  const range = useMemo((): [string, string] => {
    const y = today.slice(0, 4);
    const ym = today.slice(0, 7);
    switch (period) {
      case 'today': return [today, today];
      case '7d': return [addDays(today, -6), today];
      case 'month': return [`${ym}-01`, today];
      case 'last_month': {
        const firstThis = `${ym}-01`;
        const lastPrev = addDays(firstThis, -1);
        return [`${lastPrev.slice(0, 7)}-01`, lastPrev];
      }
      case 'year': return [`${y}-01-01`, today];
      case 'custom': return customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
      case 'all': {
        const days = bills.map(b => (b.status === 'paid' ? paidDay(b) : b.date_created)).filter(Boolean).sort();
        return [days[0] || today, today];
      }
    }
  }, [period, today, customFrom, customTo, bills]);

  const inRange = (d?: string | null) => !!d && d >= range[0] && d <= range[1];

  const paidInPeriod = useMemo(
    () => bills.filter(b => b.status === 'paid' && inRange(paidDay(b)))
      .sort((a, b) => (paidDay(b) || '').localeCompare(paidDay(a) || '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bills, range],
  );
  const issuedInPeriod = useMemo(
    () => bills.filter(b => inRange(b.date_created)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bills, range],
  );
  const outstanding = useMemo(
    () => bills.filter(b => b.status !== 'paid').sort((a, b) => a.date_created.localeCompare(b.date_created)),
    [bills],
  );

  const collected = paidInPeriod.reduce((s, b) => s + b.amount, 0);
  const issuedTotal = issuedInPeriod.reduce((s, b) => s + b.amount, 0);
  const issuedPaid = issuedInPeriod.filter(b => b.status === 'paid').reduce((s, b) => s + b.amount, 0);
  const collectionRate = issuedTotal ? Math.round((issuedPaid / issuedTotal) * 100) : null;
  const outstandingTotal = outstanding.reduce((s, b) => s + b.amount, 0);
  const overdue = outstanding.filter(b => daysBetween(b.date_created, today) > 7);

  // Collected per day (ranges up to ~2 months) or per month
  const series = useMemo(() => {
    const span = daysBetween(range[0], range[1]);
    const monthly = span > 62;
    const buckets = new Map<string, number>();
    if (monthly) {
      for (let m = range[0].slice(0, 7); m <= range[1].slice(0, 7); ) {
        buckets.set(m, 0);
        const [yy, mm] = m.split('-').map(Number);
        m = mm === 12 ? `${yy + 1}-01` : `${yy}-${String(mm + 1).padStart(2, '0')}`;
      }
    } else {
      for (let d = range[0]; d <= range[1]; d = addDays(d, 1)) buckets.set(d, 0);
    }
    paidInPeriod.forEach(b => {
      const key = monthly ? (paidDay(b) || '').slice(0, 7) : paidDay(b) || '';
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + b.amount);
    });
    return {
      monthly,
      data: [...buckets.entries()].map(([key, total]) => ({
        key,
        label: monthly ? monthLabel(key) : dayLabel(key),
        total,
      })),
    };
  }, [paidInPeriod, range]);

  const group = (rows: Bill[], keyOf: (b: Bill) => string) => {
    const m = new Map<string, { total: number; count: number }>();
    rows.forEach(b => {
      const k = keyOf(b) || '—';
      const cur = m.get(k) || { total: 0, count: 0 };
      m.set(k, { total: cur.total + b.amount, count: cur.count + 1 });
    });
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
  };
  const bySection = useMemo(() => group(paidInPeriod, b => (b.section || '').toUpperCase()), [paidInPeriod]);
  const byTest = useMemo(() => group(paidInPeriod, b => b.test_name).slice(0, 8), [paidInPeriod]);

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Date Paid', 'OR No.', 'Patient', 'Test', 'Section', 'Amount'];
    const rows = paidInPeriod.map(b => [paidDay(b), b.or_number || '', b.patient_name, b.test_name, b.section, b.amount.toFixed(2)]);
    const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognilab-revenue_${range[0]}_to_${range[1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-8 h-8 text-[#3B6255] animate-spin" /></div>;
  }

  const stat = (label: string, value: string, Icon: any, color: string, sub?: string) => (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${color}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-600">{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-800 mt-1 tabular-nums truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <Icon className="w-9 h-9 text-[#8BA49A] flex-shrink-0" />
      </div>
    </div>
  );

  const rangeText = range[0] === range[1] ? dayLabel(range[0]) : `${dayLabel(range[0])} – ${dayLabel(range[1])}, ${range[1].slice(0, 4)}`;
  const maxSection = bySection[0]?.total || 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Revenue</h1>
          <p className="text-gray-600 text-sm mt-1">Payments collected and balances still owed, from Billing. View only.</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={paidInPeriod.length === 0}
          className="px-4 py-2 border-2 border-[#3B6255] text-[#3B6255] rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-[#F0F4F1] disabled:opacity-40 disabled:cursor-not-allowed self-start md:self-auto"
        >
          <Download className="w-4 h-4" /> Export payments (CSV)
        </button>
      </div>

      {/* Period filter — one row above everything it controls */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
              period === p.id ? 'bg-[#3B6255] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customFrom} max={today} onChange={e => setCustomFrom(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-800 bg-white" />
            <span className="text-gray-500">to</span>
            <input type="date" value={customTo} max={today} onChange={e => setCustomTo(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-gray-800 bg-white" />
          </div>
        )}
        <span className="text-sm text-gray-500 md:ml-auto">{rangeText}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stat('Revenue Collected', peso(collected), Wallet, 'border-[#3B6255]', `${paidInPeriod.length} paid bill(s) in this period`)}
        {stat('Billed', peso(issuedTotal), Receipt, 'border-blue-600', `${issuedInPeriod.length} bill(s) issued in this period`)}
        {stat('Collection Rate', collectionRate === null ? '—' : `${collectionRate}%`, TrendingUp, 'border-green-600', 'of the amount billed in this period is paid')}
        {stat('Outstanding Now', peso(outstandingTotal), Clock, 'border-yellow-500', `${outstanding.length} unpaid bill(s), all dates`)}
      </div>

      {/* Collected over time */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-800">Revenue collected {series.monthly ? 'per month' : 'per day'}</h2>
        <p className="text-xs text-gray-500 mb-4">Counted on the day the bill was paid.</p>
        {collected === 0 ? (
          <p className="text-gray-500 text-sm py-10 text-center">No payments were collected in this period.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="#EEF0EF" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#D1D5DB' }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={pesoShort} tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={56} />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 98, 85, 0.08)' }}
                  formatter={(v: any) => [peso(Number(v)), 'Collected']}
                  labelStyle={{ color: '#111827', fontWeight: 600 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13 }}
                />
                <Bar dataKey="total" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Collected by Section</h2>
          {bySection.length === 0 ? (
            <p className="text-gray-500 text-sm">No payments in this period.</p>
          ) : (
            <ul className="space-y-3">
              {bySection.map(s => (
                <li key={s.name}>
                  <div className="flex justify-between text-sm mb-1 gap-3">
                    <span className="text-gray-700">{s.name} <span className="text-gray-400">· {s.count}</span></span>
                    <span className="font-semibold text-gray-800 tabular-nums">{peso(s.total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded">
                    <div className="h-2 rounded" style={{ width: `${Math.max(2, (s.total / maxSection) * 100)}%`, background: BAR }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top tests */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Top Tests by Revenue</h2>
          {byTest.length === 0 ? (
            <p className="text-gray-500 text-sm">No payments in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 font-semibold">Test</th>
                  <th className="py-2 font-semibold text-right">Paid</th>
                  <th className="py-2 font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byTest.map(t => (
                  <tr key={t.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 text-gray-800">{t.name}</td>
                    <td className="py-2 text-right text-gray-600 tabular-nums">{t.count}</td>
                    <td className="py-2 text-right font-semibold text-gray-800 tabular-nums">{peso(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Outstanding balances */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-800">Outstanding Balances</h2>
          {overdue.length > 0 && (
            <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded flex items-center gap-1 self-start">
              <AlertTriangle className="w-3.5 h-3.5" /> {overdue.length} unpaid for more than 7 days
            </span>
          )}
        </div>
        {outstanding.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">No unpaid bills. Everything billed has been collected.</p>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  {['Billed on', 'Patient', 'Test', 'Section', 'Days unpaid', 'Amount'].map(h => (
                    <th key={h} className={`px-6 py-3 font-semibold ${h === 'Amount' || h === 'Days unpaid' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outstanding.map(b => {
                  const age = Math.max(0, daysBetween(b.date_created, today));
                  return (
                    <tr key={b.id} className="border-t border-gray-100">
                      <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{b.date_created}</td>
                      <td className="px-6 py-3 text-gray-800">{b.patient_name}</td>
                      <td className="px-6 py-3 text-gray-700">{b.test_name}</td>
                      <td className="px-6 py-3 text-gray-500">{b.section}</td>
                      <td className={`px-6 py-3 text-right tabular-nums ${age > 7 ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>{age}</td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-800 tabular-nums">{peso(b.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments in the period */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Payments in this Period ({paidInPeriod.length})</h2>
        </div>
        {paidInPeriod.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">No payments in this period.</p>
        ) : (
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  {['Date paid', 'OR No.', 'Patient', 'Test', 'Section', 'Amount'].map(h => (
                    <th key={h} className={`px-6 py-3 font-semibold ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paidInPeriod.map(b => (
                  <tr key={b.id} className="border-t border-gray-100">
                    <td className="px-6 py-3 text-gray-600 whitespace-nowrap">{paidDay(b)}</td>
                    <td className="px-6 py-3 text-gray-600">{b.or_number || <span className="text-gray-400">—</span>}</td>
                    <td className="px-6 py-3 text-gray-800">{b.patient_name}</td>
                    <td className="px-6 py-3 text-gray-700">{b.test_name}</td>
                    <td className="px-6 py-3 text-gray-500">{b.section}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-800 tabular-nums">{peso(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
