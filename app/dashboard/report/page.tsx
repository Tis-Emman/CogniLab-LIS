"use client";

import { useState, useRef, useEffect } from "react";
import { Eye, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { fetchTestResults, fetchPatients, fetchBilling } from "@/lib/database";

const DROPDOWN_TESTS = [
  "ABO Blood Typing","Rh Typing","Crossmatching","Antibody Screening",
  "Infectious Disease Screening","Culture","Sensitivity","Sensitivity (Antibiogram)",
  "Gram Staining","India Ink","Wet Mount","KOH Mount","Pregnancy Test (hCG)",
  "Pregnancy Test (PT)","Fecal Occult Blood Test","Fecal Occult Blood Test (FOBT)",
  "Fecalysis - Ova or Parasite","Routine Fecalysis (FA)","UA Color","UA Transparency",
  "UA Protein/Glucose","UA Bilirubin/Ketone","UA Bacteria/Casts/Crystals",
  "Preliminary Report","Final Report",
];

const shouldShowReferenceRange = (testName: string): boolean =>
  !DROPDOWN_TESTS.includes(testName);

// ── Abnormal status helper ────────────────────────────────────────────────────
function getAbnormalStatus(
  resultValue: string,
  referenceRange: string
): "high" | "low" | "normal" | null {
  const num = parseFloat(resultValue);
  if (isNaN(num) || !referenceRange) return null;

  // e.g. "135 - 145", "3.4-5.0", "< 200", "> 60", "≤ 5.7", "≥ 10"
  const ltMatch = referenceRange.match(/^[<≤]\s*([\d.]+)/);
  const gtMatch = referenceRange.match(/^[>≥]\s*([\d.]+)/);
  const rangeMatch = referenceRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);

  if (ltMatch) {
    const max = parseFloat(ltMatch[1]);
    return num > max ? "high" : "normal";
  }
  if (gtMatch) {
    const min = parseFloat(gtMatch[1]);
    return num < min ? "low" : "normal";
  }
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (num < min) return "low";
    if (num > max) return "high";
    return "normal";
  }
  return null;
}

// ── Abnormal indicator renderer ───────────────────────────────────────────────
function AbnormalIndicator({ status, forPrint = false }: { status: "high" | "low" | "normal" | null; forPrint?: boolean }) {
  if (!status || status === "normal") return null;
  const isHigh = status === "high";
  const color = isHigh ? "#dc2626" : "#2563eb";
  const symbol = isHigh ? "↑" : "↓";
  return (
    <span style={{
      color,
      fontWeight: "bold",
      fontSize: forPrint ? "9pt" : "11pt",
      marginLeft: "4px",
      display: "inline-block",
    }}>
      {symbol}
    </span>
  );
}

// ── Flat reference ranges for multiline sub-field lookup ─────────────────────
// Covers CBC differential, RBC indices, PT/INR/PTT, ABG, UA sub-lines
const TEST_REFERENCE_RANGES_FLAT: Record<string, { min?: number; max?: number }> = {
  // CBC differential
  "Neutrophils":   { min: 45,  max: 75  },
  "Lymphocytes":   { min: 16,  max: 46  },
  "Monocytes":     { min: 4,   max: 11  },
  "Eosinophils":   { min: 0,   max: 8   },
  "Basophils":     { min: 0,   max: 3   },
  // RBC Indices
  "MCV":           { min: 80,  max: 100 },
  "MCH":           { min: 27,  max: 31  },
  "RDW":           { min: 11.5,max: 14.5},
  // Coagulation
  "PT":            { min: 11.0,max: 13.5},
  "INR":           { min: 0.8, max: 1.2 },
  "aPTT":          { min: 25.0,max: 35.0},
  // ABG
  "pH":            { min: 4.5, max: 8.0 },
  "pCO2":          { min: 35,  max: 45  },
  "PO2":           { min: 80,  max: 100 },
  "SaO2":          { min: 90             },
  "HCO3":          { min: 22,  max: 26  },
  // UA numeric sub-fields
  "pH ":           { min: 4.5, max: 8.0 },
  "Urobilinogen":  { min: 0.2, max: 1.0 },
  "WBC":           { min: 0,   max: 5   },
  "RBC":           { min: 0,   max: 2   },
  // Electrolytes
  "Na+":           { min: 135, max: 145 },
  "K+":            { min: 3.4, max: 5.0 },
  "Cl-":           { min: 95,  max: 108 },
  "Bicarbonate":   { min: 20,  max: 32  },
  "Ca++":          { min: 8.5, max: 10.5},
  "Phosphorus":    { min: 3.0, max: 4.5 },
  "Mg++":          { min: 1.8, max: 3.0 },
};

