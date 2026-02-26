'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, TrendingUp, AlertCircle, Download, FileText } from 'lucide-react';
import { fetchBilling, updateBillingStatus, deleteBilling, logActivity } from '@/lib/database';
import { useAuth } from '@/lib/authContext';

interface BillingRecord {
  id: string;
  patient_name?: string;
  patientName?: string;
  test_name?: string;
  testName?: string;
  amount: number;
  status: 'paid' | 'unpaid';
  paymentStatus?: 'paid' | 'unpaid';
  date_paid?: string;
  datePaid?: string;
  or_number?: string;
  orNumber?: string;
  date_created?: string;
  dateCreated?: string;
  description?: string;
  section?: string;
  created_at?: string;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [billings, setBillings] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Load billing records on mount
  useEffect(() => {
    loadBilling();
  }, []);

  const loadBilling = async () => {
    setLoading(true);
    const data = await fetchBilling();
    setBillings(data);
    setLoading(false);
  };

  const handlePaymentStatusChange = async (id: string, newStatus: 'paid' | 'unpaid') => {
    await updateBillingStatus(id, newStatus, user);
    await logActivity({
      user_id: user?.id,
      user_name: user?.full_name || 'Unknown User',
      encryption_key: user?.encryption_key || 'N/A',
      action: 'edit',
      resource: `Billing Status Updated`,
      resource_type: 'Billing',
      description: `Changed billing status to ${newStatus.toUpperCase()}`,
    });
    await loadBilling();
  };

  const handleDeleteBilling = async (id: string) => {
    if (confirm('Delete this billing record?')) {
      const billing = billings.find(b => b.id === id);
      await deleteBilling(id);
      await logActivity({
        user_id: user?.id,
        user_name: user?.full_name || 'Unknown User',
        encryption_key: user?.encryption_key || 'N/A',
        action: 'delete',
        resource: `${billing?.description || 'Billing Record'}`,
        resource_type: 'Billing',
        description: `Deleted billing record for ${billing?.patient_name || 'Unknown Patient'}: ${billing?.description || 'N/A'}. Amount: ₱${billing?.amount.toFixed(2) || '0.00'}`,
      });
      await loadBilling();
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<BillingRecord | null>(null);
  const [paymentData, setPaymentData] = useState({ orNumber: '', datePaid: '' });

  const totalRevenue = billings
    .filter((b) => (b.status || b.paymentStatus) === 'paid')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalUnpaid = billings
    .filter((b) => (b.status || b.paymentStatus) === 'unpaid')
    .reduce((sum, b) => sum + b.amount, 0);

  const paidCount = billings.filter((b) => (b.status || b.paymentStatus) === 'paid').length;
  const unpaidCount = billings.filter((b) => (b.status || b.paymentStatus) === 'unpaid').length;

  const handleRecordPayment = () => {
    if (!selectedBilling || !paymentData.orNumber || !paymentData.datePaid) {
      alert('Please fill in all fields');
      return;
    }

    setBillings(
      billings.map((b) =>
        b.id === selectedBilling.id
          ? {
              ...b,
              paymentStatus: 'paid',
              datePaid: paymentData.datePaid,
              orNumber: paymentData.orNumber,
            }
          : b
      )
    );

    setShowPaymentModal(false);
    setSelectedBilling(null);
    setPaymentData({ orNumber: '', datePaid: '' });
  };

  const handleMarkUnpaid = (billing: BillingRecord) => {
    setBillings(
      billings.map((b) =>
        b.id === billing.id
          ? {
              ...b,
              paymentStatus: 'unpaid',
              datePaid: undefined,
              orNumber: undefined,
            }
          : b
      )
    );
  };

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
        <h1 className="text-3xl font-bold text-gray-800">Billing Management</h1>
        <p className="text-gray-600 text-sm mt-1">Track payments and manage billing records</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.2s backwards'
      }}>
        <div className="bg-gradient-to-br from-emerald-200 to-emerald-400 text-gray-800 rounded-lg shadow-lg p-6" style={{
          animation: 'fadeInScale 0.5s ease-out 0.25s backwards'
        }}>
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90 font-medium">Paid Transactions</p>
          <p className="text-3xl font-bold">{paidCount}</p>
        </div>

        <div className="bg-gradient-to-br from-lime-200 to-emerald-300 text-gray-800 rounded-lg shadow-lg p-6" style={{
          animation: 'fadeInScale 0.5s ease-out 0.3s backwards'
        }}>
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90 font-medium">Unpaid Transactions</p>
          <p className="text-3xl font-bold">{unpaidCount}</p>
        </div>

