'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader, Save, Search, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { logActivity } from '@/lib/database';
import { REQUEST_SECTIONS, REQUEST_TESTS } from '@/config/testCatalog';
import { TestPrice, defaultPrice, fetchTestPrices, saveTestPrice } from '@/lib/prices';

const k = (section: string, test: string) => `${section}::${test}`;

export default function TestPricesPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<TestPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setSaved(await fetchTestPrices());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const savedMap = useMemo(() => new Map(saved.map((p) => [k(p.section, p.test_name), p])), [saved]);

  const rows = REQUEST_SECTIONS.flatMap((section) =>
    (REQUEST_TESTS[section] || []).map((test) => {
      const s = savedMap.get(k(section, test));
      const def = defaultPrice(section, test);
      const effective = s ? Number(s.price) : def;
      return { section, test, saved: s, def, effective };
    }),
  ).filter((r) =>
    (!onlyMissing || r.effective === null) &&
    (!search || `${r.section} ${r.test}`.toLowerCase().includes(search.toLowerCase())),
  );

  const missingCount = REQUEST_SECTIONS.reduce(
    (n, section) => n + (REQUEST_TESTS[section] || []).filter(
      (t) => !savedMap.has(k(section, t)) && defaultPrice(section, t) === null,
    ).length,
    0,
  );

  const save = async (section: string, test: string) => {
    const raw = drafts[k(section, test)];
    const value = Number(raw);
    if (raw === undefined || raw === '' || Number.isNaN(value) || value < 0) {
      setNotice({ ok: false, text: 'Enter a valid price (0 or more).' });
      return;
    }
    setSavingKey(k(section, test));
    try {
      await saveTestPrice(section, test, value, user?.full_name);
      await logActivity({
        user_id: user?.id,
        user_name: user?.full_name || 'Unknown User',
        encryption_key: user?.encryption_key || '',
        action: 'edit',
        resource: `Price - ${test}`,
        resource_type: 'Test Price',
        description: `Set price of ${test} (${section}) to ₱${value.toFixed(2)}`,
      });
      setDrafts((d) => { const n = { ...d }; delete n[k(section, test)]; return n; });
      setNotice({ ok: true, text: `${test}: ₱${value.toFixed(2)} saved. New requests use this price.` });
      await load();
    } catch (err: any) {
      const msg = /test_prices/.test(err.message)
        ? 'The prices table does not exist yet. Run database/migrations/011_test_prices.sql in Supabase.'
        : err.message;
      setNotice({ ok: false, text: msg });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Test Prices</h1>
        <p className="text-gray-600 text-sm mt-1">
          Prices used when a test request is created. A test with no price can&apos;t be requested until one is set here.
          Changing a price doesn&apos;t change bills that already exist.
        </p>
      </div>

      {notice && (
        <div className={`p-4 rounded-lg flex items-start gap-3 text-sm ${notice.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.ok ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {missingCount > 0 && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          ⚠️ {missingCount} test(s) have no price yet and can&apos;t be requested.
          <button onClick={() => setOnlyMissing(true)} className="ml-2 font-semibold underline">Show them</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test or section…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 bg-white"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Only tests without a price
        </label>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader className="w-8 h-8 text-[#3B6255] animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                {['Section', 'Test', 'Current price', 'Source', 'New price', ''].map((h) => (
                  <th key={h} className="text-left py-3 px-5 font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = k(r.section, r.test);
                return (
                  <tr key={id} className="border-b border-gray-100 hover:bg-[#F0F4F1]">
                    <td className="py-2 px-5 text-gray-500 text-xs">{r.section}</td>
                    <td className="py-2 px-5 text-gray-800 font-medium">{r.test}</td>
                    <td className="py-2 px-5">
                      {r.effective === null
                        ? <span className="text-red-600 font-semibold">Not set</span>
                        : <span className="text-gray-800 font-semibold">₱{r.effective.toFixed(2)}</span>}
                    </td>
                    <td className="py-2 px-5 text-xs text-gray-500">
                      {r.saved ? `Set by ${r.saved.updated_by || 'admin'}` : r.def !== null ? 'Built-in default' : '—'}
                    </td>
                    <td className="py-2 px-5">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={drafts[id] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                        placeholder={r.effective !== null ? String(r.effective) : '0.00'}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-gray-800 bg-white"
                      />
                    </td>
                    <td className="py-2 px-5">
                      <button
                        onClick={() => save(r.section, r.test)}
                        disabled={drafts[id] === undefined || drafts[id] === '' || savingKey === id}
                        className="text-[#3B6255] font-semibold flex items-center gap-1 disabled:opacity-30"
                      >
                        <Save className="w-4 h-4" /> {savingKey === id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
