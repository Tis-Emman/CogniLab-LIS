'use client';

import { useState, useEffect } from 'react';
import { Plus, CheckCircle, Clock, AlertCircle, ArrowRight, Edit2, Loader } from 'lucide-react';
import { fetchTestResults, addTestResult, updateTestResult, deleteTestResult, fetchPatients } from '@/lib/database';
import { useAuth } from '@/lib/authContext';

interface TestResult {
  id: string;
  patient_name: string;
  section: string;
  test_name: string;
  result_value: string;
  reference_range: string;
  unit: string;
  status: 'pending' | 'encoding' | 'for_verification' | 'approved' | 'released';
  date_created: string;
}

const LAB_SECTIONS = [
  'BLOOD BANK',
  'ISBB',
  'HEMATOLOGY',
  'CLINICAL CHEMISTRY',
  'MICROBIOLOGY',
  'IMMUNOLOGY',
  'HISTOPATHOLOGY',
  'PARASITOLOGY',
  'SEROLOGY',
];

const TESTS_BY_SECTION: Record<string, { name: string; referenceRange: string; unit: string }[]> =
  {
    'CLINICAL CHEMISTRY': [
      { name: 'Blood Glucose', referenceRange: '< 140 mg/dL', unit: 'mg/dL' },
      { name: 'Cholesterol', referenceRange: '< 200 mg/dL', unit: 'mg/dL' },
    ],
  };

