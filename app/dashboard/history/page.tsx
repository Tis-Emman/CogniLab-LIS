'use client';

import { useState, useEffect } from 'react';
import { Users, LogIn, CheckCircle, Clock, Download, Loader } from 'lucide-react';
import { fetchAuditLogs } from '@/lib/database';

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  created_at: string;
  ip_address?: string;
  description?: string;
  resource_type?: string;
}

export default function AccessHistoryPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');

  // Load audit logs
  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    setLoading(true);
    const data = await fetchAuditLogs();
    setAuditLogs(data);
    setLoading(false);
  };

  // Inject animation keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInSlideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const filteredLogs = auditLogs.filter((log) => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterUser && !log.user_name.toLowerCase().includes(filterUser.toLowerCase())) return false;
    return true;
  });

  const uniqueUsers = [...new Set(auditLogs.map((log) => log.user_name))];
  const uniqueActions = [...new Set(auditLogs.map((log) => log.action))];
  const totalLogs = auditLogs.length;

  return (
    <div className="space-y-8" style={{
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Header */}
      <div style={{
        animation: 'fadeInSlideUp 0.6s ease-out',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <h1 className="text-3xl font-bold text-gray-800">Access History & Audit Log</h1>
        <p className="text-gray-600 text-sm mt-1">Monitor user access and login records</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.2s backwards'
      }}>
        <div className="bg-gradient-to-br from-[#3B6255] to-green-900 text-white rounded-lg shadow-lg p-6" style={{
          animation: 'fadeInScale 0.5s ease-out 0.25s backwards'
        }}>
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Total Users</p>
          <p className="text-3xl font-bold">{uniqueUsers.length}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-lg shadow-lg p-6" style={{
          animation: 'fadeInScale 0.5s ease-out 0.3s backwards'
        }}>
          <div className="flex items-center justify-between mb-4">
            <LogIn className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Total Actions</p>
          <p className="text-3xl font-bold">{uniqueActions.length}</p>
        </div>

        <div className="bg-gradient-to-br from-green-400 to-green-600 text-white rounded-lg shadow-lg p-6" style={{
          animation: 'fadeInScale 0.5s ease-out 0.35s backwards'
        }}>
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Total Logs</p>
          <p className="text-3xl font-bold">{totalLogs}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-lg p-6" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.4s backwards'
      }}>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Filter Records</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by Action
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
            >
              <option value="">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by User
            </label>
            <input
              type="text"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="Search user name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.5s backwards'
      }}>
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              Audit Log Records ({filteredLogs.length})
            </h2>
            <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export as PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-4 px-8 font-semibold text-gray-700">User Name</th>
                  <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
                  <th className="text-left py-4 px-8 font-semibold text-gray-700">Resource</th>
                  <th className="text-left py-4 px-8 font-semibold text-gray-700">Description</th>
                  <th className="text-left py-4 px-8 font-semibold text-gray-700">Timestamp</th>
                  <th className="text-left py-4 px-8 font-semibold text-gray-700">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                    <td className="py-4 px-8 font-medium text-gray-800">{log.user_name}</td>
                    <td className="py-4 px-8">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          log.action === 'login'
                            ? 'bg-green-100 text-green-800'
                            : log.action === 'logout'
                            ? 'bg-gray-100 text-gray-800'
                            : log.action === 'edit'
                            ? 'bg-yellow-100 text-yellow-800'
                            : log.action === 'delete'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-[#CBDED3] text-[#3B6255]'
                        }`}
                      >
                        {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-8 text-gray-600 text-sm">
                      {log.resource_type || '—'}
                    </td>
                    <td className="py-4 px-8 text-gray-600 text-sm">
                      {log.description || '—'}
                    </td>
                    <td className="py-4 px-8 font-mono text-sm text-gray-600">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })
                        : '—'}
                    </td>
                    <td className="py-4 px-8 font-mono text-sm text-gray-600">
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLogs.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                <p>No audit records match your filters</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Security Notes */}
      <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg">
        <h3 className="font-semibold text-[#3B6255] mb-2">🔐 Audit & Compliance</h3>
        <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
          <li>All system activities are logged automatically for audit purposes</li>
          <li>IP addresses are recorded to track user access patterns</li>
          <li>Action types include login, logout, view, edit, and delete operations</li>
          <li>Detailed descriptions help identify specific changes made</li>
          <li>Audit logs are retained for 12 months per security policy</li>
        </ul>
      </div>
    </div>
  );
}
