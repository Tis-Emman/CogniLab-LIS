'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Clock, CheckCircle2, AlertCircle, Plus, CreditCard, Loader, TrendingUp } from 'lucide-react';
import { fetchPatients, fetchTestResults, fetchBilling } from '@/lib/database';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState([
    { label: 'Total Patients', value: '0', Icon: Users, color: 'from-[#3B6255] to-[#5A7669]' },
    { label: 'Pending Results', value: '0', Icon: Clock, color: 'from-[#5A7669] to-[#3B6255]' },
    { label: 'Released Results', value: '0', Icon: CheckCircle2, color: 'from-green-400 to-green-600' },
    { label: 'Unpaid Billings', value: '₱0', Icon: AlertCircle, color: 'from-emerald-500 to-emerald-700' },
  ]);
  const [loading, setLoading] = useState(true);
  
  // Chart data states
  const [testsBySection, setTestsBySection] = useState<{ name: string; tests: number }[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<{ name: string; value: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; paid: number }[]>([]);

  const COLORS = ['#3B6255', '#5A7669', '#8BA49A', '#CBDED3', '#D2C49E'];

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

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const patients = await fetchPatients();
        const results = await fetchTestResults();
        const billings = await fetchBilling();

        // Calculate statistics
        const totalPatients = patients.length;
        const pendingResults = results.filter(r => r.status === 'pending').length;
        const releasedResults = results.filter(r => r.status === 'released').length;
        const unpaidBillings = billings
          .filter(b => b.status === 'unpaid')
          .reduce((sum, b) => sum + (b.amount || 0), 0);

        setStats([
          { label: 'Total Patients', value: totalPatients.toString(), Icon: Users, color: 'from-[#3B6255] to-[#5A7669]' },
          { label: 'Pending Results', value: pendingResults.toString(), Icon: Clock, color: 'from-[#5A7669] to-[#3B6255]' },
          { label: 'Released Results', value: releasedResults.toString(), Icon: CheckCircle2, color: 'from-green-400 to-green-600' },
          { label: 'Unpaid Billings', value: `₱${unpaidBillings.toLocaleString()}`, Icon: AlertCircle, color: 'from-emerald-500 to-emerald-700' },
        ]);

        // Tests by Section (Bar Chart)
        const sectionCounts: Record<string, number> = {};
        results.forEach(r => {
          const section = r.section || 'Unknown';
          sectionCounts[section] = (sectionCounts[section] || 0) + 1;
        });
        setTestsBySection(
          Object.entries(sectionCounts)
            .map(([name, tests]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, tests }))
            .sort((a, b) => b.tests - a.tests)
            .slice(0, 6)
        );

        // Status Distribution (Pie Chart)
        const statusCounts: Record<string, number> = {};
        results.forEach(r => {
          const status = r.status || 'Unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        setStatusDistribution(
          Object.entries(statusCounts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
            value,
          }))
        );

        // Revenue Data (Line Chart - last 7 days)
        const revenueByDate: Record<string, { total: number; paid: number }> = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          revenueByDate[dateStr] = { total: 0, paid: 0 };
        }
        billings.forEach(b => {
          const dateStr = (b.date_created || b.dateCreated || '').split('T')[0];
          if (revenueByDate[dateStr]) {
            revenueByDate[dateStr].total += b.amount || 0;
            if (b.status === 'paid') {
              revenueByDate[dateStr].paid += b.amount || 0;
            }
          }
        });
        setRevenueData(
          Object.entries(revenueByDate).map(([date, data]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            revenue: data.total,
            paid: data.paid,
          }))
        );
        // Fetch recent patients (latest 5)
        setRecentPatients(patients.slice(0, 5));
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const [recentPatients, setRecentPatients] = useState<any[]>([]);

  return (
    <div className="space-y-8" style={{
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg shadow-lg p-6 md:p-8" style={{
        animation: 'fadeInSlideUp 0.6s ease-out',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <h1 className="text-xl md:text-3xl font-bold mb-2">Welcome to CogniLab</h1>
        <p className="text-[#CBDED3]">
          Manage laboratory tests, patients, and billing for KRRAX-JAM Inc. Ensure quality care with secure data management.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.2s backwards'
      }}>
        {loading ? (
          <div className="col-span-4 flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-[#3B6255]" />
          </div>
        ) : (
          stats.map((stat, index) => {
            const Icon = stat.Icon;
            return (
              <div
                key={index}
                className={`bg-gradient-to-br ${stat.color} text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition`}
                style={{
                  animation: 'fadeInScale 0.5s ease-out',
                  animationDelay: `${0.3 + index * 0.1}s`,
                  animationFillMode: 'both'
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <Icon className="w-8 h-8" />
                  <span className="text-sm font-semibold opacity-80">Live</span>
                </div>
                <p className="text-3xl font-bold mb-1">{stat.value}</p>
                <p className="text-sm opacity-90">{stat.label}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.4s backwards'
      }}>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/patients"
            className="p-6 bg-gradient-to-br from-[#E2DFDA] to-[#CBDED3] border-2 border-[#8BA49A] rounded-lg hover:border-[#3B6255] transition cursor-pointer group"
            style={{
              animation: 'fadeInScale 0.5s ease-out 0.45s backwards'
            }}
          >
            <div className="w-12 h-12 bg-[#CBDED3] rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Users className="w-6 h-6 text-[#3B6255]" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Add New Patient</h3>
            <p className="text-sm text-gray-600">Register and manage patient information</p>
          </Link>

          <Link
            href="/dashboard/results"
            className="p-6 bg-gradient-to-br from-[#CBDED3] to-[#8BA49A] border-2 border-[#8BA49A] rounded-lg hover:border-[#3B6255] transition cursor-pointer group"
            style={{
              animation: 'fadeInScale 0.5s ease-out 0.5s backwards'
            }}
          >
            <div className="w-12 h-12 bg-[#8BA49A] rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Enter Test Results</h3>
            <p className="text-sm text-gray-600">Record and manage laboratory test results</p>
          </Link>

          <Link
            href="/dashboard/billing"
            className="p-6 bg-gradient-to-br from-[#D2C49E] to-[#CBDED3] border-2 border-[#8BA49A] rounded-lg hover:border-[#3B6255] transition cursor-pointer group"
            style={{
              animation: 'fadeInScale 0.5s ease-out 0.55s backwards'
            }}
          >
            <div className="w-12 h-12 bg-[#D2C49E] rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <CreditCard className="w-6 h-6 text-[#3B6255]" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Manage Billing</h3>
            <p className="text-sm text-gray-600">Track payments and generate invoices</p>
          </Link>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.5s backwards'
      }}>
        {/* Tests by Section - Bar Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#3B6255]" />
            <h3 className="text-lg font-bold text-gray-800">Tests by Lab Section</h3>
          </div>
          {testsBySection.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={testsBySection} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#374151', fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => [`${value} tests`, 'Count']}
                />
                <Bar dataKey="tests" fill="#3B6255" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              No test data available
            </div>
          )}
        </div>

        {/* Status Distribution - Pie Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-[#3B6255]" />
            <h3 className="text-lg font-bold text-gray-800">Result Status Distribution</h3>
          </div>
          {statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => [`${value} results`, 'Count']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              No status data available
            </div>
          )}
        </div>

        {/* Revenue Trends - Line Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-[#3B6255]" />
            <h3 className="text-lg font-bold text-gray-800">Revenue Trends (Last 7 Days)</h3>
          </div>
          {revenueData.some(d => d.revenue > 0 || d.paid > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData} margin={{ left: 10, right: 30, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `₱${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => [`₱${Number(value).toLocaleString()}`, '']}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Total Billed" stroke="#3B6255" strokeWidth={2} dot={{ fill: '#3B6255' }} />
                <Line type="monotone" dataKey="paid" name="Paid" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              No revenue data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Patients */}
      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.6s backwards'
      }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Recent Patients</h2>
          <Link
            href="/dashboard/patients"
            className="text-[#3B6255] hover:text-[#5A7669] text-sm font-semibold"
          >
            View All →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Patient Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Lab Section</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Test</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentPatients.map((patient) => (
                <tr key={patient.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4 font-medium text-gray-800">{patient.first_name} {patient.last_name}</td>
                  <td className="py-4 px-4 text-gray-600">{patient.section || '-'}</td>
                  <td className="py-4 px-4 text-gray-600">-</td>
                  <td className="py-4 px-4 text-gray-600">{patient.date_registered ? new Date(patient.date_registered).toLocaleDateString() : '-'}</td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      Registered
                    </span>
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
