'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Lock, Shield, Loader } from 'lucide-react';
import { fetchUsers, addUser, updateUser, deleteUser } from '@/lib/database';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: 'member' | 'faculty';
  department: string;
  status: 'active' | 'inactive';
  join_date: string;
  last_login: string | null;
  encryption_key: string;
}

export default function UserManagementPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'member' as 'member' | 'faculty',
    department: '',
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

    // Check user limits
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
        await updateUser(editingId, {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          department: formData.department,
        });
      } else {
        await addUser(formData);
      }
      await loadUsers();
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ full_name: '', email: '', role: 'member', department: '' });
    setErrors({});
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (user: User) => {
    setFormData({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department,
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await deleteUser(id);
      await loadUsers();
    }
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
          <p className="text-3xl font-bold text-[#3B6255]">8</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-600">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Member Users</h3>
          <p className="text-3xl font-bold text-green-600">8</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-600">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Faculty Users</h3>
          <p className="text-3xl font-bold text-blue-600">1</p>
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'member' | 'faculty' })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white ${
                    errors.role ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="member">Member (Max 8)</option>
                  <option value="faculty">Faculty (Max 1)</option>
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
            </div>

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
                  <td className="py-4 px-8 font-medium text-gray-800">{user.full_name}</td>
                  <td className="py-4 px-8 text-gray-600">{user.email}</td>
                  <td className="py-4 px-8">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                        user.role === 'faculty'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {user.role === 'faculty' ? 'Faculty' : 'Member'}
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
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-800 font-semibold text-sm flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
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
