'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Loader, MapPin, Search, KeyRound, CheckCircle2, AlertCircle, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import {
  Doctor, DoctorInput, fetchDoctors, addDoctor, updateDoctor, deleteDoctor, createDoctorAccount, areaLabel,
} from '@/lib/doctors';
import { DOCTOR_SPECIALIZATIONS, SERVICE_AREA } from '@/config/constants';
import BarangaySelect, { FixedField } from '@/components/BarangaySelect';

const OTHER_SPEC = '__other__';
const isPredefinedSpec = (v?: string | null) => DOCTOR_SPECIALIZATIONS.some(s => s.name === v);

const EMPTY: DoctorInput = {
  full_name: '',
  specialization: '',
  contact_no: '',
  email: '',
  clinic_name: '',
  area_barangay: '',
  area_municipality: SERVICE_AREA.city,
  area_province: SERVICE_AREA.province,
  status: 'active',
};

const inputCls = (err?: string) =>
  `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] outline-none text-gray-800 bg-white ${err ? 'border-red-500' : 'border-gray-300'}`;

export default function DoctorsPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [specOther, setSpecOther] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');

  const [accountFor, setAccountFor] = useState<Doctor | null>(null);
  const [password, setPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchDoctors();
    setDoctors(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const areas = useMemo(() => [...new Set(doctors.map(areaLabel))].sort(), [doctors]);

  const filtered = doctors.filter(d => {
    if (areaFilter && areaLabel(d) !== areaFilter) return false;
    const q = search.toLowerCase();
    return !q || [d.full_name, d.specialization, d.clinic_name, d.email]
      .some(v => v?.toLowerCase().includes(q));
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Full name is required';
    if (!form.area_barangay?.trim()) e.area_barangay = 'Barangay is required';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!editingId && tempPassword) {
      if (!form.email?.trim()) e.email = 'An email is required to create a login';
      if (tempPassword.length < 8) e.tempPassword = 'Temporary password must be at least 8 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setForm(EMPTY);
    setErrors({});
    setEditingId(null);
    setShowForm(false);
    setSpecOther(false);
    setTempPassword('');
    setShowTempPassword(false);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setNotice(null);
    const payload: DoctorInput = {
      ...form,
      full_name: form.full_name.trim(),
      area_barangay: form.area_barangay?.trim() || null,
      area_municipality: SERVICE_AREA.city,
      area_province: SERVICE_AREA.province,
    };
    try {
      if (editingId) {
        await updateDoctor(editingId, payload, user);
        setNotice({ type: 'ok', text: `${payload.full_name} updated.` });
      } else {
        const saved = await addDoctor(payload, user);
        if (saved && tempPassword) {
          try {
            const res = await createDoctorAccount(saved.id, tempPassword);
            setNotice({ type: 'ok', text: `${payload.full_name} added with a temporary login (${res.email}). Give them the password privately; they'll be asked to change it on first sign-in.` });
          } catch (accErr: any) {
            setNotice({ type: 'err', text: `${payload.full_name} was added, but the login could not be created: ${accErr.message} Use the Login button in their row to try again.` });
          }
        } else {
          setNotice({ type: 'ok', text: `${payload.full_name} added. Use the Login button in their row to give them access.` });
        }
      }
      resetForm();
      await load();
    } catch (err: any) {
      const msg = /relation .*doctors|schema cache/i.test(err.message)
        ? 'The doctors table does not exist yet. Run database/migrations/001_doctors_admin.sql in Supabase.'
        : err.message;
      setNotice({ type: 'err', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (d: Doctor) => {
    setForm({
      full_name: d.full_name,
      specialization: d.specialization || '',
      contact_no: d.contact_no || '',
      email: d.email || '',
      clinic_name: d.clinic_name || '',
      area_barangay: d.area_barangay || '',
      area_municipality: SERVICE_AREA.city,
      area_province: SERVICE_AREA.province,
      status: d.status,
    });
    setSpecOther(!!d.specialization && !isPredefinedSpec(d.specialization));
    setEditingId(d.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (d: Doctor) => {
    if (!confirm(`Delete ${d.full_name}${d.user_id ? ' and their login' : ''}? Doctors with test requests can't be deleted; set them Inactive instead.`)) return;
    try {
      await deleteDoctor(d, user);
      await load();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message });
    }
  };

  const toggleStatus = async (d: Doctor) => {
    try {
      await updateDoctor(d.id, { full_name: d.full_name, status: d.status === 'active' ? 'inactive' : 'active' }, user);
      await load();
    } catch (err: any) {
      setNotice({ type: 'err', text: err.message });
    }
  };

  const submitAccount = async () => {
    if (!accountFor) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await createDoctorAccount(accountFor.id, password);
      setNotice({ type: 'ok', text: `Temporary login ready for ${accountFor.full_name} (${res.email}). Give them the password privately; they'll be asked to change it on first sign-in.` });
      setAccountFor(null);
      setPassword('');
      await load();
    } catch (err: any) {
      setAccountError(err.message);
    } finally {
      setAccountBusy(false);
    }
  };

  const field = (key: keyof DoctorInput, label: string, opts: { required?: boolean; placeholder?: string; list?: string; type?: string; readOnly?: boolean; hint?: string } = {}) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {opts.required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={opts.type || 'text'}
        list={opts.list}
        value={(form[key] as string) || ''}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={opts.placeholder}
        readOnly={opts.readOnly}
        className={`${inputCls(errors[key])} ${opts.readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
      {errors[key] ? <p className="text-red-500 text-sm mt-1">{errors[key]}</p>
        : opts.hint ? <p className="text-xs text-gray-500 mt-1">{opts.hint}</p> : null}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Predefined Doctors</h1>
          <p className="text-gray-600 text-sm mt-1">
            Doctors assigned to each area. Lab staff pick from these when creating a test request for a patient in that area.
          </p>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2 w-fit"
        >
          {showForm ? <><X className="w-5 h-5" /> Cancel</> : <><Plus className="w-5 h-5" /> Add Doctor</>}
        </button>
      </div>

      {notice && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${notice.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {notice.type === 'ok' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm flex-1">{notice.text}</p>
          <button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{editingId ? 'Edit Doctor' : 'Add Doctor'}</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('full_name', 'Full Name', { required: true, placeholder: 'e.g. Dr. Juan Dela Cruz' })}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Specialization</label>
                <select
                  value={specOther ? OTHER_SPEC : form.specialization || ''}
                  onChange={e => {
                    if (e.target.value === OTHER_SPEC) {
                      setSpecOther(true);
                      setForm({ ...form, specialization: '' });
                    } else {
                      setSpecOther(false);
                      setForm({ ...form, specialization: e.target.value });
                    }
                  }}
                  className={inputCls()}
                >
                  <option value="">Select specialization</option>
                  {DOCTOR_SPECIALIZATIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  <option value={OTHER_SPEC}>Other (type it)…</option>
                </select>
                {specOther && (
                  <input
                    type="text"
                    value={form.specialization || ''}
                    onChange={e => setForm({ ...form, specialization: e.target.value })}
                    placeholder="Type the specialization"
                    className={`${inputCls()} mt-2`}
                  />
                )}
                {(() => {
                  const spec = DOCTOR_SPECIALIZATIONS.find(s => s.name === form.specialization);
                  return spec ? (
                    <p className="text-xs text-gray-500 mt-1">Usually requests: {spec.sections.join(', ')}</p>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Area — Barangay <span className="text-red-500">*</span>
                </label>
                <BarangaySelect
                  value={form.area_barangay || ''}
                  onChange={v => setForm({ ...form, area_barangay: v })}
                  className={inputCls(errors.area_barangay)}
                />
                {errors.area_barangay && <p className="text-red-500 text-sm mt-1">{errors.area_barangay}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FixedField label="City" value={SERVICE_AREA.city} />
                <FixedField label="Province" value={SERVICE_AREA.province} />
              </div>
              {field('clinic_name', 'Clinic / Hospital', { placeholder: 'e.g. Makati Medical Center' })}
              {field('contact_no', 'Contact No.', { placeholder: 'e.g. 0917 123 4567' })}
              {(() => {
                // Once a login exists, the email is the sign-in name and can't be changed here
                const hasLogin = !!editingId && !!doctors.find(d => d.id === editingId)?.user_id;
                return field('email', 'Email (used for the doctor login)', {
                  type: 'email',
                  placeholder: 'doctor@clinic.com',
                  readOnly: hasLogin,
                  hint: hasLogin ? "This doctor already has a login, so the email can't be changed." : undefined,
                });
              })()}
              {!editingId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Temporary Password <span className="text-gray-400 font-normal">(optional, creates the login)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showTempPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={tempPassword}
                      onChange={e => setTempPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className={`${inputCls(errors.tempPassword)} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowTempPassword(!showTempPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#3B6255]"
                      aria-label={showTempPassword ? 'Hide password' : 'Show password'}
                    >
                      {showTempPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.tempPassword ? (
                    <p className="text-red-500 text-sm mt-1">{errors.tempPassword}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">The doctor must change it on first sign-in. Leave blank to add the login later.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as Doctor['status'] })}
                  className={inputCls()}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (hidden from test requests)</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Lab staff will see this doctor when creating a test request for a patient from the same barangay.
            </p>
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Doctor' : 'Add Doctor'}
              </button>
              <button type="button" onClick={resetForm} className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, specialization, clinic, email…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-[#3B6255] outline-none"
          />
        </div>
        <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-800 bg-white md:w-64">
          <option value="">All areas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Doctors ({filtered.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader className="w-8 h-8 text-[#3B6255] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-gray-500">
            No doctors found. If you just set this up, run <code>database/migrations/001_doctors_admin.sql</code> in Supabase, then add doctors here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  {['Doctor', 'Area', 'Clinic', 'Contact', 'Status', 'Login', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-6 font-semibold text-gray-700 text-sm">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                    <td className="py-3 px-6">
                      <p className="font-medium text-gray-800">{d.full_name}</p>
                      <p className="text-xs text-gray-500">{d.specialization || '—'}</p>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-700">
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-[#5A7669]" />{areaLabel(d)}</span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600">{d.clinic_name || '—'}</td>
                    <td className="py-3 px-6 text-sm text-gray-600">
                      <p>{d.contact_no || '—'}</p>
                      <p className="text-xs text-gray-400">{d.email || ''}</p>
                    </td>
                    <td className="py-3 px-6">
                      <button
                        onClick={() => toggleStatus(d)}
                        title="Click to toggle"
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${d.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}
                      >
                        {d.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-6 text-sm">
                      {d.user_id ? (
                        <span className="text-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Enabled</span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex gap-3">
                        <button onClick={() => handleEdit(d)} className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1">
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                        <button
                          onClick={() => { setAccountFor(d); setPassword(''); setAccountError(null); }}
                          disabled={!d.email}
                          title={d.email ? '' : 'Add an email first'}
                          className="text-blue-700 hover:text-blue-900 font-semibold text-sm flex items-center gap-1 disabled:opacity-40"
                        >
                          <KeyRound className="w-4 h-4" /> {d.user_id ? 'Reset' : 'Login'}
                        </button>
                        <button onClick={() => handleDelete(d)} className="text-red-600 hover:text-red-800 font-semibold text-sm flex items-center gap-1">
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / reset login modal */}
      {accountFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-1">{accountFor.user_id ? 'Reset doctor login' : 'Create doctor login'}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {accountFor.full_name} signs in with <b>{accountFor.email}</b> and this <b>temporary</b> password.
              On first sign-in they must replace it with their own, so only they will know it.
            </p>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Temporary password (min. 8 characters)</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputCls()}
              autoFocus
            />
            {accountError && <p className="text-red-600 text-sm mt-2">{accountError}</p>}
            <div className="flex gap-3 mt-6">
              <button
                onClick={submitAccount}
                disabled={accountBusy || password.length < 8}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {accountBusy ? 'Saving…' : 'Save login'}
              </button>
              <button onClick={() => setAccountFor(null)} className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
