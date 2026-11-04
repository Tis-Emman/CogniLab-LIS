'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Lock, Shield, Loader } from 'lucide-react';
import { fetchUsers, updateUser } from '@/lib/database';
import { roleLabel } from '@/lib/roles';
import { createStaffAccount, deleteStaffAccount } from '@/lib/adminApi';
import { useAuth } from '@/lib/authContext';

type Role = 'member' | 'faculty' | 'senior_medtech' | 'admin' | 'doctor';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department: string;
  status: 'active' | 'inactive';
  join_date: string;
  last_login: string | null;
  encryption_key: string;
  signatory_name?: string | null;
  license_no?: string | null;
  signature_file?: string | null;
}

export default function UserManagementPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user: me } = useAuth();
  const [tempPassword, setTempPassword] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'member' as Role,
    department: '',
    signatory_name: '',
    license_no: '',
    signature_file: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await fetchUsers();
    setUsers(data);
    setLoading(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.department.trim()) newErrors.department = 'Department is required';
    if (!editingId && tempPassword.length < 8) newErrors.tempPassword = 'Temporary password must be at least 8 characters';
    if (editingId && editingId === me?.id) {
      const original = users.find((u) => u.id === editingId);
      if (original && original.role !== formData.role) newErrors.role = "You can't change your own role";
    }

    // Check user limits (only when adding; editing an existing user must always work)
    if (editingId) {
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }
    const memberCount = users.filter((u) => u.role === 'member' && u.id !== editingId).length;
    const facultyCount = users.filter((u) => u.role === 'faculty' && u.id !== editingId).length;

    if (formData.role === 'member' && memberCount >= 8) {
      newErrors.role = 'Maximum 8 member users allowed';
    }
    if (formData.role === 'faculty' && facultyCount >= 1) {
      newErrors.role = 'Maximum 1 faculty user allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingId) {
        // Email is the login and can't be changed here (it would break the sign-in)
        await updateUser(editingId, {
          full_name: formData.full_name,
          role: formData.role,
          department: formData.department,
          // Report signatory details (migration 004)
          signatory_name: formData.signatory_name.trim() || null,
          license_no: formData.license_no.trim() || null,
          signature_file: formData.signature_file.trim() || null,
        });
      } else {
        // Creates the login too (temporary password, changed on first sign-in)
        await createStaffAccount({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          department: formData.department.trim(),
          password: tempPassword,
        });
        setNotice(`${formData.full_name} can now sign in with ${formData.email.trim().toLowerCase()} and the temporary password. They'll be asked to change it on first sign-in.`);
      }
      await loadUsers();
      resetForm();
    } catch (error: any) {
      console.error('Error saving user:', error);
      setPageError(error?.message || 'Could not save the user.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ full_name: '', email: '', role: 'member', department: '', signatory_name: '', license_no: '', signature_file: '' });
    setErrors({});
    setShowForm(false);
    setEditingId(null);
    setTempPassword('');
  };

  const handleEdit = (user: User) => {
    setFormData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department,
      signatory_name: user.signatory_name || '',
      license_no: user.license_no || '',
      signature_file: user.signature_file || '',
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user and their login? They will no longer be able to sign in.')) return;
    try {
      await deleteStaffAccount(id); // removes the profile AND the login
      setPageError(null);
    } catch (err: any) {
      setPageError(err.message);
    }
    await loadUsers();
  };

  const memberCount = users.filter((u) => u.role === 'member').length;
  const facultyCount = users.filter((u) => u.role === 'faculty').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {pageError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex justify-between gap-4">
          <span>⛔ {pageError}</span>
          <button onClick={() => setPageError(null)} className="font-bold">✕</button>
        </div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm flex justify-between gap-4">
          <span>✓ {notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold">✕</button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-600 text-sm mt-1">Manage system users and access permissions (9 total: 8 members + 1 faculty)</p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
        >
          {showForm ? <>✕ Cancel</> : <><Plus className="w-5 h-5" /> Add User</>}
        </button>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-[#3B6255]">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Total Users</h3>
          <p className="text-3xl font-bold text-[#3B6255]">{users.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-600">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Member Users</h3>
          <p className="text-3xl font-bold text-green-600">{memberCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Faculty Users</h3>
          <p className="text-3xl font-bold text-blue-600">{facultyCount}</p>
        </div>
      </div>

      {/* Add/Edit User Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {editingId ? 'Edit User' : 'Add New User'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white ${
                    errors.full_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter full name"
                />
                {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly={!!editingId}
                  title={editingId ? "The email is the login and can't be changed here" : undefined}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="user@lis.com"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  disabled={!!editingId && editingId === me?.id}
                  title={editingId && editingId === me?.id ? "You can't change your own role" : undefined}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white ${
                    errors.role ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="member">Member (Max 8)</option>
                  <option value="faculty">Faculty (Max 1)</option>
                  <option value="senior_medtech">Senior MedTech</option>
                  <option value="admin">Administrator</option>
                  {formData.role === 'doctor' && <option value="doctor">Doctor (manage in Doctors page)</option>}
                </select>
                {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white ${
                    errors.department ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Clinical Chemistry"
                />
                {errors.department && <p className="text-red-500 text-sm mt-1">{errors.department}</p>}
              </div>

              {!editingId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white ${
                      errors.tempPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.tempPassword
                    ? <p className="text-red-500 text-sm mt-1">{errors.tempPassword}</p>
                    : <p className="text-xs text-gray-500 mt-1">Creates their login. They must change it on first sign-in.</p>}
                </div>
              )}
            </div>

            {editingId && ['member', 'senior_medtech', 'faculty'].includes(formData.role) && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold text-gray-800 mb-1">Report Signatory</h3>
                <p className="text-xs text-gray-500 mb-4">Printed on laboratory reports when this MedTech encodes or quality-checks results.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {([
                    ['signatory_name', 'Printed Name', 'e.g. Ryza R. Alvaran, RMT'],
                    ['license_no', 'License No.', 'e.g. Lic. #0008'],
                    ['signature_file', 'Signature File', 'e.g. ryza-signature.png'],
                  ] as const).map(([key, label, ph]) => (
                    <div key={key}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
                      <input
                        type="text"
                        value={formData[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        placeholder={ph}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Signature images go in <code>public/signatures/</code>.</p>
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? '✓ Update User' : '✓ Add User'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Registered Users ({users.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Full Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Email</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Role</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Department</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Last Login</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Encryption Key</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                  <td className="py-4 px-8 font-medium text-gray-800">
                    {user.full_name}
                    {user.signatory_name && <p className="text-xs text-gray-400 font-normal">{user.signatory_name} · {user.license_no}</p>}
                  </td>
                  <td className="py-4 px-8 text-gray-600">{user.email}</td>
                  <td className="py-4 px-8">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                        user.role === 'faculty'
                          ? 'bg-blue-100 text-blue-800'
                          : user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'doctor'
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="py-4 px-8 text-gray-600">{user.department}</td>
                  <td className="py-4 px-8 text-gray-600 text-sm">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-4 px-8">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Lock className="w-4 h-4 text-[#3B6255]" />
                      <code className="bg-gray-100 px-2 py-1 rounded">{user.encryption_key}</code>
                    </div>
                  </td>
                  <td className="py-4 px-8 flex gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    {user.id !== me?.id && user.role !== 'doctor' && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-800 font-semibold text-sm flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
