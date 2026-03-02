"use client";

import { useState, useRef, useEffect } from "react";
import { Eye, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { fetchTestResults, fetchPatients, fetchBilling } from "@/lib/database";

// Tests that have dropdown options (no numeric reference range)
const DROPDOWN_TESTS = [
  "ABO Blood Typing",
  "Rh Typing",
  "Crossmatching",
  "Antibody Screening",
  "Infectious Disease Screening",
  "Culture",
  "Sensitivity",
  "Sensitivity (Antibiogram)",
  "Gram Staining",
  "India Ink",
  "Wet Mount",
  "KOH Mount",
  "Pregnancy Test (hCG)",
  "Pregnancy Test (PT)",
  "Fecal Occult Blood Test",
  "Fecal Occult Blood Test (FOBT)",
  "Fecalysis - Ova or Parasite",
  "Routine Fecalysis (FA)",
  "UA Color",
  "UA Transparency",
  "UA Protein/Glucose",
  "UA Bilirubin/Ketone",
  "UA Bacteria/Casts/Crystals",
  "Preliminary Report",
  "Final Report",
];

const shouldShowReferenceRange = (testName: string): boolean => {
  return !DROPDOWN_TESTS.includes(testName);
};

// Fixed pathologist
const PATHOLOGIST = {
  displayName: "Elizabeth Chua, MD, FPSP",
  signatureFile: "elizabeth-chua-signature.png",
};

// MedTech roster with display names and signature file slugs
const MEDTECH_LIST = [
  {
    id: "khrieanna-buenaventura",
    displayName: "Khrieanna Rose C. Buenaventura, RMT",
    signatureFile: "khierana-signature.png",
  },
  {
    id: "mycah-hernandez",
    displayName: "Mycah Charrise M. Hernandez, RMT",
    signatureFile: "mycah-signature.png",
  },
  {
    id: "angel-gautane",
    displayName: "Angel Winder A. Gautane, RMT",
    signatureFile: "angel-signature.png",
  },
  {
    id: "aaron-imbien",
    displayName: "Aaron Kelvin L. Imbien, RMT",
    signatureFile: "aaron-signature.png",
  },
  {
    id: "ram-suarez",
    displayName: "Ram Jancel V. Suarez, RMT",
    signatureFile: "ram-jancel-signature.png",
  },
  {
    id: "xavier-bangit",
    displayName: "Xavier Beirut L. Bangit, RMT",
    signatureFile: "xavier-bangit.png",
  },
  {
    id: "janna-javon",
    displayName: "Janna Lea Javon, RMT",
    signatureFile: "janna-signature.png",
  },
  {
    id: "ryza-alvaran",
    displayName: "Ryza R. Alvaran, RMT",
    signatureFile: "ryza-signature.png",
  },
];

interface ReportData {
  patientName: string;
  age: number;
  sex: string;
  municipality: string;
  province: string;
  address: string;
  physician: string;
  tests: Array<{
    name: string;
    result: string;
    referenceRange: string;
    unit: string;
  }>;
  billingStatus: "paid" | "unpaid";
  dateReleased: string;
}

export default function PrintReportPage() {
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [testResults, setTestResults] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [billings, setBillings] = useState<any[]>([]);

  // Signature state — pathologist is fixed; medtechs are picked from dropdown
  const [medtech1Id, setMedtech1Id] = useState<string>("");
  const [medtech2Id, setMedtech2Id] = useState<string>("");

  const medtech1 = MEDTECH_LIST.find((m) => m.id === medtech1Id) ?? null;
  const medtech2 = MEDTECH_LIST.find((m) => m.id === medtech2Id) ?? null;

  // Filter options so the same person can't be in both slots
  const medtech1Options = MEDTECH_LIST.filter((m) => m.id !== medtech2Id);
  const medtech2Options = MEDTECH_LIST.filter((m) => m.id !== medtech1Id);

  useEffect(() => {
    loadTestResults();
    loadPatients();
    loadBillings();
  }, []);

  const loadPatients = async () => setPatients(await fetchPatients());
  const loadTestResults = async () => setTestResults(await fetchTestResults());
  const loadBillings = async () => setBillings(await fetchBilling());

  const buildReportData = (patientId: string): ReportData | null => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return null;

    const patientFullName = `${patient.first_name} ${patient.last_name}`;
    const patientResults = testResults.filter(
      (r) => r.patient_name === patientFullName,
    );

    const patientBillings = billings.filter(
      (b) =>
        b.patient_name === patientFullName || b.patientName === patientFullName,
    );
    const allTestsPaid =
      patientResults.length > 0 &&
      patientResults.every((test) => {
        const billing = patientBillings.find(
          (b) =>
            b.test_name === test.test_name || b.testName === test.test_name,
        );
        return billing?.status === "paid";
      });

    return {
      patientName: patientFullName,
      age: patient.age,
      sex: patient.sex,
      municipality: patient.municipality,
      province: patient.province,
      address: `${patient.address_house_no || ""} ${patient.address_street || patient.address_barangay}`,
      physician: "Elizabeth Chua, MD, FPSP",
      tests:
        patientResults.length > 0
          ? patientResults.map((r) => ({
              name: r.test_name,
              result: r.result_value,
              referenceRange: r.reference_range,
              unit: r.unit,
            }))
          : [
              {
                name: "No test results found",
                result: "-",
                referenceRange: "-",
                unit: "-",
              },
            ],
      billingStatus: allTestsPaid ? "paid" : "unpaid",
      dateReleased: new Date().toISOString().split("T")[0],
    };
  };

  const reportContentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: reportContentRef,
    documentTitle: "CogniLab Laboratory Report",
  });

  const togglePreview = () => {
    if (!selectedPatientId) {
      alert("Please select a patient");
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
    <div
      className="space-y-8"
      style={{ animation: "fadeInSlideUp 0.6s ease-out" }}
    >
      {/* Header */}
      <div style={{ animation: "fadeInSlideUp 0.6s ease-out 0.1s both" }}>
        <h1 className="text-3xl font-bold text-gray-800">
          CogniLab Laboratory Report Generation
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Generate and print professional laboratory reports
        </p>
      </div>

      <div className="flex gap-6">
        {/* ── Controls ── */}
        <div
          className="w-full lg:w-1/3"
          style={{ animation: "fadeInSlideLeft 0.6s ease-out 0.3s both" }}
        >
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Report Configuration
              </h2>

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
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} (ID:{" "}
                      {patient.patient_id_no})
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
                  "✕ Close Preview"
                ) : (
                  <>
                    <Eye className="w-6 h-6" /> Preview Report
                  </>
                )}
              </button>
            </div>

            {/* ── Signature Configuration (visible after preview) ── */}
            {showPreview && (
              <div className="border-t pt-6 transition-all duration-300">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Signature Setup
                </h3>

                <div className="space-y-5">
                  {/* Pathologist — fixed, display only */}
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Pathologist
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                      {PATHOLOGIST.displayName}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      <code className="bg-gray-100 px-1 rounded">
                      </code>
                    </p>
                  </div>

                  {/* MedTech 1 */}
                  <div className="transition-all duration-200 hover:bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-700 mb-0">
                      Medical Technologist 1{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={medtech1Id}
                      onChange={(e) => setMedtech1Id(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white"
                    >
                      <option value="">-- Select MedTech 1 --</option>
                      {medtech1Options.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                    {medtech1 && (
                      <p className="text-xs text-gray-400 mt-1">

                        <code className="bg-gray-100 px-1 rounded">

                        </code>
                      </p>
                    )}
                  </div>

                  {/* MedTech 2 */}
                  <div className="transition-all duration-200 hover:bg-gray-50 p-3 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-700 mb-0">
                      Medical Technologist 2{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={medtech2Id}
                      onChange={(e) => setMedtech2Id(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white"
                    >
                      <option value="">-- Select MedTech 2 --</option>
                      {medtech2Options.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                    {medtech2 && (
                      <p className="text-xs text-gray-400 mt-1">
                        <code className="bg-gray-100 px-1 rounded">
                        </code>
                      </p>
                    )}
                  </div>
                </div>

                {/* Print Button */}
                <div className="mt-6">
                  <button
                    onClick={handlePrint}
                    disabled={!medtech1Id || !medtech2Id}
                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 font-bold text-lg flex items-center justify-center gap-3 border border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer className="w-6 h-6" />
                    Print Report
                  </button>
                  {(!medtech1Id || !medtech2Id) && (
                    <p className="text-xs text-center text-amber-600 mt-2 font-medium">
                      Please select both MedTechs to enable printing.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Report Preview ── */}
        {showPreview && selectedReport && (
          <div
            className="w-full lg:w-2/3 transition-all duration-300"
            style={{ animation: "fadeInSlideRight 0.6s ease-out 0.3s both" }}
          >
            <div
              ref={reportContentRef}
              id="report-content"
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              <div
                className="p-12 bg-white"
                style={{ fontSize: "12pt", fontFamily: "Arial, sans-serif" }}
              >
                {/* Report Header */}
                <div className="text-center border-b-2 border-gray-800 pb-6 mb-6">
                  <h1 className="text-2xl font-bold text-gray-800">
                    CogniLab - KRRAX-JAM Inc
                  </h1>
                  <p className="text-gray-600 text-lg font-semibold">
                    Laboratory Report
                  </p>
                  <p className="text-gray-700 text-sm font-medium mt-1">
                    Professional Medical Testing Services
                  </p>
                </div>

                {/* Patient Information */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-[#3B6255] pb-2">
                    PATIENT INFORMATION
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 font-semibold">
                        Patient Name:
                      </p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.patientName}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">Age:</p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.age}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">Sex:</p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.sex}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">
                        Municipality:
                      </p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.municipality}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">Province:</p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.province}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600 font-semibold">Address:</p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.address}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold">
                        Requesting Physician:
                      </p>
                      <p className="text-gray-800 font-bold">
                        {selectedReport.physician}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Test Results Table */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-[#3B6255] pb-2">
                    LABORATORY TEST RESULTS
                  </h2>
                  {(() => {
                    const hasAnyReferenceRange = selectedReport.tests.some(
                      (t) => shouldShowReferenceRange(t.name),
                    );
                    return (
                      <table className="w-full border-2 border-gray-800 text-sm">
                        <thead className="bg-[#3B6255] text-white">
                          <tr>
                            <th className="border-2 border-gray-800 px-4 py-3 text-left font-bold text-base">
                              Test Name
                            </th>
                            <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-base">
                              Result
                            </th>
                            {hasAnyReferenceRange && (
                              <>
                                <th className="border-2 border-gray-800 px-4 py-3 text-center font-bold text-base">
                                  Unit
                                </th>
                                <th className="border-2 border-gray-800 px-4 py-3 text-left font-bold text-base">
                                  Reference Range
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReport.tests.map((test, index) => (
                            <tr
                              key={index}
                              className={
                                index % 2 === 0 ? "bg-gray-100" : "bg-white"
                              }
                            >
                              <td className="border border-gray-800 px-4 py-2 font-semibold text-gray-800">
                                {test.name}
                              </td>
                              <td className="border border-gray-800 px-4 py-2 text-center font-bold text-[#3B6255] text-base">
                                {test.result}
                              </td>
                              {hasAnyReferenceRange && (
                                <>
                                  <td className="border border-gray-800 px-4 py-2 text-center font-semibold text-gray-800">
                                    {shouldShowReferenceRange(test.name)
                                      ? test.unit
                                      : ""}
                                  </td>
                                  <td className="border border-gray-800 px-4 py-2 font-semibold text-gray-800">
                                    {shouldShowReferenceRange(test.name)
                                      ? test.referenceRange
                                      : ""}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>

                {/* Billing Status */}
                <div className="mb-6 print:hidden">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-[#3B6255] pb-2">
                    BILLING STATUS
                  </h2>
                  <div className="bg-[#3B6255] border-2 border-gray-800 px-6 py-4 rounded-lg">
                    <p className="text-base font-bold text-white">
                      <span>Payment Status:&nbsp;&nbsp;</span>
                      <span
                        className={`font-bold text-lg ${selectedReport.billingStatus === "paid" ? "text-green-300" : "text-red-300"}`}
                      >
                        {selectedReport.billingStatus === "paid"
                          ? "✓ PAID"
                          : "✗ UNPAID"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* ── Signature Section ── */}
                <div className="mt-8">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 border-b-2 border-[#3B6255] pb-2">
                    AUTHORIZED SIGNATURES
                  </h2>
                  <div className="grid grid-cols-3 gap-6">
                    {/* Pathologist */}
                    <SignatureBlock
                      name={PATHOLOGIST.displayName}
                      role="Pathologist"
                      signatureFile={PATHOLOGIST.signatureFile}
                      date={selectedReport.dateReleased}
                    />

                    {/* MedTech 1 */}
                    <SignatureBlock
                      name={medtech1?.displayName ?? ""}
                      role="Medical Technologist 1"
                      signatureFile={medtech1?.signatureFile}
                      date={selectedReport.dateReleased}
                      placeholder={!medtech1}
                    />

                    {/* MedTech 2 */}
                    <SignatureBlock
                      name={medtech2?.displayName ?? ""}
                      role="Medical Technologist 2"
                      signatureFile={medtech2?.signatureFile}
                      date={selectedReport.dateReleased}
                      placeholder={!medtech2}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center border-t-2 border-gray-800 pt-4">
                  <p className="text-sm text-gray-700 font-semibold">
                    This report is confidential and intended solely for the use
                    of the addressed recipient.
                  </p>
                  <p className="text-sm text-gray-700 font-semibold mt-1">
                    Unauthorized access, distribution, or copying is strictly
                    prohibited.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      {!showPreview && (
        <div
          className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg"
          style={{ animation: "fadeInSlideUp 0.6s ease-out 0.4s both" }}
        >
          <h3 className="font-semibold text-[#3B6255] mb-2">
            📋 Report Features
          </h3>
          <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">
              Professional medical report layout
            </li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">
              Patient information and demographics
            </li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">
              Complete test results with reference ranges
            </li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">
              Billing payment status
            </li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">
              PNG signature slots per authorized personnel
            </li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">
              MedTech selection from registered roster
            </li>
            <li className="transition-all duration-200 hover:translate-x-1 cursor-default">
              Print-optimized formatting
            </li>
          </ul>
        </div>
      )}

      <style>{`
        @keyframes fadeInSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInSlideLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInSlideRight {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media print {
          body { margin: 0; padding: 0; }
          #report-content { box-shadow: none; border-radius: 0; }
          .hidden-on-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Reusable Signature Block ─────────────────────────────────────────────────

interface SignatureBlockProps {
  name: string;
  role: string;
  signatureFile?: string;
  date: string;
  placeholder?: boolean;
}

function SignatureBlock({
  name,
  role,
  signatureFile,
  date,
  placeholder = false,
}: SignatureBlockProps) {
  const [imgError, setImgError] = useState(false);

  // Reset error state whenever the signatureFile changes (e.g. user switches medtech)
  useEffect(() => {
    setImgError(false);
  }, [signatureFile]);

  const showImage = !placeholder && signatureFile && !imgError;
  const showPending = !placeholder && signatureFile && imgError;
  const showNoSelection = placeholder;

  return (
    <div className="text-center">
      {/* Signature image area — height matches max-h */}
      <div className="border-t-2 border-gray-800 pt-2 mb-0 h-30 flex items-center justify-center">
        {showNoSelection ? (
          <span className="text-xs text-gray-400 italic">
            No MedTech selected
          </span>
        ) : showImage ? (
          <img
            src={`/signatures/${signatureFile}`}
            alt={`Signature of ${name}`}
            className="max-h-30 max-w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : showPending ? (
          <span className="text-xs text-gray-400 italic">
            Signature pending
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">
            Signature pending
          </span>
        )}
      </div>
      {/* Name & role */}
      <p className="font-bold text-sm text-gray-800">{name || "—"}</p>
      <p className="text-sm text-gray-700 font-semibold">{role}</p>
      <p className="text-sm text-gray-600 mt-1">{date}</p>
    </div>
  );
}
