'use client';

import { useState, useEffect } from 'react';
import { Eye, Lock, LogIn, LogOut, Edit3, Trash2, Download, Filter, Loader } from 'lucide-react';
import { fetchAuditLogs, subscribeToAuditLogs } from '@/lib/database';

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  encryption_key: string;
  action: 'login' | 'logout' | 'view' | 'edit' | 'delete' | 'download';
  resource: string;
  resource_type: string;
  created_at: string;
  ip_address: string;
  description: string;
}

export default function AuditLogPage() {
  const [filteredAction, setFilteredAction] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial logs and subscribe to real-time updates
  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      const data = await fetchAuditLogs();
      setLogs(data);
      setLoading(false);
    };

    loadLogs();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToAuditLogs((newLog: AuditLog) => {
      setLogs((prevLogs) => [newLog, ...prevLogs]);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <LogIn className="w-4 h-4 text-green-600" />;
      case 'logout':
        return <LogOut className="w-4 h-4 text-red-600" />;
      case 'view':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'edit':
        return <Edit3 className="w-4 h-4 text-yellow-600" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'download':
        return <Download className="w-4 h-4 text-purple-600" />;
      default:
        return null;
    }
  };

  const getActionBadge = (action: string) => {
    const badgeClasses: Record<string, string> = {
      login: 'bg-green-100 text-green-800',
      logout: 'bg-red-100 text-red-800',
      view: 'bg-blue-100 text-blue-800',
      edit: 'bg-yellow-100 text-yellow-800',
      delete: 'bg-red-100 text-red-800',
      download: 'bg-purple-100 text-purple-800',
    };
    return badgeClasses[action] || 'bg-gray-100 text-gray-800';
  };

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filteredAction === 'all' || log.action === filteredAction;
    const matchesSearch =
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.encryption_key.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  // Calculate active sessions (users with login but no corresponding logout)
  const getActiveSessions = () => {
    const userLastAction = new Map<string, AuditLog>();
    
    // Find the most recent action for each user
    logs.forEach((log) => {
      const existing = userLastAction.get(log.user_name);
      if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
        userLastAction.set(log.user_name, log);
      }
    });

    // Count users whose last action was login (not logout)
    let activeSessions = 0;
    userLastAction.forEach((log) => {
      if (log.action === 'login') {
        activeSessions++;
      }
    });
    return activeSessions;
  };

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
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Audit & Access History</h1>
        <p className="text-gray-600 text-sm mt-1">
          Complete encrypted activity log of all user actions and access records
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-600">
          <h3 className="text-xs font-semibold text-gray-700">Total Activities</h3>
          <p className="text-2xl font-bold text-green-600">{logs.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-600">
          <h3 className="text-xs font-semibold text-gray-700">Active Sessions</h3>
          <p className="text-2xl font-bold text-orange-600">{getActiveSessions()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
          <h3 className="text-xs font-semibold text-gray-700">Views</h3>
          <p className="text-2xl font-bold text-blue-600">{logs.filter((l) => l.action === 'view').length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-600">
          <h3 className="text-xs font-semibold text-gray-700">Edits</h3>
          <p className="text-2xl font-bold text-yellow-600">{logs.filter((l) => l.action === 'edit').length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-700">
          <h3 className="text-xs font-semibold text-gray-700">Logins</h3>
          <p className="text-2xl font-bold text-green-700">{logs.filter((l) => l.action === 'login').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-2" />
              Search Activity
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username, resource, or encryption key..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Action</label>
            <select
              value={filteredAction}
              onChange={(e) => setFilteredAction(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] text-gray-800 bg-white"
            >
              <option value="all">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="view">View</option>
              <option value="edit">Edit</option>
              <option value="delete">Delete</option>
              <option value="download">Download</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Activity Log ({filteredLogs.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Timestamp</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">User</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Resource</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Encryption Key</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">IP Address</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                    <td className="py-4 px-8 text-gray-700 font-medium text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 px-8 text-gray-800 font-medium">{log.user_name}</td>
                    <td className="py-4 px-8">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 w-fit ${getActionBadge(log.action)}`}>
                        {getActionIcon(log.action)}
                        {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-8">
                      <div>
                        <p className="text-gray-800 text-sm font-medium">{log.resource}</p>
                        <p className="text-gray-500 text-xs">{log.resource_type}</p>
                      </div>
                    </td>
                    <td className="py-4 px-8">
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <Lock className="w-4 h-4 text-[#3B6255]" />
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">{log.encryption_key}</code>
                      </div>
                    </td>
                    <td className="py-4 px-8 text-gray-600 text-sm font-mono">{log.ip_address}</td>
                    <td className="py-4 px-8 text-gray-600 text-sm max-w-xs">{log.description}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 px-8 text-center text-gray-500">
                    No activities found matching your search criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold mb-4">Encryption & Security Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-semibold mb-2">Encryption Keys</h4>
            <p className="text-[#CBDED3]">
              Each user has a unique encryption key (ENC_KEY_###) that logs all their activities. This ensures secure audit trail tracking and compliance.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">System Enforcement</h4>
            <p className="text-[#CBDED3]">
              All access is logged automatically. The system tracks: logins, logouts, views, edits, deletions, and downloads with timestamp and IP address.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
