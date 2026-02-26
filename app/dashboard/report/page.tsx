'use client';

import { useState, useRef, useEffect } from 'react';
import { Eye, Printer, FileText } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { fetchTestResults } from '@/lib/database';
import { MOCK_PATIENTS } from '@/lib/mockData';

interface ReportData {
  patientName: string;
  age: number;
  sex: string;
  municipality: string;
  province: string;
  address: string;
  physiciană: string;
  tests: Array<{
    name: string;
    result: string;
    referenceRange: string;
    unit: string;
  }>;
  billingStatus: 'paid' | 'unpaid';
  dateReleased: string;
}

export default function PrintReportPage() {
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [testResults, setTestResults] = useState<any[]>([]);

  // Load test results on mount
  useEffect(() => {
    loadTestResults();
  }, []);

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
      
      @keyframes fadeInSlideLeft {
        from {
          opacity: 0;
          transform: translateX(-30px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes fadeInSlideRight {
        from {
          opacity: 0;
          transform: translateX(30px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const loadTestResults = async () => {
    const results = await fetchTestResults();
    setTestResults(results);
  };

  // Build report data from selected patient and their test results
  const buildReportData = (patientId: string) => {
    const patient = MOCK_PATIENTS.find(p => p.id === patientId);
    if (!patient) return null;

    const patientFullName = `${patient.first_name} ${patient.last_name}`;
    const patientResults = testResults.filter(r => r.patient_name === patientFullName);

    return {
      patientName: patientFullName,
      age: patient.age,
      sex: patient.sex,
      municipality: patient.municipality,
      province: patient.province,
      address: `${patient.address_house_no || 'N/A'} ${patient.address_street || patient.address_barangay}`,
      physiciană: 'Dr. Santos',
      tests: patientResults.length > 0 
        ? patientResults.map(r => ({
            name: r.test_name,
            result: r.result_value,
            referenceRange: r.reference_range,
            unit: r.unit,
          }))
        : [
            {
              name: 'No test results found',
              result: '-',
              referenceRange: '-',
              unit: '-',
            },
          ],
      billingStatus: 'paid' as const,
      dateReleased: new Date().toISOString().split('T')[0],
    };
  };

  const [signatures, setSignatures] = useState({
    pathologistName: 'Dr. Maria Garcia',
    medtech1Name: 'John Smith',
    medtech2Name: 'Jane Doe',
    useDigitalSignature: true,
  });

  // Ref for report content to print
  const reportContentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: reportContentRef,
    documentTitle: 'Laboratory Report',
  });

  const togglePreview = () => {
    if (!selectedPatientId) {
      alert('Please select a patient');
      return;
    }
    if (showPreview) {
      setSelectedReport(null);
      setShowPreview(false);
    } else {
      const reportData = buildReportData(selectedPatientId);
      setSelectedReport(reportData);
      setShowPreview(true);
    }
  };

  return (
    <div className="space-y-8" style={{
      animation: 'fadeInSlideUp 0.6s ease-out'
    }}>
      {/* Header */}
      <div className="transition-all duration-500 opacity-100" style={{
        animation: 'fadeInSlideUp 0.6s ease-out',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <h1 className="text-3xl font-bold text-gray-800">Laboratory Report Generation</h1>
        <p className="text-gray-600 text-sm mt-1">Generate and print professional laboratory reports</p>
      </div>

      {/* Report Preview Section */}
      <div className="flex gap-6">
        {/* Controls */}
        <div className="w-full lg:w-1/3" style={{
          animation: 'fadeInSlideLeft 0.6s ease-out 0.3s backwards'
        }}>
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Report Configuration</h2>
              
              {/* Patient Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Patient <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    setShowPreview(false);
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white"
                >
                  <option value="">-- Select a Patient --</option>
                  {MOCK_PATIENTS.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} (ID: {patient.patient_id_no})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={togglePreview}
                disabled={!selectedPatientId}
                className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 font-bold text-lg flex items-center justify-center gap-3 border border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {showPreview ? (
                  <>
                    ✕ Close Preview
                  </>
                ) : (
                  <>
                    <Eye className="w-6 h-6" />
                    Preview Report
                  </>
                )}
              </button>
            </div>

            {showPreview && (
              <div className="border-t pt-6 transition-all duration-300">
                {/* Signature Configuration */}
                <div className="border-b pb-6 mb-6">
                  <h3 className="font-semibold text-gray-800 mb-4">E-Signature Setup</h3>

                  <div className="space-y-4">
                    <div className="transition-all duration-200 hover:bg-gray-50 p-3 rounded-lg">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pathologist Name
                      </label>
                      <input
                        type="text"
                        value={signatures.pathologistName}
                        onChange={(e) =>
                          setSignatures({ ...signatures, pathologistName: e.target.value })
                        }
                        placeholder="Enter pathologist name"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] focus:scale-105 outline-none transition-all duration-200 text-gray-800 font-medium bg-white placeholder-gray-400"
                      />
                    </div>

                    <div className="transition-all duration-200 hover:bg-gray-50 p-3 rounded-lg">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        MedTech 1 Name
                      </label>
                      <input
                        type="text"
                        value={signatures.medtech1Name}
                        onChange={(e) =>
                          setSignatures({ ...signatures, medtech1Name: e.target.value })
                        }
                        placeholder="Enter MedTech 1 name"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] focus:scale-105 outline-none transition-all duration-200 text-gray-800 font-medium bg-white placeholder-gray-400"
                      />
                    </div>

                    <div className="transition-all duration-200 hover:bg-gray-50 p-3 rounded-lg">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        MedTech 2 Name
                      </label>
                      <input
                        type="text"
                        value={signatures.medtech2Name}
                        onChange={(e) =>
                          setSignatures({ ...signatures, medtech2Name: e.target.value })
                        }
                        placeholder="Enter MedTech 2 name"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] focus:scale-105 outline-none transition-all duration-200 text-gray-800 font-medium bg-white placeholder-gray-400"
                      />
                    </div>

                    <div className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200 cursor-pointer">
                      <input
                        type="checkbox"
                        id="digital"
                        checked={signatures.useDigitalSignature}
                        onChange={(e) =>
                          setSignatures({ ...signatures, useDigitalSignature: e.target.checked })
                        }
                        className="w-4 h-4 transition-all duration-150 cursor-pointer"
                      />
                      <label htmlFor="digital" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Use Digital Signatures
                      </label>
                    </div>
                  </div>
                </div>

                {/* Print Button */}
                <div className="transition-all duration-300">
                  <button
                    onClick={handlePrint}
                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 font-bold text-lg flex items-center justify-center gap-3 border border-blue-400"
                  >
                    <Printer className="w-6 h-6 transition-transform duration-200 group-hover:rotate-12" />
                    Print Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Report Preview */}
        {showPreview && selectedReport && (
          <div className="w-full lg:w-2/3 transition-all duration-300" style={{
            animation: 'fadeInSlideRight 0.6s ease-out 0.3s backwards'
          }}>
            <div ref={reportContentRef} id="report-content" className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Printable Report */}
              <div className="p-12 bg-white" style={{ fontSize: '12pt', fontFamily: 'Arial, sans-serif' }}>
                {/* Header */}
                <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
                  <h1 className="text-2xl font-bold text-gray-800">CogniLab Lab Information System</h1>
                  <p className="text-gray-600 text-lg font-semibold">Clinic Laboratory Report</p>
                  <p className="text-gray-700 text-sm font-medium mt-1">Professional Medical Testing Services</p>
                </div>

                {/* Patient Information */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-[#3B6255] pb-2">
                    PATIENT INFORMATION
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 font-semibold">Patient Name:</p>
                      <p className="text-gray-800 font-bold">{selectedReport.patientName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">Age / Sex:</p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.age} / {selectedReport.sex}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">Municipality:</p>
                      <p className="text-gray-800 font-bold">{selectedReport.municipality}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">Province:</p>
                      <p className="text-gray-800 font-bold">{selectedReport.province}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600 font-semibold">Address:</p>
                      <p className="text-gray-800 font-bold">{selectedReport.address}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">Requesting Physician:</p>
                      <p className="text-gray-800 font-bold">{selectedReport.physiciană}</p>
                    </div>
                  </div>
                </div>

                {/* Test Results */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-[#3B6255] pb-2">
                    LABORATORY TEST RESULTS
                  </h2>
                  <table className="w-full border-2 border-gray-800 text-sm">
                    <thead className="bg-[#3B6255] text-white">
                      <tr>
                        <th className="border-2 border-gray-800 px-4 py-3 text-left font-bold text-base">
                          Test Name
                        </th>
                        <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-base">
                          Result
                        </th>
                        <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-base">
                          Unit
                        </th>
                        <th className="border-2 border-gray-800 px-4 py-3 text-left font-bold text-base">
                          Reference Range
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.tests.map((test, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}>
                          <td className="border border-gray-800 px-4 py-2 font-semibold text-gray-800">{test.name}</td>
                          <td className="border border-gray-800 px-4 py-2 text-center font-bold text-[#3B6255] text-base">
                            {test.result}
                          </td>
                          <td className="border border-gray-800 px-4 py-2 text-center font-semibold text-gray-800">{test.unit}</td>
                          <td className="border border-gray-800 px-4 py-2 font-semibold text-gray-800">{test.referenceRange}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Billing Status */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-[#3B6255] pb-2">
                    BILLING STATUS
                  </h2>
                  <div className="bg-[#3B6255] border-2 border-gray-800 px-6 py-4 rounded-lg">
                    <p className="text-base font-bold text-white">
                      <span>Payment Status:&nbsp;&nbsp;</span>
                      <span
                        className={`font-bold text-lg ${
                          selectedReport.billingStatus === 'paid'
                            ? 'text-green-300'
                            : 'text-red-300'
                        }`}
                      >
                        {selectedReport.billingStatus === 'paid' ? '✓ PAID' : '✗ UNPAID'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="mt-8">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 border-b-2 border-[#3B6255] pb-2">
                    AUTHORIZED SIGNATURES
                  </h2>
                  <div className="grid grid-cols-3 gap-6">
                    {/* Pathologist */}
                    <div className="text-center">
                      <div className="border-t-2 border-gray-800 pt-2 mb-2 h-16 flex items-end justify-center">
                        {signatures.useDigitalSignature && (
                          <span className="text-sm text-gray-600 italic font-semibold">E-Signature</span>
                        )}
                      </div>
                      <p className="font-bold text-sm text-gray-800">{signatures.pathologistName}</p>
                      <p className="text-sm text-gray-700 font-semibold">Pathologist</p>
                      <p className="text-sm text-gray-600 mt-1">{selectedReport.dateReleased}</p>
                    </div>

                    {/* MedTech 1 */}
                    <div className="text-center">
                      <div className="border-t-2 border-gray-800 pt-2 mb-2 h-16 flex items-end justify-center">
                        {signatures.useDigitalSignature && (
                          <span className="text-sm text-gray-600 italic font-semibold">E-Signature</span>
                        )}
                      </div>
                      <p className="font-bold text-sm text-gray-800">{signatures.medtech1Name}</p>
                      <p className="text-sm text-gray-700 font-semibold">Medical Technologist 1</p>
                      <p className="text-sm text-gray-600 mt-1">{selectedReport.dateReleased}</p>
                    </div>

                    {/* MedTech 2 */}
                    <div className="text-center">
                      <div className="border-t-2 border-gray-800 pt-2 mb-2 h-16 flex items-end justify-center">
                        {signatures.useDigitalSignature && (
                          <span className="text-sm text-gray-600 italic font-semibold">E-Signature</span>
                        )}
                      </div>
                      <p className="font-bold text-sm text-gray-800">{signatures.medtech2Name}</p>
                      <p className="text-sm text-gray-700 font-semibold">Medical Technologist 2</p>
                      <p className="text-sm text-gray-600 mt-1">{selectedReport.dateReleased}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center border-t-2 border-gray-800 pt-4">
                  <p className="text-sm text-gray-700 font-semibold">
                    This report is confidential and intended solely for the use of the addressed recipient.
                  </p>
                  <p className="text-sm text-gray-700 font-semibold mt-1">
                    Unauthorized access, distribution, or copying is strictly prohibited.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Templates Info */}
      {!showPreview && (
        <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg transition-all duration-300" style={{
          animation: 'fadeInSlideUp 0.6s ease-out 0.4s backwards'
        }}>
          <h3 className="font-semibold text-[#3B6255] mb-2">📋 Report Features</h3>
          <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">Professional medical report layout</li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">Patient information and demographics</li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">Complete test results with reference ranges</li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">Billing payment status</li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">Digital signature section</li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">Print-optimized formatting</li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">Clinic branding and footer</li>
          </ul>
        </div>
      )}

      {/* Print Styles & Animations */}
      <style>{`
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
        
        @keyframes fadeInSlideLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeInSlideRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        div[class*="space-y-8"] > div:first-child {
          animation: fadeInSlideUp 0.6s ease-out;
        }
        
        div[class*="flex"][class*="gap-6"] {
          animation: fadeInSlideUp 0.7s ease-out 0.2s backwards;
        }
        
        div[class*="w-full"][class*="lg:w-1/3"] {
          animation: fadeInSlideLeft 0.6s ease-out 0.3s backwards;
        }
        
        div[class*="w-full"][class*="lg:w-2/3"] {
          animation: fadeInSlideRight 0.6s ease-out 0.3s backwards;
        }
        
        div[class*="bg-\\[#CBDED3\\]"] {
          animation: fadeInSlideUp 0.6s ease-out 0.4s backwards;
        }
        
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          #report-content {
            box-shadow: none;
            border-radius: 0;
          }
          .hidden-on-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
