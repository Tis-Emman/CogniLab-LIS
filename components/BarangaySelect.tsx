'use client';

import { BALIWAG_BARANGAYS, SERVICE_AREA } from '@/config/constants';

interface Props {
  value: string;
  onChange: (barangay: string) => void;
  className?: string;
  placeholder?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Barangay dropdown for Baliwag City. Keeps an older free-text value visible so it isn't lost. */
export default function BarangaySelect({ value, onChange, className, placeholder = 'Select barangay' }: Props) {
  const match = BALIWAG_BARANGAYS.find(b => norm(b) === norm(value || ''));
  const legacy = value && !match ? value : null;

  return (
    <select value={match ?? value ?? ''} onChange={e => onChange(e.target.value)} className={className}>
      <option value="">{placeholder}</option>
      {legacy && <option value={legacy}>{legacy} (old entry, not in list)</option>}
      {BALIWAG_BARANGAYS.map(b => (
        <option key={b} value={b}>{b}</option>
      ))}
    </select>
  );
}

/** Read-only box for the fixed city / province. */
export function FixedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        readOnly
        tabIndex={-1}
        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-600 bg-gray-100 cursor-not-allowed"
      />
    </div>
  );
}

export { SERVICE_AREA };
