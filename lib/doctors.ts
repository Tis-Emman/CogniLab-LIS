import { supabase } from './supabaseClient';
import { logActivity } from './database';
import { ilikeLiteral } from './roles';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

export interface Doctor {
  id: string;
  full_name: string;
  specialization?: string | null;
  contact_no?: string | null;
  email?: string | null;
  clinic_name?: string | null;
  area_barangay?: string | null;
  area_municipality: string;
  area_province: string;
  status: 'active' | 'inactive';
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type DoctorInput = Omit<Doctor, 'id' | 'created_at' | 'updated_at' | 'user_id'>;

// In-memory store for mock mode
let MOCK_DOCTORS: Doctor[] = [
  { id: 'doc-1', full_name: 'Dr. Ana Reyes', specialization: 'Internal Medicine', area_barangay: 'Poblacion', area_municipality: 'Baliwag City', area_province: 'Bulacan', status: 'active' },
  { id: 'doc-2', full_name: 'Dr. Carlo Santos', specialization: 'Pediatrics', area_barangay: 'Sabang', area_municipality: 'Baliwag City', area_province: 'Bulacan', status: 'active' },
];

const norm = (s?: string | null) => (s || '').trim().toLowerCase();

/** Display label for a doctor's area, e.g. "Brgy. Sabang, Baliwag City". */
export const areaLabel = (d: Pick<Doctor, 'area_barangay' | 'area_municipality' | 'area_province'>) =>
  d.area_barangay
    ? `Brgy. ${d.area_barangay}, ${d.area_municipality}`
    : `${[d.area_municipality, d.area_province].filter(Boolean).join(', ')} (no barangay set)`;

/** True when the doctor is assigned to the patient's barangay. */
export const doctorServesArea = (d: Doctor, barangay?: string | null): boolean =>
  !!d.area_barangay && !!barangay && norm(d.area_barangay) === norm(barangay);

export const fetchDoctors = async (opts: { activeOnly?: boolean } = {}): Promise<Doctor[]> => {
  if (USE_MOCK_DATA) {
    return MOCK_DOCTORS.filter(d => !opts.activeOnly || d.status === 'active');
  }
  let q = supabase.from('doctors').select('*').order('full_name');
  if (opts.activeOnly) q = q.eq('status', 'active');
  const { data, error } = await q;
  if (error) {
    console.error('Error fetching doctors:', error.message);
    return [];
  }
  return ((data as Doctor[]) || []).sort((a, b) =>
    (a.area_barangay || '~').localeCompare(b.area_barangay || '~') || a.full_name.localeCompare(b.full_name));
};

export const fetchDoctorByUser = async (user: { id: string; email: string }): Promise<Doctor | null> => {
  if (USE_MOCK_DATA) return MOCK_DOCTORS[0] || null;
  const { data: byId } = await supabase.from('doctors').select('*').eq('user_id', user.id).maybeSingle();
  if (byId) return byId as Doctor;
  const { data: byEmail } = await supabase.from('doctors').select('*').ilike('email', ilikeLiteral(user.email)).limit(1).maybeSingle();
  return (byEmail as Doctor) || null;
};

const logDoctor = (currentUser: any, action: 'edit' | 'delete', name: string, description: string) =>
  logActivity({
    user_id: currentUser?.id,
    user_name: currentUser?.full_name || 'Unknown User',
    encryption_key: currentUser?.encryption_key || '',
    action,
    resource: `Doctor - ${name}`,
    resource_type: 'Doctor',
    description,
  });

const clean = (d: Partial<DoctorInput>) => ({
  ...d,
  email: d.email?.trim() ? d.email.trim().toLowerCase() : null,
});

export const addDoctor = async (doctor: DoctorInput, currentUser?: any): Promise<Doctor | null> => {
  if (USE_MOCK_DATA) {
    const d = { id: `doc-${Date.now()}`, ...doctor } as Doctor;
    MOCK_DOCTORS.push(d);
    return d;
  }
  const { data, error } = await supabase.from('doctors').insert([clean(doctor)]).select();
  if (error) {
    console.error('Error adding doctor:', error.message);
    throw new Error(error.message);
  }
  await logDoctor(currentUser, 'edit', doctor.full_name, `Added doctor ${doctor.full_name} for ${areaLabel(doctor)}`);
  return (data?.[0] as Doctor) || null;
};

export const updateDoctor = async (id: string, doctor: Partial<DoctorInput>, currentUser?: any): Promise<Doctor | null> => {
  if (USE_MOCK_DATA) {
    const i = MOCK_DOCTORS.findIndex(d => d.id === id);
    if (i !== -1) MOCK_DOCTORS[i] = { ...MOCK_DOCTORS[i], ...doctor } as Doctor;
    return MOCK_DOCTORS[i] || null;
  }
  const { data, error } = await supabase
    .from('doctors')
    .update({ ...clean(doctor), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  if (error) {
    console.error('Error updating doctor:', error.message);
    throw new Error(error.message);
  }
  await logDoctor(currentUser, 'edit', doctor.full_name || id, `Updated doctor ${doctor.full_name || id}`);
  return (data?.[0] as Doctor) || null;
};

export const deleteDoctor = async (doctor: Doctor, currentUser?: any): Promise<boolean> => {
  if (USE_MOCK_DATA) {
    MOCK_DOCTORS = MOCK_DOCTORS.filter(d => d.id !== doctor.id);
    return true;
  }
  // Server route: refuses doctors with requests, and removes the doctor's login too
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session expired. Please sign in again.');
  const res = await fetch('/api/admin/doctor-account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ doctorId: doctor.id }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not delete the doctor.');
  await logDoctor(currentUser, 'delete', doctor.full_name, `Deleted doctor ${doctor.full_name} (and their login, if any)`);
  return true;
};

/**
 * Creates (or resets) a login for a doctor via the server route, which uses the
 * service-role key. Only callable by a signed-in admin.
 */
export const createDoctorAccount = async (doctorId: string, password: string): Promise<{ email: string }> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session expired. Please sign in again.');
  const res = await fetch('/api/admin/doctor-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ doctorId, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to create the doctor account.');
  return body;
};