const PATHOLOGIST = {
  displayName: "Elizabeth Chua, MD, FPSP",
  license: "Lic. #00078301",
  signatureFile: "elizabeth-chua-signature.png",
};

const MEDTECH_LIST = [
  { id: "khrieanna-buenaventura", displayName: "Khrieanna Rose C. Buenaventura, RMT", license: "Lic. #0001", signatureFile: "khierana-signature.png" },
  { id: "mycah-hernandez",        displayName: "Mycah Charrise M. Hernandez, RMT",    license: "Lic. #0002", signatureFile: "mycah-signature.png" },
  { id: "angel-gautane",          displayName: "Angel Winder A. Gautane, RMT",         license: "Lic. #0003", signatureFile: "angel-signature.png" },
  { id: "aaron-imbien",           displayName: "Aaron Kelvin L. Imbien, RMT",          license: "Lic. #0004", signatureFile: "aaron-signature.png" },
  { id: "ram-suarez",             displayName: "Ram Jancel V. Suarez, RMT",            license: "Lic. #0005", signatureFile: "ram-jancel-signature.png" },
  { id: "xavier-bangit",          displayName: "Xavier Beirut L. Bangit, RMT",         license: "Lic. #0006", signatureFile: "xavier-signature.png" },
  { id: "janna-javon",            displayName: "Janna Lea Javon, RMT",                 license: "Lic. #0007", signatureFile: "janna-signature.png" },
  { id: "ryza-alvaran",           displayName: "Ryza R. Alvaran, RMT",                 license: "Lic. #0008", signatureFile: "ryza-signature.png" },
];

interface ReportData {
  patientId: string;
  patientName: string;
  age: number;
  sex: string;
  birthdate: string;
  municipality: string;
  province: string;
  address: string;
  physician: string;
  dateRequested: string;
  dateReceived: string;
  tests: Array<{ section: string; name: string; result: string; referenceRange: string; unit: string; }>;
  billingStatus: "paid" | "unpaid";
  dateReleased: string;
}

// Group tests by section
function groupTestsBySection(tests: ReportData["tests"]) {
  const map: Record<string, ReportData["tests"]> = {};
  for (const t of tests) {
    if (!map[t.section]) map[t.section] = [];
    map[t.section].push(t);
  }
  return map;
}

