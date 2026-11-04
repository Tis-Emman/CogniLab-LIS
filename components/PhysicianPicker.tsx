'use client';

import { useEffect, useMemo, useState } from 'react';
import { Stethoscope, MapPin } from 'lucide-react';
import { Doctor, fetchDoctors, doctorServesArea, areaLabel } from '@/lib/doctors';

export interface PhysicianValue {
  doctorId: string | null;
  name: string;
}

interface Props {
  /** Patient's barangay (Baliwag City) */
  barangay?: string | null;
  value: PhysicianValue;
  onChange: (v: PhysicianValue) => void;
  className?: string;
}

const OTHER = '__other__';

/**
 * Requesting-physician selector. Lists the predefined doctors for the patient's
 * area first; staff can widen to all areas or type a name that isn't listed.
 */
export default function PhysicianPicker({ barangay, value, onChange, className }: Props) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    fetchDoctors({ activeOnly: true }).then(d => { setDoctors(d); setLoaded(true); });
  }, []);

  const inArea = useMemo(
    () => doctors.filter(d => doctorServesArea(d, barangay)),
    [doctors, barangay],
  );
  const listed = showAll ? doctors : inArea;
  const hasArea = !!barangay;

  // Fall back to typing when nothing is predefined.
  const forceManual = loaded && doctors.length === 0;
  const isManual = manual || forceManual;

  const selectValue = isManual ? OTHER : value.doctorId || '';

  const handleSelect = (v: string) => {
    if (v === OTHER) {
      setManual(true);
      onChange({ doctorId: null, name: '' });
      return;
    }
    setManual(false);
    const d = doctors.find(x => x.id === v);
    onChange({ doctorId: d?.id || null, name: d?.full_name || '' });
  };

  // Clear a selection that no longer fits the patient's area.
  useEffect(() => {
    if (value.doctorId && !showAll && loaded && !inArea.some(d => d.id === value.doctorId)) {
      onChange({ doctorId: null, name: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangay, loaded]);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        <Stethoscope className="w-4 h-4 inline mr-1" />
        Requesting Physician <span className="text-red-500">*</span>
      </label>

      {!forceManual && (
        <select value={selectValue} onChange={e => handleSelect(e.target.value)} className={className}>
          <option value="">
            {!loaded ? 'Loading doctors…' : listed.length ? 'Select a doctor' : 'No doctors for this barangay'}
          </option>
          {listed.map(d => (
            <option key={d.id} value={d.id}>
              {d.full_name}{d.specialization ? ` — ${d.specialization}` : ''}{showAll ? ` (${areaLabel(d)})` : ''}
            </option>
          ))}
          <option value={OTHER}>Other (type a name)…</option>
        </select>
      )}

      {isManual && (
        <input
          type="text"
          value={value.name}
          onChange={e => onChange({ doctorId: null, name: e.target.value })}
          placeholder="e.g. Dr. Juan Dela Cruz"
          className={`${className || ''} ${forceManual ? '' : 'mt-2'}`}
        />
      )}

      {!forceManual && (
        <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {hasArea ? `Brgy. ${barangay} · ${inArea.length} doctor(s)` : 'Patient has no barangay; tick "All areas" or set it on the Patients page'}
          </span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            All areas
          </label>
        </div>
      )}
    </div>
  );
}