        <div className="bg-gradient-to-br from-[#3B6255] to-green-800 text-white rounded-lg shadow-lg p-6" style={{
          animation: 'fadeInScale 0.5s ease-out 0.35s backwards'
        }}>
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90 font-medium">Total Revenue</p>
          <p className="text-3xl font-bold">₱{totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-green-200 to-emerald-400 text-gray-800 rounded-lg shadow-lg p-6" style={{
          animation: 'fadeInScale 0.5s ease-out 0.4s backwards'
        }}>
          <div className="flex items-center justify-between mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90 font-medium">Outstanding Balance</p>
          <p className="text-3xl font-bold">₱{totalUnpaid.toLocaleString()}</p>
        </div>
      </div>

      {/* Test Prices Reference */}
      <div className="bg-white rounded-lg shadow-lg p-8" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.45s backwards'
      }}>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Active Billing Records ({billings.length})</h2>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading billing records...</p>
          </div>
        ) : billings.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">No billing records yet</p>
            <p className="text-sm text-gray-500">Test results will automatically generate billing entries</p>
          </div>
        ) : null}
      </div>

      {/* Billing Records */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.5s backwards'
      }}>
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Billing Records ({billings.length})</h2>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button className="px-4 py-2 text-sm font-semibold text-white bg-[#3B6255] hover:bg-[#5A7669] rounded-lg transition flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Patient Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Test Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Amount</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Date Paid</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">OR Number</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Date Created</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {billings.length > 0 && billings.map((billing) => (
                <tr key={billing.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                  <td className="py-4 px-8 font-medium text-gray-800">{billing.patient_name || billing.patientName || 'N/A'}</td>
                  <td className="py-4 px-8 text-gray-600">{billing.test_name || billing.testName || 'N/A'}</td>
                  <td className="py-4 px-8 font-semibold text-[#3B6255]">₱{billing.amount}</td>
                  <td className="py-4 px-8">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (billing.status || billing.paymentStatus) === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {(billing.status || billing.paymentStatus) === 'paid' ? '✓ Paid' : '⏳ Unpaid'}
                    </span>
                  </td>
                  <td className="py-4 px-8 text-gray-600">
                    {billing.date_paid || billing.datePaid ? (
                      <span className="text-green-600 font-semibold">{billing.date_paid || billing.datePaid}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-8 text-gray-600">
                    {billing.or_number || billing.orNumber ? (
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                        {billing.or_number || billing.orNumber}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-8 text-gray-600">{billing.date_created || billing.dateCreated || 'N/A'}</td>
                  <td className="py-4 px-8 flex gap-2">
                    {(billing.status || billing.paymentStatus) === 'unpaid' ? (
                      <>
                        <button
                          onClick={() => handlePaymentStatusChange(billing.id as string, 'paid')}
                          className="text-green-600 hover:text-green-800 font-semibold text-sm"
                          title="Mark as Paid"
                        >
                          Mark Paid
                        </button>
                        <button
                          onClick={() => handleDeleteBilling(billing.id as string)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePaymentStatusChange(billing.id as string, 'unpaid')}
                          className="text-orange-600 hover:text-orange-800 font-semibold text-sm"
                          title="Mark as Unpaid"
                        >
                          Mark Unpaid
                        </button>
                        <button
                          onClick={() => handleDeleteBilling(billing.id as string)}
                          className="text-red-600 hover:text-red-800 font-semibold text-sm"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedBilling && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Record Payment</h2>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Patient</p>
                <p className="font-semibold text-gray-800">{selectedBilling.patientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Test</p>
                <p className="font-semibold text-gray-800">{selectedBilling.testName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Amount</p>
                <p className="text-3xl font-bold text-[#3B6255]">₱{selectedBilling.amount}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6 border-t border-gray-200 pt-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  OR Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={paymentData.orNumber}
                  onChange={(e) => setPaymentData({ ...paymentData, orNumber: e.target.value })}
                  placeholder="e.g., OR-2024-001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date Paid <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentData.datePaid}
                  onChange={(e) => setPaymentData({ ...paymentData, datePaid: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleRecordPayment}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold"
              >
                ✓ Confirm Payment
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedBilling(null);
                  setPaymentData({ orNumber: '', datePaid: '' });
                }}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
