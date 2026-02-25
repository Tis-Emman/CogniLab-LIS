'use client';

import { useState } from 'react';
import { CheckCircle, Clock, TrendingUp, AlertCircle, Download, FileText } from 'lucide-react';

interface BillingRecord {
  id: number;
  patientName: string;
  testName: string;
  amount: number;
  paymentStatus: 'paid' | 'unpaid';
  datePaid?: string;
  orNumber?: string;
  dateCreated: string;
}

const TEST_PRICES: Record<string, number> = {
  'Random Blood Sugar (Glucose)': 150,
  'Blood Cholesterol': 200,
};

export default function BillingPage() {
  const [billings, setBillings] = useState<BillingRecord[]>([
    {
      id: 1,
      patientName: 'Juan dela Cruz',
      testName: 'Random Blood Sugar (Glucose)',
      amount: 150,
      paymentStatus: 'unpaid',
      dateCreated: '2024-01-15',
    },
    {
      id: 2,
      patientName: 'Maria Santos',
      testName: 'Blood Cholesterol',
      amount: 200,
      paymentStatus: 'paid',
      datePaid: '2024-01-14',
      orNumber: 'OR-2024-001',
      dateCreated: '2024-01-14',
    },
    {
      id: 3,
      patientName: 'Pedro Gonzales',
      testName: 'Random Blood Sugar (Glucose)',
      amount: 150,
      paymentStatus: 'unpaid',
      dateCreated: '2024-01-13',
    },
  ]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<BillingRecord | null>(null);
  const [paymentData, setPaymentData] = useState({ orNumber: '', datePaid: '' });

  const totalRevenue = billings
    .filter((b) => b.paymentStatus === 'paid')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalUnpaid = billings
    .filter((b) => b.paymentStatus === 'unpaid')
    .reduce((sum, b) => sum + b.amount, 0);

  const paidCount = billings.filter((b) => b.paymentStatus === 'paid').length;
  const unpaidCount = billings.filter((b) => b.paymentStatus === 'unpaid').length;

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Billing Management</h1>
        <p className="text-gray-600 text-sm mt-1">Track payments and manage billing records</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-400 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Paid Transactions</p>
          <p className="text-3xl font-bold">{paidCount}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Unpaid Transactions</p>
          <p className="text-3xl font-bold">{unpaidCount}</p>
        </div>

        <div className="bg-gradient-to-br from-[#3B6255] to-green-900 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Total Revenue</p>
          <p className="text-3xl font-bold">₱{totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-red-400 to-red-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="text-sm opacity-90">Outstanding Balance</p>
          <p className="text-3xl font-bold">₱{totalUnpaid.toLocaleString()}</p>
        </div>
      </div>

      {/* Test Prices Reference */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Test Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(TEST_PRICES).map(([testName, price]) => (
            <div key={testName} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-800 font-semibold mb-2">{testName}</p>
              <p className="text-2xl font-bold text-[#3B6255]">₱{price}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Billing Records */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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
              {billings.map((billing) => (
                <tr key={billing.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                  <td className="py-4 px-8 font-medium text-gray-800">{billing.patientName}</td>
                  <td className="py-4 px-8 text-gray-600">{billing.testName}</td>
                  <td className="py-4 px-8 font-semibold text-[#3B6255]">₱{billing.amount}</td>
                  <td className="py-4 px-8">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        billing.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {billing.paymentStatus === 'paid' ? '✓ Paid' : '⏳ Unpaid'}
                    </span>
                  </td>
                  <td className="py-4 px-8 text-gray-600">
                    {billing.datePaid ? (
                      <span className="text-green-600 font-semibold">{billing.datePaid}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-8 text-gray-600">
                    {billing.orNumber ? (
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                        {billing.orNumber}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-8 text-gray-600">{billing.dateCreated}</td>
                  <td className="py-4 px-8">
                    {billing.paymentStatus === 'unpaid' ? (
                      <button
                        onClick={() => {
                          setSelectedBilling(billing);
                          setShowPaymentModal(true);
                        }}
                        className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm"
                      >
                        Record Payment
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkUnpaid(billing)}
                        className="text-orange-600 hover:text-orange-800 font-semibold text-sm"
                      >
                        Mark Unpaid
                      </button>
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