export default function TestResultsPage() {
  const { user } = useAuth();
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [patientName, setPatientName] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const statusFlow = ['pending', 'encoding', 'for_verification', 'approved', 'released'] as const;

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-800',
      'encoding': 'bg-blue-100 text-blue-800',
      'for_verification': 'bg-orange-100 text-orange-800',
      'approved': 'bg-purple-100 text-purple-800',
      'released': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'PENDING',
      'encoding': 'ENCODING',
      'for_verification': 'FOR VERIFICATION',
      'approved': 'APPROVED',
      'released': 'RELEASED',
    };
    return labels[status] || status;
  };

  const moveToNextStatus = async (resultId: string, currentStatus: string) => {
    const currentIndex = statusFlow.indexOf(currentStatus as any);
    if (currentIndex < statusFlow.length - 1) {
      setUpdatingStatusId(resultId);
      const nextStatus = statusFlow[currentIndex + 1];
      await updateTestResult(resultId, { status: nextStatus }, user);
      
      // Update state optimistically without reloading
      setResults(results.map(r => r.id === resultId ? { ...r, status: nextStatus as TestResult['status'] } : r));
      
      setUpdatingStatusId(null);
    }
  };

  // Load test results on mount
  useEffect(() => {
    loadResults();
    loadPatients();
  }, []);

  const loadPatients = async () => {
    const data = await fetchPatients();
    setPatients(data);
  };

  const loadResults = async () => {
    setLoading(true);
    const data = await fetchTestResults();
    setResults(data);
    setLoading(false);
  };

  const currentTests = selectedSection ? TESTS_BY_SECTION[selectedSection] || [] : [];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!patientName.trim()) newErrors.patientName = 'Patient name is required';
    if (!selectedSection) newErrors.section = 'Lab section is required';
    if (selectedSection !== 'CLINICAL CHEMISTRY') {
      newErrors.section = 'Results can only be entered for Clinical Chemistry section';
    }
    if (!selectedTest) newErrors.test = 'Test is required';
    if (!resultValue) newErrors.resultValue = 'Result value is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const testDetails = currentTests.find((t) => t.name === selectedTest);
    if (!testDetails) return;

    setSubmitting(true);
    try {
      if (editingId) {
        await updateTestResult(editingId, {
          patient_name: patientName,
          section: selectedSection,
          test_name: selectedTest,
          result_value: resultValue,
          reference_range: testDetails.referenceRange,
          unit: testDetails.unit,
        }, user);
      } else {
        await addTestResult({
          patient_name: patientName,
          section: selectedSection,
          test_name: selectedTest,
          result_value: resultValue,
          reference_range: testDetails.referenceRange,
          unit: testDetails.unit,
        }, user);
      }
      await loadResults();
      resetForm();
    } catch (error) {
      console.error('Error saving test result:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPatientName('');
    setSelectedSection('');
    setSelectedTest('');
    setResultValue('');
    setErrors({});
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (result: TestResult) => {
    setPatientName(result.patient_name);
    setSelectedSection(result.section);
    setSelectedTest(result.test_name);
    setResultValue(result.result_value);
    setEditingId(result.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this test result?')) {
      await deleteTestResult(id);
      await loadResults();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8" style={{
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{
        animation: 'fadeInSlideUp 0.6s ease-out',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Test Results Management</h1>
          <p className="text-gray-600 text-sm mt-1">Enter and manage laboratory test results</p>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
        >
          {showForm ? (
            <>
              ✕ Cancel
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              New Test Result
            </>
          )}
        </button>
      </div>

      {/* Test Entry Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]" style={{
          animation: 'fadeInSlideUp 0.6s ease-out 0.2s backwards'
        }}>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {editingId ? 'Edit Test Result' : 'Enter Test Result'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Patient Name <span className="text-red-500">*</span>
              </label>
              <select
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                  errors.patientName ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">-- Select Patient --</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={`${patient.first_name} ${patient.last_name}`}>
                    {patient.first_name} {patient.last_name} (ID: {patient.patient_id_no})
                  </option>
                ))}
              </select>
              {errors.patientName && (
                <p className="text-red-500 text-sm mt-1">{errors.patientName}</p>
              )}
            </div>

            {/* Lab Section Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Laboratory Section <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSection}
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setSelectedTest('');
                }}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 bg-white font-medium ${
                  errors.section ? 'border-red-500' : 'border-gray-300 hover:border-[#8BA49A]'
                }`}
              >
                <option value="">-- Select Laboratory Section --</option>
                {LAB_SECTIONS.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
              {errors.section && <p className="text-red-500 text-sm mt-1">{errors.section}</p>}

              {/* Section Status Info */}
              {selectedSection && (
                <div className={`mt-3 p-3 rounded-lg text-sm border ${
                  selectedSection === 'CLINICAL CHEMISTRY'
                    ? 'bg-[#CBDED3] border-[#8BA49A] text-[#3B6255]'
                    : 'bg-yellow-50 border-yellow-300 text-yellow-800'
                }`}>
                  {selectedSection === 'CLINICAL CHEMISTRY' ? (
                    <p>✓ Tests available in this section</p>
                  ) : (
                    <p>⚠️ Results are only available for Clinical Chemistry section</p>
                  )}
                </div>
              )}
            </div>

            {/* Test Selection - Only show for Clinical Chemistry */}
            {selectedSection === 'CLINICAL CHEMISTRY' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Test Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTest}
                  onChange={(e) => setSelectedTest(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 bg-white font-medium ${
                    errors.test ? 'border-red-500' : 'border-gray-300 hover:border-[#8BA49A]'
                  }`}
                >
                  <option value="">-- Select Test --</option>
                  {currentTests.map((test) => (
                    <option key={test.name} value={test.name}>
                      {test.name}
                    </option>
                  ))}
                </select>
                {errors.test && <p className="text-red-500 text-sm mt-1">{errors.test}</p>}
              </div>
            )}

            {/* Reference Range Display */}
            {selectedSection === 'CLINICAL CHEMISTRY' && selectedTest && currentTests.find((t) => t.name === selectedTest) && (
              <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-4 rounded">
                <h3 className="font-semibold text-gray-800 mb-2">Reference Range</h3>
                <p className="text-2xl font-bold text-[#3B6255]">
                  {currentTests.find((t) => t.name === selectedTest)?.referenceRange}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Unit: {currentTests.find((t) => t.name === selectedTest)?.unit}
                </p>
              </div>
            )}

            {/* Result Value */}
            {selectedSection === 'CLINICAL CHEMISTRY' && selectedTest && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Result Value <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resultValue}
                    onChange={(e) => setResultValue(e.target.value)}
                    placeholder="Enter result value"
                    className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                      errors.resultValue ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <span className="px-4 py-2 bg-gray-100 rounded-lg flex items-center text-gray-700 font-semibold">
                    {currentTests.find((t) => t.name === selectedTest)?.unit}
                  </span>
                </div>
                {errors.resultValue && (
                  <p className="text-red-500 text-sm mt-1">{errors.resultValue}</p>
                )}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? '✓ Update Result' : '✓ Save Test Result'}
              </button>
              <button
                type="button"
                onClick={() => resetForm()}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lab Sections Overview */}
      <div className="bg-white rounded-lg shadow-lg p-8" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.3s backwards'
      }}>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Laboratory Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LAB_SECTIONS.map((section, index) => (
            <div
              key={section}
              className={`p-4 rounded-lg border-2 transition bg-[#CBDED3] border-[#8BA49A] hover:border-[#3B6255]`}
              style={{
                animation: 'fadeInScale 0.5s ease-out',
                animationDelay: `${0.35 + index * 0.08}s`,
                animationFillMode: 'both'
              }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-[#3B6255]" />
                <div>
                  <h3 className="font-semibold text-gray-800">{section}</h3>
                  <p className="text-xs text-gray-600">Active & Available</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results List */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.5s backwards'
      }}>
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Test Results ({results.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Patient Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Lab Section</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Test Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Result</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Reference</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Date</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.id}
                  className="border-b border-gray-100 hover:bg-[#F0F4F1] transition"
                >
                  <td className="py-4 px-8 font-medium text-gray-800">{result.patient_name}</td>
                  <td className="py-4 px-8 text-gray-600">{result.section}</td>
                  <td className="py-4 px-8 text-gray-600">{result.test_name}</td>
                  <td className="py-4 px-8 font-bold text-[#3B6255]">
                    {result.result_value} {result.unit}
                  </td>
                  <td className="py-4 px-8 text-gray-600">{result.reference_range}</td>
                  <td className="py-4 px-8 text-gray-600">{new Date(result.date_created).toLocaleDateString()}</td>
                  <td className="py-4 px-8">
                    <div className="flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(result.status)}`}>
                        {getStatusLabel(result.status)}
                      </span>
                      {result.status !== 'released' && (
                        <button
                          onClick={() => moveToNextStatus(result.id, result.status)}
                          disabled={updatingStatusId === result.id}
                          className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-xs hover:underline disabled:opacity-50 transition"
                        >
                          {updatingStatusId === result.id ? 'Updating...' : 'Next ➜'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-8 flex gap-2">
                    <button
                      onClick={() => handleEdit(result)}
                      className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
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
