'use client';

import { useState } from 'react';
import { Eye, Printer, FileText } from 'lucide-react';

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

  // Sample report data
  const sampleReport: ReportData = {
    patientName: 'Juan dela Cruz',
    age: 45,
    sex: 'Male',
    municipality: 'Manila',
    province: 'NCR',
    address: 'Lot 5, Block 2, Makati Ave',
    physiciană: 'Dr. Santos',
    tests: [
      {
        name: 'Random Blood Sugar (Glucose)',
        result: '110',
        referenceRange: '< 140 mg/dL',
        unit: 'mg/dL',
      },
      {
        name: 'Blood Cholesterol',
        result: '185',
        referenceRange: '< 200 mg/dL',
        unit: 'mg/dL',
      },
    ],
    billingStatus: 'paid',
    dateReleased: new Date().toISOString().split('T')[0],
  };

  const [signatures, setSignatures] = useState({
    pathologistName: 'Dr. Maria Garcia',
    medtech1Name: 'John Smith',
    medtech2Name: 'Jane Doe',
    useDigitalSignature: true,
  });

  const handlePrint = () => {
    window.print();
  };

  const togglePreview = () => {
    setSelectedReport(showPreview ? null : sampleReport);
    setShowPreview(!showPreview);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Laboratory Report Generation</h1>
        <p className="text-gray-600 text-sm mt-1">Generate and print professional laboratory reports</p>
      </div>

      {/* Report Preview Section */}
      <div className="flex gap-6">
        {/* Controls */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Report Configuration</h2>
              <button
                onClick={togglePreview}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2"
              >
                {showPreview ? (
                  <>
                    ✕ Close Preview
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    Preview Report
                  </>
                )}
              </button>
            </div>

            {showPreview && (
              <>
                {/* Signature Configuration */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-800 mb-4">E-Signature Setup</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pathologist Name
                      </label>
                      <input
                        type="text"
                        value={signatures.pathologistName}
                        onChange={(e) =>
                          setSignatures({ ...signatures, pathologistName: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        MedTech 1 Name
                      </label>
                      <input
                        type="text"
                        value={signatures.medtech1Name}
                        onChange={(e) =>
                          setSignatures({ ...signatures, medtech1Name: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        MedTech 2 Name
                      </label>
                      <input
                        type="text"
                        value={signatures.medtech2Name}
                        onChange={(e) =>
                          setSignatures({ ...signatures, medtech2Name: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="digital"
                        checked={signatures.useDigitalSignature}
                        onChange={(e) =>
                          setSignatures({ ...signatures, useDigitalSignature: e.target.checked })
                        }
                        className="w-4 h-4"
                      />
                      <label htmlFor="digital" className="text-sm font-medium text-gray-700">
                        Use Digital Signatures
                      </label>
                    </div>
                  </div>
                </div>

                {/* Print Button */}
                <div className="border-t pt-6">
                  <button
                    onClick={handlePrint}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Print Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Report Preview */}
        {showPreview && selectedReport && (
          <div className="w-full lg:w-2/3">
            <div id="report-content" className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Printable Report */}
              <div className="p-12 bg-white" style={{ fontSize: '12pt', fontFamily: 'Arial, sans-serif' }}>
                {/* Header */}
                <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#3B6255] to-green-900 rounded-full mb-3 text-white text-xl font-bold">
                    L
                  </div>
                  <h1 className="text-2xl font-bold text-gray-800">LABORATORY INFORMATION SYSTEM</h1>
                  <p className="text-gray-600 text-sm">Clinic Laboratory Report</p>
                  <p className="text-gray-500 text-xs mt-1">Professional Medical Testing Services</p>
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
                  <table className="w-full border border-gray-400 text-sm">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="border border-gray-400 px-4 py-2 text-left font-bold">
                          Test Name
                        </th>
                        <th className="border border-gray-400 px-4 py-2 text-center font-bold">
                          Result
                        </th>
                        <th className="border border-gray-400 px-4 py-2 text-center font-bold">
                          Unit
                        </th>
                        <th className="border border-gray-400 px-4 py-2 text-left font-bold">
                          Reference Range
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.tests.map((test, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border border-gray-400 px-4 py-2">{test.name}</td>
                          <td className="border border-gray-400 px-4 py-2 text-center font-bold text-[#3B6255]">
                            {test.result}
                          </td>
                          <td className="border border-gray-400 px-4 py-2 text-center">{test.unit}</td>
                          <td className="border border-gray-400 px-4 py-2">{test.referenceRange}</td>
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
                  <div className="bg-gray-50 border border-gray-300 px-4 py-3 rounded">
                    <p className="text-sm">
                      <span className="font-bold">Payment Status:</span>{' '}
                      <span
                        className={`font-bold ${
                          selectedReport.billingStatus === 'paid'
                            ? 'text-green-600'
                            : 'text-red-600'
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
                          <span className="text-xs text-gray-500 italic">E-Signature</span>
                        )}
                      </div>
                      <p className="font-bold text-xs">{signatures.pathologistName}</p>
                      <p className="text-xs text-gray-600">Pathologist</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedReport.dateReleased}</p>
                    </div>

                    {/* MedTech 1 */}
                    <div className="text-center">
                      <div className="border-t-2 border-gray-800 pt-2 mb-2 h-16 flex items-end justify-center">
                        {signatures.useDigitalSignature && (
                          <span className="text-xs text-gray-500 italic">E-Signature</span>
                        )}
                      </div>
                      <p className="font-bold text-xs">{signatures.medtech1Name}</p>
                      <p className="text-xs text-gray-600">Medical Technologist 1</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedReport.dateReleased}</p>
                    </div>

                    {/* MedTech 2 */}
                    <div className="text-center">
                      <div className="border-t-2 border-gray-800 pt-2 mb-2 h-16 flex items-end justify-center">
                        {signatures.useDigitalSignature && (
                          <span className="text-xs text-gray-500 italic">E-Signature</span>
                        )}
                      </div>
                      <p className="font-bold text-xs">{signatures.medtech2Name}</p>
                      <p className="text-xs text-gray-600">Medical Technologist 2</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedReport.dateReleased}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center border-t-2 border-gray-800 pt-4">
                  <p className="text-xs text-gray-600">
                    This report is confidential and intended solely for the use of the addressed recipient.
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
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
        <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg">
          <h3 className="font-semibold text-[#3B6255] mb-2">📋 Report Features</h3>
          <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
            <li>Professional medical report layout</li>
            <li>Patient information and demographics</li>
            <li>Complete test results with reference ranges</li>
            <li>Billing payment status</li>
            <li>Digital signature section</li>
            <li>Print-optimized formatting</li>
            <li>Clinic branding and footer</li>
          </ul>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
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
