'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, CheckCircle, Clock, AlertCircle, ArrowRight, Edit2, Loader, Printer, DollarSign, CreditCard, ChevronRight, Check } from 'lucide-react';
import { fetchTestResults, addTestResult, updateTestResult, deleteTestResult, fetchPatients, fetchBilling, getAbnormalStatus, getTestPrice } from '@/lib/database';
import { TEST_REFERENCE_RANGES } from '@/lib/mockData';
import { useAuth } from '@/lib/authContext';

// Status Stepper Component
const StatusStepper = ({ 
  currentStatus, 
  onAdvance, 
  isUpdating 
}: { 
  currentStatus: string; 
  onAdvance: () => void; 
  isUpdating: boolean;
}) => {
  const steps = [
    { key: 'pending', label: 'Pending', icon: Clock },
    { key: 'encoding', label: 'Encoding', icon: Edit2 },
    { key: 'for_verification', label: 'Verification', icon: AlertCircle },
    { key: 'approved', label: 'Approved', icon: CheckCircle },
    { key: 'released', label: 'Released', icon: Check },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStatus);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[320px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Status Pipeline</span>
        {currentStatus !== 'released' && (
          <button
            onClick={onAdvance}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-[#3B6255] text-white text-xs rounded-lg hover:bg-[#5A7669] transition font-semibold disabled:opacity-50 flex items-center gap-1"
          >
            {isUpdating ? 'Updating...' : 'Advance →'}
          </button>
        )}
      </div>
      
      <div className="relative">
        {/* Progress line background */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0"></div>
        {/* Progress line filled */}
        <div 
          className="absolute top-4 left-4 h-0.5 bg-[#3B6255] z-0 transition-all duration-300"
          style={{ width: `${(currentIndex / (steps.length - 1)) * (100 - 8)}%` }}
        ></div>
        
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isUpcoming = index > currentIndex;
            const Icon = step.icon;
            
            return (
              <div key={step.key} className="flex flex-col items-center z-10">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-[#3B6255] text-white' 
                      : isCurrent 
                        ? 'bg-[#3B6255] text-white ring-4 ring-[#3B6255]/20 animate-pulse' 
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span 
                  className={`text-[10px] mt-1.5 font-medium text-center max-w-[60px] ${
                    isCompleted || isCurrent ? 'text-[#3B6255]' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="text-[8px] text-[#3B6255] font-bold mt-0.5">CURRENT</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
  price?: number;
  paymentStatus?: 'paid' | 'unpaid';
  abnormal?: 'normal' | 'high' | 'low';
}

const LAB_SECTIONS = [
  'BLOOD BANK',
  'ISBB',
  'HEMATOLOGY',
  'CLINICAL CHEMISTRY',
  'MICROBIOLOGY',
  'IMMUNOLOGY',
  'HISTOPATHOLOGY',
  'SEROLOGY',
];

// Dynamically generate TESTS_BY_SECTION from TEST_REFERENCE_RANGES
const TESTS_BY_SECTION: Record<string, { name: string; referenceRange: string; unit: string }[]> = Object.keys(
  TEST_REFERENCE_RANGES,
).reduce((acc, section) => {
  acc[section] = Object.entries(TEST_REFERENCE_RANGES[section]).map(([testName, range]) => ({
    name: testName,
    referenceRange: range.normal || `${range.min || ''} - ${range.max || ''}`,
    unit: range.unit,
  }));
  return acc;
}, {} as Record<string, { name: string; referenceRange: string; unit: string }[]>);

// Predefined dropdown options for specific tests
const TEST_DROPDOWN_OPTIONS: Record<string, string[]> = {
  'ABO Blood Typing': ['Type A', 'Type B', 'Type AB', 'Type O'],
  'Rh Typing': ['Rh Positive (D+)', 'Rh Negative (D-)'],
  'Crossmatching': ['Compatible', 'Incompatible'],
  'Antibody Screening': ['Negative', 'Positive'],
  'Infectious Disease Screening': ['Non-Reactive for any infectious disease', 'Reactive for HIV', 'Reactive for HBV', 'Reactive for HCV', 'Reactive for Syphilis', 'Reactive for Malaria'],
  'Culture': ['No growth', 'Growth detected'],
  'Sensitivity': ['S (Susceptible)', 'I (Intermediate)', 'R (Resistant)'],
  'Gram Staining': ['No bacteria seen', 'Gram Positive Cocci', 'Gram Positive Bacilli', 'Gram Negative Cocci', 'Gram Negative Bacilli'],
  'India Ink': ['Positive (Encapsulated yeast cells seen)', 'Negative (No encapsulated yeast cells seen)'],
  'Wet Mount': ['Negative', 'Positive'],
  'KOH Mount': ['Negative', 'Positive'],
  'Pregnancy Test (hCG)': ['Negative', 'Positive'],
  'Fecal Occult Blood Test': ['Negative', 'Positive'],
  'Fecalysis - Ova or Parasite': ['Negative', 'Positive - Ascaris', 'Positive - Hookworm', 'Positive - Trichuris'],
  'Kidney Biopsy': ['Normal/Unremarkable', 'Active disease', 'Scarring'],
  'Bone Biopsy': ['Normal', 'Anormal', 'Inconclusive'],
  'Liver Biopsy Fibrosis': ['F0: No fibrosis (Healthy)', 'F1: Portal fibrosis without septa (Mild fibrosis)', 'F2: Portal fibrosis with few septa (Moderate/Significant fibrosis)', 'F3: Numerous septa without cirrhosis (Severe fibrosis)', 'F4: Cirrhosis (Advanced scarring)'],
  'Liver Biopsy Activity': ['A0: No activity', 'A1: Minimal/mild activity', 'A2: Moderate activity', 'A3: Severe activity'],
};

// Custom placeholder hints for specific tests
const TEST_PLACEHOLDER_HINTS: Record<string, string> = {
  'Skin Biopsy': 'e.g., Unremarkable skin',
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
  const [billings, setBillings] = useState<any[]>([]);
  const [printResult, setPrintResult] = useState<TestResult | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedStepperId, setExpandedStepperId] = useState<string | null>(null);

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

  const getAbnormalIndicator = (status: string | undefined) => {
    if (status === 'high') return { symbol: '↑', color: 'text-red-600', label: 'HIGH' };
    if (status === 'low') return { symbol: '↓', color: 'text-blue-600', label: 'LOW' };
    return { symbol: '✓', color: 'text-green-600', label: 'NORMAL' };
  };

  const handlePrint = (result: TestResult) => {
    setPrintResult(result);
    setTimeout(() => {
      if (printRef.current) {
        window.print();
      }
    }, 100);
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
    loadBillings();
  }, []);

  const loadPatients = async () => {
    const data = await fetchPatients();
    setPatients(data);
  };

  const loadBillings = async () => {
    const data = await fetchBilling();
    setBillings(data);
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
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter patient name"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white placeholder-gray-500 ${
                  errors.patientName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
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
                  <p>✓ Tests available in this section</p>
                </div>
              )}
            </div>

            {/* Test Selection */}
            {selectedSection && (
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
            {selectedTest && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Result Value <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {TEST_DROPDOWN_OPTIONS[selectedTest] ? (
                    <select
                      value={resultValue}
                      onChange={(e) => setResultValue(e.target.value)}
                      className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                        errors.resultValue ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select result</option>
                      {TEST_DROPDOWN_OPTIONS[selectedTest].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={resultValue}
                      onChange={(e) => setResultValue(e.target.value)}
                      placeholder={TEST_PLACEHOLDER_HINTS[selectedTest] || 'Enter result value'}
                      className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                        errors.resultValue ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  )}
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Test Results ({results.length})</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by patient or test..."
                  className="w-full sm:w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="encoding">Encoding</option>
                <option value="for_verification">For Verification</option>
                <option value="approved">Approved</option>
                <option value="released">Released</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Patient Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Lab Section</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Test Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Result</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Price</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Payment</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {results
                .filter((result) => {
                  // Search filter
                  if (searchTerm) {
                    const search = searchTerm.toLowerCase();
                    const matchesSearch = 
                      result.patient_name?.toLowerCase().includes(search) ||
                      result.test_name?.toLowerCase().includes(search) ||
                      result.section?.toLowerCase().includes(search);
                    if (!matchesSearch) return false;
                  }
                  // Status filter
                  if (statusFilter !== 'all' && result.status !== statusFilter) return false;
                  return true;
                })
                .map((result) => {
                const price = getTestPrice(result.test_name, result.section);
                const billing = billings.find(b => 
                  b.test_name === result.test_name && 
                  b.patient_name === result.patient_name
                );
                const abnormal = getAbnormalStatus(result.result_value, result.test_name, result.section);
                const indicator = getAbnormalIndicator(abnormal);
                
                return (
                  <tr
                    key={result.id}
                    className="border-b border-gray-100 hover:bg-[#F0F4F1] transition"
                  >
                    <td className="py-4 px-8 font-medium text-gray-800">{result.patient_name}</td>
                    <td className="py-4 px-8 text-gray-600">{result.section}</td>
                    <td className="py-4 px-8 text-gray-600">{result.test_name}</td>
                    <td className="py-4 px-8 font-bold text-[#3B6255]">
                      <div className="flex items-center gap-2">
                        {result.result_value} {result.unit}
                        <span className={`${indicator.color} font-bold text-lg`}>{indicator.symbol}</span>
                      </div>
                    </td>
                    <td className="py-4 px-8 relative">
                      <button
                        onClick={() => setExpandedStepperId(expandedStepperId === result.id ? null : result.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(result.status)} flex items-center gap-1 cursor-pointer hover:opacity-80 transition`}
                        title="Click to view status pipeline"
                      >
                        {updatingStatusId === result.id ? 'Updating...' : getStatusLabel(result.status)}
                        <ChevronRight className={`w-3 h-3 transition-transform ${expandedStepperId === result.id ? 'rotate-90' : ''}`} />
                      </button>
                    </td>
                    <td className="py-4 px-8 font-semibold text-gray-800">
                      {price ? `₱${price}` : ''}
                    </td>
                    <td className="py-4 px-8">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                        billing?.status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {billing?.status === 'paid' ? (
                          <>✓ Paid</>
                        ) : (
                          <>⏳ Unpaid</>
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-8 flex gap-2">
                      <button
                        onClick={() => handleEdit(result)}
                        className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1"
                        title="Edit Result"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      {result.status === 'released' && (
                        <button
                          onClick={() => handlePrint(result)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-1"
                          title="Print Result"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Stepper Modal */}
      {expandedStepperId && (() => {
        const result = results.find(r => r.id === expandedStepperId);
        if (!result) return null;
        return (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/20 z-40" 
              onClick={() => setExpandedStepperId(null)}
            />
            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto">
                <StatusStepper 
                  currentStatus={result.status}
                  onAdvance={() => {
                    moveToNextStatus(result.id, result.status);
                    setExpandedStepperId(null);
                  }}
                  isUpdating={updatingStatusId === result.id}
                />
              </div>
            </div>
          </>
        );
      })()}

      {/* Print Report - Hidden but printable */}
      {printResult && (() => {
        const billing = billings.find(b => 
          b.test_name === printResult.test_name && 
          b.patient_name === printResult.patient_name
        );
        const price = getTestPrice(printResult.test_name, printResult.section);
        const abnormalStatus = getAbnormalStatus(printResult.result_value, printResult.test_name, printResult.section);
        const statusDisplay = abnormalStatus === 'high' ? '↑ HIGH' : abnormalStatus === 'low' ? '↓ LOW' : '✓ NORMAL';

        return (
        <div ref={printRef} style={{ display: 'none' }}>
          <div style={{
            fontFamily: 'Arial, sans-serif',
            padding: '40px',
            maxWidth: '800px',
            margin: '0 auto',
            color: '#000',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #3B6255', paddingBottom: '20px' }}>
              <h1 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: 'bold' }}>Laboratory Test Result</h1>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Professional Laboratory Information System</p>
            </div>

            {/* Patient Info */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>PATIENT INFORMATION</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '13px' }}>
                <div>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>Patient Name:</p>
                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{printResult.patient_name}</p>
                </div>
                <div>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>Date of Test:</p>
                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{new Date(printResult.date_created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </div>

            {/* Test Details */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>TEST RESULT</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Laboratory Section:</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{printResult.section}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Test Name:</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{printResult.test_name}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Result Value:</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold', color: '#3B6255' }}>{printResult.result_value} {printResult.unit}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Reference Range:</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{printResult.reference_range}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Status:</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #ddd', backgroundColor: '#CBDED3', color: '#3B6255', fontWeight: 'bold' }}>
                    {statusDisplay}
                  </td>
                </tr>
              </table>
            </div>

            {/* Billing Information */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>BILLING INFORMATION</h3>
              <div style={{ fontSize: '13px' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>Test Price:</span>
                  <span>{price ? `₱${price.toFixed(2)}` : ''}</span>
                </div>
                <div style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: billing?.status === 'paid' ? 'green' : 'orange' }}>
                  <span>Payment Status:</span>
                  <span>{billing?.status === 'paid' ? '✓ PAID' : '⏳ UNPAID'}</span>
                </div>
                {billing?.status === 'paid' && billing?.or_number && (
                  <div style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold' }}>OR Number:</span>
                    <span style={{ fontFamily: 'monospace' }}>{billing.or_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #ccc', textAlign: 'center', fontSize: '11px', color: '#666' }}>
              <p style={{ margin: '5px 0' }}>This is an official test result from the Laboratory Information System</p>
              <p style={{ margin: '5px 0' }}>Report Generated: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
