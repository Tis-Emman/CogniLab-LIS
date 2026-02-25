'use client';

import { useState } from 'react';
import { Users, LogIn, CheckCircle, Clock, Download } from 'lucide-react';

interface AccessLog {
  id: number;
  userName: string;
  role: string;
  loginTime: string;
  logoutTime?: string;
  ipAddress: string;
}

export default function AccessHistoryPage() {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([
    {
      id: 1,
      userName: 'Administrator',
      role: 'Admin',
      loginTime: '2024-01-15 08:30:00',
      logoutTime: '2024-01-15 17:45:00',
      ipAddress: '192.168.1.100',
    },
    {
      id: 2,
      userName: 'MedTech User',
      role: 'MedTech',
      loginTime: '2024-01-15 09:00:00',
      logoutTime: '2024-01-15 17:30:00',
      ipAddress: '192.168.1.101',
    },
    {
      id: 3,
      userName: 'Administrator',
      role: 'Admin',
      loginTime: '2024-01-15 18:00:00',
      logoutTime: undefined,
      ipAddress: '192.168.1.100',
    },
    {
      id: 4,
      userName: 'MedTech User',
      role: 'MedTech',
      loginTime: '2024-01-14 08:15:00',
      logoutTime: '2024-01-14 17:00:00',
      ipAddress: '192.168.1.101',
    },
    {
      id: 5,
      userName: 'Administrator',
      role: 'Admin',
      loginTime: '2024-01-14 07:30:00',
      logoutTime: '2024-01-14 18:00:00',
      ipAddress: '192.168.1.100',
    },
  ]);

  const [filterRole, setFilterRole] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');

  const filteredLogs = accessLogs.filter((log) => {
    if (filterRole && log.role !== filterRole) return false;
    if (filterUser && !log.userName.toLowerCase().includes(filterUser.toLowerCase())) return false;
    return true;
  });

  const calculateSessionDuration = (login: string, logout?: string) => {
    if (!logout) return 'Active';
    try {
      const loginDate = new Date(login);
      const logoutDate = new Date(logout);
      const duration = Math.floor((logoutDate.getTime() - loginDate.getTime()) / 1000 / 60);
      if (duration < 60) return `${duration}m`;
      return `${Math.floor(duration / 60)}h ${duration % 60}m`;
    } catch {
      return '—';
    }
  };

  const uniqueUsers = [...new Set(accessLogs.map((log) => log.userName))];
  const totalSessions = accessLogs.length;
  const activeSessions = accessLogs.filter((log) => !log.logoutTime).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Access History & Audit Log</h1>
        <p className="text-gray-600 text-sm mt-1">Monitor user access and login records</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#3B6255] to-green-900 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Total Users</p>
          <p className="text-3xl font-bold">{uniqueUsers.length}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <LogIn className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Active Sessions</p>
          <p className="text-3xl font-bold">{activeSessions}</p>
        </div>

        <div className="bg-gradient-to-br from-green-400 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Total Logins</p>
          <p className="text-3xl font-bold">{totalSessions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Filter Records</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by Role
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
            >
              <option value="">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="MedTech">MedTech</option>
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

      {/* Access Logs Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              Access Log Records ({filteredLogs.length})
            </h2>
            <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export as PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">User Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Role</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Login Time</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Logout Time</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Duration</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">IP Address</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                  <td className="py-4 px-8 font-medium text-gray-800">{log.userName}</td>
                  <td className="py-4 px-8">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        log.role === 'Admin'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-[#CBDED3] text-[#3B6255]'
                      }`}
                    >
                      {log.role}
                    </span>
                  </td>
                  <td className="py-4 px-8 text-gray-600 font-mono text-sm">{log.loginTime}</td>
                  <td className="py-4 px-8 text-gray-600 font-mono text-sm">
                    {log.logoutTime || '—'}
                  </td>
                  <td className="py-4 px-8 font-semibold text-gray-800">
                    {calculateSessionDuration(log.loginTime, log.logoutTime)}
                  </td>
                  <td className="py-4 px-8 font-mono text-sm text-gray-600">{log.ipAddress}</td>
                  <td className="py-4 px-8">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        log.logoutTime
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {log.logoutTime ? (
                        <>
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          Logged Out
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 inline mr-1" />
                          Active
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No access records match your filters</p>
          </div>
        )}
      </div>

      {/* Security Notes */}
      <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg">
        <h3 className="font-semibold text-[#3B6255] mb-2">🔐 Security & Compliance</h3>
        <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
          <li>All access is logged automatically for audit purposes</li>
          <li>IP addresses are recorded to detect unauthorized access</li>
          <li>Session duration helps identify unusual activity patterns</li>
          <li>Active sessions are displayed in real-time</li>
          <li>Access logs are retained for 12 months per policy</li>
        </ul>
      </div>
    </div>
  );
}