export default function PrintReportPage() {
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [testResults, setTestResults] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [medtech1Id, setMedtech1Id] = useState<string>("");
  const [medtech2Id, setMedtech2Id] = useState<string>("");

  const medtech1 = MEDTECH_LIST.find((m) => m.id === medtech1Id) ?? null;
  const medtech2 = MEDTECH_LIST.find((m) => m.id === medtech2Id) ?? null;
  const medtech1Options = MEDTECH_LIST.filter((m) => m.id !== medtech2Id);
  const medtech2Options = MEDTECH_LIST.filter((m) => m.id !== medtech1Id);

  useEffect(() => {
    (async () => {
      setPatients(await fetchPatients());
      setTestResults(await fetchTestResults());
      setBillings(await fetchBilling());
    })();
  }, []);

  const now = new Date();
  const formatDate = (d: Date) =>
    `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}-${d.getFullYear()}`;
  const formatDateTime = (d: Date) =>
    `${formatDate(d)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} ${d.getHours()>=12?"PM":"AM"}`;

  const buildReportData = (patientId: string): ReportData | null => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return null;
    const patientFullName = `${patient.first_name} ${patient.last_name}`;
    const patientResults = testResults.filter((r) => r.patient_name === patientFullName);
    const patientBillings = billings.filter(
      (b) => b.patient_name === patientFullName || b.patientName === patientFullName
    );
    const allTestsPaid =
      patientResults.length > 0 &&
      patientResults.every((test) => {
        const billing = patientBillings.find(
          (b) => b.test_name === test.test_name || b.testName === test.test_name
        );
        return billing?.status === "paid";
      });

    return {
      patientId: patient.patient_id_no,
      patientName: `${patient.last_name.toUpperCase()}, ${patient.first_name.toUpperCase()}${patient.middle_name ? " " + patient.middle_name.toUpperCase() : ""}`,
      age: patient.age,
      sex: patient.sex.toUpperCase(),
      birthdate: patient.birthdate
        ? new Date(patient.birthdate).toLocaleDateString("en-US", { month:"2-digit", day:"2-digit", year:"numeric" })
        : "N/A",
      municipality: patient.municipality,
      province: patient.province,
      address: [patient.address_house_no, patient.address_street, patient.address_barangay, patient.municipality, patient.province]
        .filter(Boolean).join(", "),
      physician: "N/A",
      dateRequested: formatDateTime(now),
      dateReceived: formatDateTime(now),
      tests: patientResults.length > 0
        ? patientResults.map((r) => ({
            section: r.section || "GENERAL",
            name: r.test_name,
            result: r.result_value,
            referenceRange: r.reference_range,
            unit: r.unit,
          }))
        : [{ section: "GENERAL", name: "No test results found", result: "-", referenceRange: "-", unit: "-" }],
      billingStatus: allTestsPaid ? "paid" : "unpaid",
      dateReleased: formatDate(now),
    };
  };

  const reportContentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: reportContentRef,
    documentTitle: "CogniLab Laboratory Report",
  });

  const togglePreview = () => {
    if (!selectedPatientId) { alert("Please select a patient"); return; }
    if (showPreview) {
      setSelectedReport(null);
      setShowPreview(false);
    } else {
      setSelectedReport(buildReportData(selectedPatientId));
      setShowPreview(true);
    }
  };

  return (
    <div className="space-y-8" style={{ animation: "fadeInSlideUp 0.6s ease-out" }}>
      {/* Page Header */}
      <div style={{ animation: "fadeInSlideUp 0.6s ease-out 0.1s both" }}>
        <h1 className="text-3xl font-bold text-gray-800">CogniLab Laboratory Report Generation</h1>
        <p className="text-gray-600 text-sm mt-1">Generate and print professional laboratory reports</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Controls Panel */}
        <div className="w-full lg:w-1/3 shrink-0" style={{ animation: "fadeInSlideUp 0.6s ease-out 0.3s both" }}>
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Report Configuration</h2>

            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Patient <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => { setSelectedPatientId(e.target.value); setShowPreview(false); setSelectedReport(null); }}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white"
              >
                <option value="">-- Select a Patient --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} (ID: {p.patient_id_no})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={togglePreview}
              disabled={!selectedPatientId}
              className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 font-bold text-lg flex items-center justify-center gap-3 border border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showPreview ? "✕ Close Preview" : <><Eye className="w-6 h-6" /> Preview Report</>}
            </button>

            {/* Signature Setup */}
            {showPreview && (
              <div className="border-t pt-6 space-y-5">
                <h3 className="font-semibold text-gray-800">Signature Setup</h3>

                {/* Pathologist — fixed */}
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pathologist</p>
                  <p className="text-sm font-bold text-gray-800">{PATHOLOGIST.displayName}</p>
                  <p className="text-xs text-gray-400">{PATHOLOGIST.license}</p>
                </div>

                {/* MedTech 1 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Medical Technologist 1 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={medtech1Id}
                    onChange={(e) => setMedtech1Id(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white"
                  >
                    <option value="">-- Select MedTech 1 --</option>
                    {medtech1Options.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </select>
                </div>

                {/* MedTech 2 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Medical Technologist 2 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={medtech2Id}
                    onChange={(e) => setMedtech2Id(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white"
                  >
                    <option value="">-- Select MedTech 2 --</option>
                    {medtech2Options.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </select>
                </div>

                {/* Print Button */}
                <button
                  onClick={handlePrint}
                  disabled={!medtech1Id || !medtech2Id}
                  className="w-full px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 font-bold text-lg flex items-center justify-center gap-3 border border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-6 h-6" /> Print Report
                </button>
                {(!medtech1Id || !medtech2Id) && (
                  <p className="text-xs text-center text-amber-600 font-medium">
                    Please select both MedTechs to enable printing.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Report Preview */}
        {showPreview && selectedReport && (
          <div className="w-full lg:w-2/3" style={{ animation: "fadeInSlideRight 0.6s ease-out 0.3s both" }}>
            <div ref={reportContentRef} id="report-content" className="bg-white shadow-lg">
              <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt", color: "#000", padding: "24px 28px" }}>

                {/* ── HEADER ── */}
                <div style={{ borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    {/* Logo */}
                    <img
                      src="/images/logo.png"
                      alt="CogniLab Logo"
                      style={{ height: "56px", width: "auto", objectFit: "contain" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div>
                      <div style={{ fontSize: "18pt", fontWeight: "900", letterSpacing: "0.5px", fontFamily: "Arial, sans-serif" }}>
                        CogniLab
                      </div>
                      <div style={{ fontSize: "9pt", color: "#444", fontFamily: "Arial, sans-serif" }}>
                        KRRAX-JAM Inc · Professional Medical Testing Services
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right", fontSize: "8.5pt", fontFamily: "Arial, sans-serif" }}>
                      <div style={{ fontWeight: "bold" }}>Lab. Number: {selectedReport.patientId}</div>
                      <div>Birthdate: {selectedReport.birthdate}</div>
                      <div>Dispatch: ONLINE/PICK-UP</div>
                      <div>Page: 1 of 1</div>
                    </div>
                  </div>
                </div>

                {/* ── PATIENT INFO BLOCK ── */}
                <div style={{ borderBottom: "1px solid #aaa", paddingBottom: "8px", marginBottom: "10px", fontFamily: "Arial, sans-serif", fontSize: "9pt" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ width: "12%", color: "#555", paddingBottom: "3px" }}>Name</td>
                        <td style={{ width: "1%" }}>:</td>
                        <td style={{ width: "37%", fontWeight: "bold", paddingBottom: "3px" }}>{selectedReport.patientName}</td>
                        <td style={{ width: "12%", color: "#555", paddingBottom: "3px" }}>Lab. Number</td>
                        <td style={{ width: "1%" }}>:</td>
                        <td style={{ fontWeight: "bold", paddingBottom: "3px" }}>{selectedReport.patientId}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#555", paddingBottom: "3px" }}>Age</td>
                        <td>:</td>
                        <td style={{ paddingBottom: "3px" }}>
                          <span style={{ fontWeight: "bold" }}>{selectedReport.age}</span>
                          <span style={{ marginLeft: "16px", color: "#555" }}>Sex :</span>
                          <span style={{ fontWeight: "bold", marginLeft: "4px" }}>{selectedReport.sex}</span>
                        </td>
                        <td style={{ color: "#555", paddingBottom: "3px" }}>Birthdate</td>
                        <td>:</td>
                        <td style={{ paddingBottom: "3px" }}>{selectedReport.birthdate}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#555", paddingBottom: "3px" }}>Source</td>
                        <td>:</td>
                        <td style={{ paddingBottom: "3px", fontWeight: "bold" }}>{selectedReport.address || "N/A"}</td>
                        <td style={{ color: "#555", paddingBottom: "3px" }}>Dispatch</td>
                        <td>:</td>
                        <td style={{ paddingBottom: "3px" }}>ONLINE/PICK-UP</td>
                      </tr>
                      <tr>
                        <td style={{ color: "#555", paddingBottom: "3px" }}>Clinician</td>
                        <td>:</td>
                        <td style={{ paddingBottom: "3px" }}>{selectedReport.physician}</td>
                        <td></td><td></td><td></td>
                      </tr>
                      <tr>
                        <td style={{ color: "#555" }}>Date Requested</td>
                        <td>:</td>
                        <td>{selectedReport.dateRequested}</td>
                        <td style={{ color: "#555" }}>Received</td>
                        <td>:</td>
                        <td>{selectedReport.dateReceived}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── TEST RESULTS TABLE ── */}
                {(() => {
                  const grouped = groupTestsBySection(selectedReport.tests);
                  const hasAnyRange = selectedReport.tests.some((t) => shouldShowReferenceRange(t.name));

                  return (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif", fontSize: "9pt", marginBottom: "12px" }}>
                      {/* Column headers */}
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #000" }}>
                          <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: "bold", width: "35%" }}>TEST</th>
                          <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "bold", width: "20%" }}>
                            Result<br />
                            <span style={{ fontSize: "7.5pt", fontWeight: "normal", color: "#555" }}>Reference Interval</span>
                          </th>
                          {hasAnyRange && (
                            <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "bold", width: "10%" }}>(SI Unit)</th>
                          )}
                          <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "bold", width: "20%" }}>
                            Result<br />
                            <span style={{ fontSize: "7.5pt", fontWeight: "normal", color: "#555" }}>Reference Interval</span>
                          </th>
                          {hasAnyRange && (
                            <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "bold", width: "15%" }}>(Conv. Unit)</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(grouped).map(([section, tests]) => (
                          <>
                            {/* Section header row */}
                            <tr key={`section-${section}`}>
                              <td colSpan={hasAnyRange ? 5 : 3} style={{ paddingTop: "8px", paddingBottom: "2px", paddingLeft: "4px", fontWeight: "bold", fontSize: "9.5pt", borderBottom: "1px solid #ccc" }}>
                                {section}
                              </td>
                            </tr>

                            {/* Group label if CBC-like */}
                            {tests.some(t => ["Neutrophils","Lymphocytes","Monocytes","Eosinophils","Basophils"].includes(t.name)) && (
                              <tr key={`${section}-diff-label`}>
                                <td colSpan={hasAnyRange ? 5 : 3} style={{ paddingLeft: "12px", paddingTop: "4px", paddingBottom: "2px", fontWeight: "bold", fontSize: "9pt" }}>
                                  Differential Count
                                </td>
                              </tr>
                            )}

                            {tests.map((test, i) => {
                              const isMultiline = test.result.includes("\n");
                              const lines = test.result.split("\n");
                              const showRange = shouldShowReferenceRange(test.name);

                              if (isMultiline) {
                                return (
                                  <>
                                    <tr key={`${section}-${i}-header`}>
                                      <td colSpan={hasAnyRange ? 5 : 3} style={{ paddingLeft: "12px", paddingTop: "6px", fontWeight: "bold", fontSize: "9pt" }}>
                                        {test.name}
                                      </td>
                                    </tr>
                                    {lines.map((line, li) => {
                                      const [label, ...rest] = line.split(":");
                                      const val = rest.join(":").trim();
                                      // Try to find a matching reference range for this sub-field
                                      const subRef = (TEST_REFERENCE_RANGES_FLAT as Record<string, { min?: number; max?: number; unit?: string }>)[label.trim()];
                                      const subRangeStr = subRef
                                        ? (subRef.min !== undefined && subRef.max !== undefined
                                            ? `${subRef.min} - ${subRef.max}`
                                            : subRef.min !== undefined
                                            ? `> ${subRef.min}`
                                            : subRef.max !== undefined
                                            ? `< ${subRef.max}`
                                            : "")
                                        : "";
                                      const subAbnormal = subRangeStr ? getAbnormalStatus(val, subRangeStr) : null;
                                      const subColor = subAbnormal === "high" ? "#dc2626" : subAbnormal === "low" ? "#2563eb" : "inherit";
                                      return (
                                        <tr key={`${section}-${i}-${li}`} style={{ borderBottom: li === lines.length - 1 ? "1px solid #eee" : "none" }}>
                                          <td style={{ paddingLeft: "20px", paddingTop: "2px", paddingBottom: "2px", color: "#333" }}>{label}</td>
                                          <td style={{ textAlign: "center", fontWeight: "600", paddingTop: "2px", paddingBottom: "2px", color: subColor }}>
                                            {val}<AbnormalIndicator status={subAbnormal} forPrint />
                                          </td>
                                          {hasAnyRange && <td></td>}
                                          <td style={{ textAlign: "center", paddingTop: "2px", paddingBottom: "2px", color: subColor }}>
                                            {val}<AbnormalIndicator status={subAbnormal} forPrint />
                                          </td>
                                          {hasAnyRange && <td></td>}
                                        </tr>
                                      );
                                    })}
                                  </>
                                );
                              }

                              {
                                const abnormal = showRange ? getAbnormalStatus(test.result, test.referenceRange) : null;
                                const resultColor = abnormal === "high" ? "#dc2626" : abnormal === "low" ? "#2563eb" : "inherit";
                                return (
                                  <tr key={`${section}-${i}`} style={{ borderBottom: "1px solid #eee" }}>
                                    <td style={{ paddingLeft: "12px", paddingTop: "3px", paddingBottom: "3px" }}>{test.name}</td>
                                    <td style={{ textAlign: "center", fontWeight: "700", paddingTop: "3px", paddingBottom: "3px", color: resultColor }}>
                                      {test.result}
                                      <AbnormalIndicator status={abnormal} forPrint />
                                      {showRange && test.referenceRange && (
                                        <div style={{ fontSize: "7.5pt", fontWeight: "normal", color: "#666" }}>{test.referenceRange}</div>
                                      )}
                                    </td>
                                    {hasAnyRange && (
                                      <td style={{ textAlign: "center", color: "#555", paddingTop: "3px", paddingBottom: "3px" }}>
                                        {showRange ? test.unit : ""}
                                      </td>
                                    )}
                                    <td style={{ textAlign: "center", fontWeight: "700", paddingTop: "3px", paddingBottom: "3px", color: resultColor }}>
                                      {test.result}
                                      <AbnormalIndicator status={abnormal} forPrint />
                                      {showRange && test.referenceRange && (
                                        <div style={{ fontSize: "7.5pt", fontWeight: "normal", color: "#666" }}>{test.referenceRange}</div>
                                      )}
                                    </td>
                                    {hasAnyRange && (
                                      <td style={{ textAlign: "center", color: "#555", paddingTop: "3px", paddingBottom: "3px" }}>
                                        {showRange ? test.unit : ""}
                                      </td>
                                    )}
                                  </tr>
                                );
                              }
                            })}
                          </>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}

                {/* ── LEGEND (only if numeric tests present) ── */}
                {selectedReport.tests.some((t) => shouldShowReferenceRange(t.name)) && (
                  <div style={{ borderTop: "1.5px solid #000", paddingTop: "6px", marginBottom: "12px", fontFamily: "Arial, sans-serif", fontSize: "8pt", display: "flex", gap: "24px" }}>
                    <span><strong>LEGEND:</strong></span>
                    <span>↑ - High</span>
                    <span>↑↑ - Alert Value High</span>
                    <span>↓ - Low</span>
                    <span>↓↓ - Alert Value Low</span>
                  </div>
                )}

                {/* ── BILLING STATUS (screen only) ── */}
                <div className="print:hidden" style={{ marginBottom: "12px", fontFamily: "Arial, sans-serif", fontSize: "9pt", background: selectedReport.billingStatus === "paid" ? "#f0fdf4" : "#fef9c3", border: `1px solid ${selectedReport.billingStatus === "paid" ? "#86efac" : "#fde047"}`, borderRadius: "6px", padding: "8px 14px" }}>
                  <strong>Payment Status:</strong>{" "}
                  <span style={{ fontWeight: "bold", color: selectedReport.billingStatus === "paid" ? "#16a34a" : "#b45309" }}>
                    {selectedReport.billingStatus === "paid" ? "✓ PAID" : "✗ UNPAID"}
                  </span>
                </div>

                {/* ── SIGNATURE SECTION ── */}
                <div style={{ borderTop: "1.5px solid #000", paddingTop: "8px", fontFamily: "Arial, sans-serif" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
                    {/* Pathologist */}
                   
                    {/* MedTech 1 */}
                    <SignatureBlock
                      name={medtech1?.displayName ?? ""}
                      license={medtech1?.license ?? ""}
                      role="REGISTERED MEDICAL TECHNOLOGIST"
                      signatureFile={medtech1?.signatureFile}
                      placeholder={!medtech1}
                    />
                    {/* MedTech 2 */}
                    <SignatureBlock
                      name={medtech2?.displayName ?? ""}
                      license={medtech2?.license ?? ""}
                      role="REGISTERED MEDICAL TECHNOLOGIST"
                      signatureFile={medtech2?.signatureFile}
                      placeholder={!medtech2}
                    />
                     <SignatureBlock
                      name={PATHOLOGIST.displayName}
                      license={PATHOLOGIST.license}
                      role="PATHOLOGIST"
                      signatureFile={PATHOLOGIST.signatureFile}
                    />
                  </div>

                  {/* Bottom bar like Hi-Precision */}
                  <div style={{ borderTop: "1.5px solid #000", marginTop: "6px", paddingTop: "4px", display: "flex", justifyContent: "space-between", fontSize: "7.5pt", color: "#444" }}>
                    <span>REGISTERED MEDICAL TECHNOLOGIST</span>
                    <span style={{ fontStyle: "italic" }}>** Report Electronically Signed Out **</span>
                    <span>PATHOLOGIST</span>
                  </div>
                </div>

                {/* ── FOOTER ── */}
                <div style={{ borderTop: "1px solid #ccc", marginTop: "10px", paddingTop: "6px", textAlign: "center", fontFamily: "Arial, sans-serif", fontSize: "7.5pt", color: "#666" }}>
                  This report is confidential and intended solely for the use of the addressed recipient. Unauthorized access, distribution, or copying is strictly prohibited.
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      {!showPreview && (
        <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg" style={{ animation: "fadeInSlideUp 0.6s ease-out 0.4s both" }}>
          <h3 className="font-semibold text-[#3B6255] mb-2">📋 Report Features</h3>
          <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
            <li>Hi-Precision style professional layout with logo header</li>
            <li>Patient information with lab number, birthdate, dispatch info</li>
            <li>Tests grouped by section with dual SI/Conv. unit columns</li>
            <li>Multiline results (CBC, UA, etc.) displayed line-by-line</li>
            <li>Legend bar for abnormal value indicators</li>
            <li>Three-column signature area (Pathologist, RMT, QC)</li>
            <li>Print-optimized — billing status hidden on print</li>
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
          #report-content { box-shadow: none !important; border-radius: 0 !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Signature Block ──────────────────────────────────────────────────────────

interface SignatureBlockProps {
  name: string;
  license: string;
  role: string;
  signatureFile?: string;
  placeholder?: boolean;
}

function SignatureBlock({ name, license, role, signatureFile, placeholder = false }: SignatureBlockProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [signatureFile]);

  return (
    <div style={{ textAlign: "center", fontSize: "8.5pt", fontFamily: "Arial, sans-serif" }}>
      {/* Signature image */}
      <div style={{ height: "52px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        {placeholder ? (
          <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "8pt" }}>No selection</span>
        ) : signatureFile && !imgError ? (
          <img
            src={`/signatures/${signatureFile}`}
            alt={`Signature of ${name}`}
            style={{ maxHeight: "52px", maxWidth: "100%", objectFit: "contain" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "8pt" }}>Signature pending</span>
        )}
      </div>
      {/* Divider line */}
      <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}></div>
      {/* Name */}
      <div style={{ fontWeight: "bold", fontSize: "8.5pt" }}>{name || "—"}</div>
      {/* License */}
      <div style={{ color: "#555", fontSize: "7.5pt" }}>{license}</div>
      {/* Role */}
      <div style={{ fontWeight: "bold", fontSize: "7.5pt", marginTop: "2px", textTransform: "uppercase" }}>{role}</div>
    </div>
  );
}