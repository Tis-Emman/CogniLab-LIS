"use client";

import { useState, useRef, useEffect } from "react";
import { Eye, Printer, FlaskConical, CheckSquare, Square } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { fetchTestResults, fetchPatients, fetchBilling } from "@/lib/database";
import { supabase } from "@/lib/supabaseClient";

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

function getAbnormalStatus(
  resultValue: string,
  referenceRange: string
): "high" | "low" | "normal" | null {
  const num = parseFloat(resultValue);
  if (isNaN(num) || !referenceRange) return null;
  const ltMatch = referenceRange.match(/^[<≤]\s*([\d.]+)/);
  const gtMatch = referenceRange.match(/^[>≥]\s*([\d.]+)/);
  const rangeMatch = referenceRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (ltMatch) { const max = parseFloat(ltMatch[1]); return num > max ? "high" : "normal"; }
  if (gtMatch) { const min = parseFloat(gtMatch[1]); return num < min ? "low" : "normal"; }
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (num < min) return "low";
    if (num > max) return "high";
    return "normal";
  }
  return null;
}

function AbnormalIndicator({ status, forPrint = false }: { status: "high" | "low" | "normal" | null; forPrint?: boolean }) {
  if (!status || status === "normal") return null;
  const isHigh = status === "high";
  return (
    <span style={{ color: isHigh ? "#dc2626" : "#2563eb", fontWeight: "bold", fontSize: forPrint ? "9pt" : "11pt", marginLeft: "4px", display: "inline-block" }}>
      {isHigh ? "↑" : "↓"}
    </span>
  );
}

const TEST_REFERENCE_RANGES_FLAT: Record<string, { min?: number; max?: number; unit?: string }> = {
  // CBC differential
  "Neutrophils":          { min: 45,   max: 75,   unit: "%"        },
  "Lymphocytes":          { min: 16,   max: 46,   unit: "%"        },
  "Monocytes":            { min: 4,    max: 11,   unit: "%"        },
  "Eosinophils":          { min: 0,    max: 8,    unit: "%"        },
  "Basophils":            { min: 0,    max: 3,    unit: "%"        },
  // RBC Indices
  "MCV":                  { min: 80,   max: 100,  unit: "fL"       },
  "MCH":                  { min: 27,   max: 31,   unit: "pg"       },
  "RDW":                  { min: 11.5, max: 14.5, unit: "%"        },
  // CBC extras
  "Hemoglobin (Male)":    { min: 14.0, max: 17.0, unit: "g/dL"    },
  "Hemoglobin (Female)":  { min: 12.0, max: 15.0, unit: "g/dL"    },
  "Hematocrit (Male)":    { min: 40,   max: 54,   unit: "%"        },
  "Hematocrit (Female)":  { min: 37,   max: 47,   unit: "%"        },
  "Platelet Count":       { min: 150,  max: 450,  unit: "x10^9/L" },
  "Peripheral Blood Smear": {                     unit: ""         },
  // PT/INR/PTT
  "PT":                   { min: 11.0, max: 13.5, unit: "seconds"  },
  "INR":                  { min: 0.8,  max: 1.2,  unit: ""         },
  "aPTT":                 { min: 25.0, max: 35.0, unit: "seconds"  },
  // ESR
  "ESR (Male)":           { min: 0,    max: 15,   unit: "mm/hr"   },
  "ESR (Female)":         { min: 0,    max: 15,   unit: "mm/hr"   },
  "ESR":                  { min: 0,    max: 15,   unit: "mm/hr"   },
  // Urinalysis
  "pH":                   { min: 4.5,  max: 8.0,  unit: ""         },
  "Urobilinogen":         { min: 0.2,  max: 1.0,  unit: ""         },
  "WBC":                  { min: 0,    max: 5,    unit: "/hpf"     },
  "RBC":                  { min: 0,    max: 2,    unit: "/hpf"     },
  // ABG
  "pCO2":                 { min: 35,   max: 45,   unit: "mm Hg"   },
  "PO2":                  { min: 80,   max: 100,  unit: "mm Hg"   },
  "SaO2":                 { min: 90,              unit: "%"        },
  "HCO3":                 { min: 22,   max: 26,   unit: "mEq/L"   },
  // Electrolytes
  "Na+":                  { min: 135,  max: 145,  unit: "mmol/L"  },
  "K+":                   { min: 3.4,  max: 5.0,  unit: "mmol/L"  },
  "Cl-":                  { min: 95,   max: 108,  unit: "mmol/L"  },
  "Bicarbonate":          { min: 20,   max: 32,   unit: "mmol/L"  },
  "Ca++":                 { min: 8.5,  max: 10.5, unit: "mg/dL"   },
  "Phosphorus":           { min: 3.0,  max: 4.5,  unit: "mmol/L"  },
  "Mg++":                 { min: 1.8,  max: 3.0,  unit: "mg/dL"   },
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

// ── Status badge for the checklist ──────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approved:         { bg: "bg-purple-100", text: "text-purple-700", label: "Approved" },
  released:         { bg: "bg-green-100",  text: "text-green-700",  label: "Released"  },
  for_verification: { bg: "bg-orange-100", text: "text-orange-700", label: "For Verification" },
  encoding:         { bg: "bg-blue-100",   text: "text-blue-700",   label: "Encoding"  },
  pending:          { bg: "bg-gray-100",   text: "text-gray-600",   label: "Pending"   },
};

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
  const [qualityChecks, setQualityChecks] = useState<any[]>([]);
  const [medtech1Id, setMedtech1Id] = useState<string>("");
  const [medtech2Id, setMedtech2Id] = useState<string>("");
  const [patientSearch, setPatientSearch] = useState<string>("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // ── Selective release state ──────────────────────────────────────────────
  // patientResults: all approved/released results for the selected patient
  const [patientResults, setPatientResults] = useState<any[]>([]);
  // selectedResultIds: set of result IDs the staff has ticked to include
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());

  const medtech1 = MEDTECH_LIST.find((m) => m.id === medtech1Id) ?? null;
  const medtech2 = MEDTECH_LIST.find((m) => m.id === medtech2Id) ?? null;
  const medtech1Options = MEDTECH_LIST.filter((m) => m.id !== medtech2Id);
  const medtech2Options = MEDTECH_LIST.filter((m) => m.id !== medtech1Id);

  useEffect(() => {
    (async () => {
      setPatients(await fetchPatients());
      setTestResults(await fetchTestResults());
      setBillings(await fetchBilling());
      const { data: qcData } = await supabase.from("quality_checks").select("*");
      setQualityChecks(qcData || []);
    })();
  }, []);

  // When a patient is selected, populate their approved/released results for the checklist
  useEffect(() => {
    if (!selectedPatientId) {
      setPatientResults([]);
      setSelectedResultIds(new Set());
      return;
    }
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return;
    const fullName = `${patient.first_name} ${patient.last_name}`;
    const eligible = testResults.filter(
      (r) => r.patient_name === fullName && (r.status === "approved" || r.status === "released")
    );
    setPatientResults(eligible);
    // Default: select all eligible results
    setSelectedResultIds(new Set(eligible.map((r: any) => r.id)));
    setShowPreview(false);
    setSelectedReport(null);
  }, [selectedPatientId, testResults, patients]);

  const now = new Date();
  const formatDate = (d: Date) =>
    `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}-${d.getFullYear()}`;
  const formatDateTime = (d: Date) =>
    `${formatDate(d)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} ${d.getHours()>=12?"PM":"AM"}`;

  // Build report using only the staff-selected results
  const buildReportData = (patientId: string): ReportData | null => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return null;
    const patientFullName = `${patient.first_name} ${patient.last_name}`;

    // Only include results the staff selected
    const chosenResults = patientResults.filter((r) => selectedResultIds.has(r.id));

    const patientBillings = billings.filter(
      (b) => b.patient_name === patientFullName || b.patientName === patientFullName
    );
    const allTestsPaid =
      chosenResults.length > 0 &&
      chosenResults.every((test) => {
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
      tests: chosenResults.length > 0
        ? chosenResults.map((r) => ({
            section: r.section || "GENERAL",
            name: r.test_name,
            result: r.result_value,
            referenceRange: r.reference_range,
            unit: r.unit,
          }))
        : [{ section: "GENERAL", name: "No test results selected", result: "-", referenceRange: "-", unit: "-" }],
      billingStatus: allTestsPaid ? "paid" : "unpaid",
      dateReleased: formatDate(now),
    };
  };

  const reportContentRef = useRef<HTMLDivElement>(null);

  const getPatientQCStatus = (patientId: string): "eligible" | "pending" | "failed" | "no_results" => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return "no_results";
    const fullName = `${patient.first_name} ${patient.last_name}`;
    const patientTestResults = testResults.filter((r) => r.patient_name === fullName);
    if (patientTestResults.length === 0) return "no_results";
    const qcMap: Record<string, string> = {};
    for (const qc of qualityChecks) { qcMap[qc.test_result_id] = qc.qc_result; }
    let hasFail = false, hasPending = false;
    for (const r of patientTestResults) {
      const qcResult = qcMap[r.id];
      if (!qcResult) { hasPending = true; }
      else if (qcResult === "fail") { hasFail = true; }
    }
    if (hasFail) return "failed";
    if (hasPending) return "pending";
    return "eligible";
  };

  const selectedQCStatus = selectedPatientId ? getPatientQCStatus(selectedPatientId) : null;

  // ── Payment check: are ALL selected results paid? ────────────────────────
  const selectedUnpaidTests = (() => {
    if (!selectedPatientId || selectedResultIds.size === 0) return [];
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return [];
    const fullName = `${patient.first_name} ${patient.last_name}`;
    const patientBillings = billings.filter(
      (b) => b.patient_name === fullName || b.patientName === fullName
    );
    return patientResults
      .filter((r) => selectedResultIds.has(r.id))
      .filter((r) => {
        const billing = patientBillings.find(
          (b) => b.test_name === r.test_name || b.testName === r.test_name
        );
        return !billing || billing.status !== "paid";
      });
  })();
  const hasUnpaid = selectedUnpaidTests.length > 0;

  const handlePrint = useReactToPrint({
    contentRef: reportContentRef,
    documentTitle: "CogniLab Laboratory Report",
  });

  const togglePreview = () => {
    if (!selectedPatientId) { alert("Please select a patient"); return; }
    if (selectedResultIds.size === 0) { alert("Please select at least one test result to include in the report."); return; }
    if (showPreview) {
      setSelectedReport(null);
      setShowPreview(false);
    } else {
      setSelectedReport(buildReportData(selectedPatientId));
      setShowPreview(true);
    }
  };

  // Toggle a single result
  const toggleResult = (id: string) => {
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setShowPreview(false);
    setSelectedReport(null);
  };

  // Select / deselect all
  const toggleAll = () => {
    if (selectedResultIds.size === patientResults.length) {
      setSelectedResultIds(new Set());
    } else {
      setSelectedResultIds(new Set(patientResults.map((r) => r.id)));
    }
    setShowPreview(false);
    setSelectedReport(null);
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
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search patient name or ID..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                    setSelectedPatientId("");
                    setShowPreview(false);
                    setSelectedReport(null);
                    setPatientResults([]);
                    setSelectedResultIds(new Set());
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white"
                />
                {showPatientDropdown && patientSearch && (
                  <div className="absolute z-10 w-full bg-white border-2 border-gray-300 rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto">
                    {(() => {
                      const searchLower = patientSearch.toLowerCase();
                      const matched = patients.filter((p) =>
                        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchLower) ||
                        p.patient_id_no?.toLowerCase().includes(searchLower)
                      );
                      const eligible = matched.filter((p) => getPatientQCStatus(p.id) === "eligible");
                      const blocked  = matched.filter((p) => getPatientQCStatus(p.id) !== "eligible");
                      return (
                        <>
                          {eligible.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedPatientId(p.id);
                                setPatientSearch(`${p.first_name} ${p.last_name}`);
                                setShowPatientDropdown(false);
                              }}
                              className="px-4 py-2.5 hover:bg-[#F0F4F1] cursor-pointer border-b border-gray-50 last:border-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-800 text-sm">{p.first_name} {p.last_name}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ QC Passed</span>
                              </div>
                              <span className="text-gray-400 text-xs">{p.patient_id_no}</span>
                            </div>
                          ))}
                          {blocked.length > 0 && (
                            <>
                              {eligible.length > 0 && (
                                <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Not yet QC approved</p>
                                </div>
                              )}
                              {blocked.map((p) => {
                                const status = getPatientQCStatus(p.id);
                                return (
                                  <div key={p.id} className="px-4 py-2.5 bg-gray-50 cursor-not-allowed border-b border-gray-100 last:border-0 opacity-60">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-gray-500 text-sm">{p.first_name} {p.last_name}</span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === "failed" ? "bg-red-100 text-red-600" : status === "pending" ? "bg-yellow-100 text-yellow-600" : "bg-gray-100 text-gray-500"}`}>
                                        {status === "failed" ? "✕ QC Failed" : status === "pending" ? "⏳ QC Pending" : "No Results"}
                                      </span>
                                    </div>
                                    <span className="text-gray-400 text-xs">{p.patient_id_no}</span>
                                  </div>
                                );
                              })}
                            </>
                          )}
                          {matched.length === 0 && (
                            <div className="px-4 py-3 text-gray-400 text-sm">No patients found</div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {selectedPatientId && selectedQCStatus !== "eligible" && (
                <div className={`mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs font-medium ${selectedQCStatus === "failed" ? "bg-red-50 border border-red-200 text-red-700" : selectedQCStatus === "pending" ? "bg-yellow-50 border border-yellow-200 text-yellow-700" : "bg-gray-50 border border-gray-200 text-gray-500"}`}>
                  {selectedQCStatus === "failed" ? "⛔ This patient has failed QC checks. Results must be corrected and re-checked before a report can be generated." : selectedQCStatus === "pending" ? "⏳ This patient's test results have not been fully reviewed in Quality Checking yet." : "ℹ️ No test results found for this patient."}
                </div>
              )}
            </div>

            {/* ── SELECT RESULTS TO RELEASE ────────────────────────────────── */}
            {selectedPatientId && selectedQCStatus === "eligible" && patientResults.length > 0 && (
              <div className="border border-[#CBDED3] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="bg-[#F0F4F1] px-4 py-3 flex items-center justify-between border-b border-[#CBDED3]">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-[#3B6255]" />
                    <span className="text-sm font-bold text-gray-700">Select Results to Release</span>
                  </div>
                  <button
                    onClick={toggleAll}
                    className="text-xs font-semibold text-[#3B6255] hover:underline flex items-center gap-1"
                  >
                    {selectedResultIds.size === patientResults.length ? (
                      <><CheckSquare className="w-3.5 h-3.5" /> Deselect All</>
                    ) : (
                      <><Square className="w-3.5 h-3.5" /> Select All</>
                    )}
                  </button>
                </div>

                {/* Result checklist */}
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {patientResults.map((r) => {
                    const isChecked = selectedResultIds.has(r.id);
                    const statusStyle = STATUS_STYLES[r.status] ?? STATUS_STYLES["pending"];
                    return (
                      <label
                        key={r.id}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition ${isChecked ? "bg-white" : "bg-gray-50 opacity-60"} hover:bg-[#F0F4F1]`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleResult(r.id)}
                          className="mt-0.5 w-4 h-4 accent-[#3B6255] rounded cursor-pointer flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-800 truncate">{r.test_name}</span>
                            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                              {statusStyle.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{r.section}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Footer count */}
                <div className="bg-[#F0F4F1] px-4 py-2 border-t border-[#CBDED3]">
                  <p className="text-xs text-[#3B6255] font-medium">
                    {selectedResultIds.size} of {patientResults.length} result{patientResults.length !== 1 ? "s" : ""} selected for this report
                  </p>
                </div>
              </div>
            )}

            {/* No eligible results message */}
            {selectedPatientId && selectedQCStatus === "eligible" && patientResults.length === 0 && (
              <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No approved or released results found for this patient.</p>
              </div>
            )}

            {/* Preview Button */}
            <button
              onClick={togglePreview}
              disabled={!selectedPatientId || selectedQCStatus !== "eligible" || selectedResultIds.size === 0 || hasUnpaid}
              className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 font-bold text-lg flex items-center justify-center gap-3 border border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {showPreview ? "✕ Close Preview" : <><Eye className="w-6 h-6" /> Preview Report</>}
            </button>

            {selectedPatientId && selectedQCStatus === "eligible" && selectedResultIds.size === 0 && (
              <p className="text-xs text-center text-amber-600 font-medium -mt-3">
                Please select at least one result to preview.
              </p>
            )}

            {selectedPatientId && selectedQCStatus === "eligible" && selectedResultIds.size > 0 && hasUnpaid && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 -mt-3">
                <p className="text-xs font-bold text-red-700 mb-1">⛔ Cannot generate report — unpaid balance</p>
                <p className="text-xs text-red-600 mb-1">The following selected test(s) are not yet paid:</p>
                <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                  {selectedUnpaidTests.map((r: any) => (
                    <li key={r.id}>{r.test_name} <span className="text-red-400">({r.section})</span></li>
                  ))}
                </ul>
                <p className="text-xs text-red-500 mt-1">Please settle the balance in Billing before releasing.</p>
              </div>
            )}

            {/* Signature Setup */}
            {showPreview && (
              <div className="border-t pt-6 space-y-5">
                <h3 className="font-semibold text-gray-800">Signature Setup</h3>

                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pathologist</p>
                  <p className="text-sm font-bold text-gray-800">{PATHOLOGIST.displayName}</p>
                  <p className="text-xs text-gray-400">{PATHOLOGIST.license}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Medical Technologist 1 <span className="text-red-500">*</span>
                  </label>
                  <select value={medtech1Id} onChange={(e) => setMedtech1Id(e.target.value)} className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white">
                    <option value="">-- Select MedTech 1 --</option>
                    {medtech1Options.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Medical Technologist 2 <span className="text-red-500">*</span>
                  </label>
                  <select value={medtech2Id} onChange={(e) => setMedtech2Id(e.target.value)} className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 font-medium bg-white">
                    <option value="">-- Select MedTech 2 --</option>
                    {medtech2Options.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                  </select>
                </div>

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
                    <img src="/images/logo.png" alt="CogniLab Logo" style={{ height: "56px", width: "auto", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div>
                      <div style={{ fontSize: "18pt", fontWeight: "900", letterSpacing: "0.5px", fontFamily: "Arial, sans-serif" }}>CogniLab</div>
                      <div style={{ fontSize: "9pt", color: "#444", fontFamily: "Arial, sans-serif" }}>KRRAX-JAM Inc · Professional Medical Testing Services</div>
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

                {/* ── TEST RESULTS TABLE (4-column: Test Name | Result | Normal Range | Units) ── */}
                {(() => {
                  const grouped = groupTestsBySection(selectedReport.tests);

                  interface FlatRow {
                    label: string;
                    result: string;
                    referenceRange: string;
                    unit: string;
                    isGroupHeader?: boolean;
                    indent?: boolean;
                  }

                  const buildRows = (): { section: string; rows: FlatRow[] }[] => {
                    return Object.entries(grouped).map(([section, tests]) => {
                      const rows: FlatRow[] = [];
                      for (const test of tests) {
                        const isMultiline = test.result.includes("\n");
                        if (isMultiline) {
                          rows.push({ label: test.name, result: "", referenceRange: "", unit: "", isGroupHeader: true });
                          const lines = test.result.split("\n");
                          for (const line of lines) {
                            const colonIdx = line.indexOf(":");
                            if (colonIdx === -1) { rows.push({ label: line, result: "", referenceRange: "", unit: "", indent: true }); continue; }
                            const subLabel = line.slice(0, colonIdx).trim();
                            const val = line.slice(colonIdx + 1).trim();
                            const subRef = (TEST_REFERENCE_RANGES_FLAT as any)[subLabel];
                            const subRangeStr = subRef
                              ? subRef.min !== undefined && subRef.max !== undefined
                                ? `${subRef.min} – ${subRef.max}`
                                : subRef.min !== undefined ? `> ${subRef.min}` : subRef.max !== undefined ? `< ${subRef.max}` : ""
                              : "";
                            const subUnit = subRef?.unit ?? test.unit ?? "";
                            rows.push({ label: subLabel, result: val, referenceRange: subRangeStr, unit: subUnit, indent: true });
                          }
                        } else {
                          rows.push({ label: test.name, result: test.result, referenceRange: test.referenceRange || "", unit: test.unit || "" });
                        }
                      }
                      return { section, rows };
                    });
                  };

                  const allSections = buildRows();

                  return (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif", fontSize: "9.5pt", marginBottom: "12px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #000", borderTop: "1.5px solid #000" }}>
                          <th style={{ textAlign: "left",   padding: "5px 8px", fontWeight: "bold", width: "40%" }}>Test Name</th>
                          <th style={{ textAlign: "center", padding: "5px 8px", fontWeight: "bold", width: "15%" }}>Result</th>
                          <th style={{ textAlign: "center", padding: "5px 8px", fontWeight: "bold", width: "30%" }}>Normal Range</th>
                          <th style={{ textAlign: "center", padding: "5px 8px", fontWeight: "bold", width: "15%" }}>Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSections.map(({ section, rows }) => (
                          <>
                            <tr key={`sec-${section}`}>
                              <td colSpan={4} style={{ paddingTop: "10px", paddingBottom: "3px", paddingLeft: "6px", fontWeight: "bold", fontSize: "9.5pt", borderBottom: "1px solid #bbb", color: "#222" }}>
                                {section}
                              </td>
                            </tr>
                            {rows.map((row, ri) => {
                              if (row.isGroupHeader) {
                                return (
                                  <tr key={`gh-${ri}`}>
                                    <td colSpan={4} style={{ paddingLeft: "10px", paddingTop: "6px", paddingBottom: "2px", fontWeight: "bold", fontSize: "9pt", color: "#333" }}>
                                      {row.label}
                                    </td>
                                  </tr>
                                );
                              }
                              const abnormal = row.result && row.referenceRange
                                ? getAbnormalStatus(row.result, row.referenceRange)
                                : null;
                              const isHigh = abnormal === "high";
                              const isLow  = abnormal === "low";
                              const resultColor = isHigh ? "#dc2626" : isLow ? "#2563eb" : "inherit";
                              const arrow = isHigh ? " ↑" : isLow ? " ↓" : "";
                              return (
                                <tr key={`row-${ri}`} style={{ borderBottom: "1px solid #e8e8e8" }}>
                                  <td style={{ paddingLeft: row.indent ? "20px" : "10px", paddingTop: "4px", paddingBottom: "4px" }}>
                                    {row.label}
                                  </td>
                                  <td style={{ textAlign: "center", paddingTop: "4px", paddingBottom: "4px", fontWeight: (isHigh || isLow) ? "700" : "normal", color: resultColor }}>
                                    {row.result}{arrow}
                                  </td>
                                  <td style={{ textAlign: "center", paddingTop: "4px", paddingBottom: "4px", color: "#333" }}>
                                    {row.referenceRange || ""}
                                  </td>
                                  <td style={{ textAlign: "center", paddingTop: "4px", paddingBottom: "4px", color: "#555" }}>
                                    {row.unit || ""}
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}

                {/* ── LEGEND ── */}
                {selectedReport.tests.some((t) => shouldShowReferenceRange(t.name)) && (
                  <div style={{ borderTop: "1.5px solid #000", paddingTop: "6px", marginBottom: "12px", fontFamily: "Arial, sans-serif", fontSize: "8pt", display: "flex", gap: "24px" }}>
                    <span><strong>LEGEND:</strong></span>
                    <span>↑ - High</span>
                    <span>↑↑ - Alert Value High</span>
                    <span>↓ - Low</span>
                    <span>↓↓ - Alert Value Low</span>
                  </div>
                )}



                {/* ── SIGNATURE SECTION ── */}
                <div style={{ borderTop: "1.5px solid #000", paddingTop: "8px", fontFamily: "Arial, sans-serif" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
                    <SignatureBlock name={medtech1?.displayName ?? ""} license={medtech1?.license ?? ""} role="REGISTERED MEDICAL TECHNOLOGIST" signatureFile={medtech1?.signatureFile} placeholder={!medtech1} />
                    <SignatureBlock name={medtech2?.displayName ?? ""} license={medtech2?.license ?? ""} role="REGISTERED MEDICAL TECHNOLOGIST" signatureFile={medtech2?.signatureFile} placeholder={!medtech2} />
                    <SignatureBlock name={PATHOLOGIST.displayName} license={PATHOLOGIST.license} role="PATHOLOGIST" signatureFile={PATHOLOGIST.signatureFile} />
                  </div>
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
            <li>Select a patient → choose which specific results to include in the release</li>
            <li>Only Approved or Released results are available for selection</li>
            <li>Hi-Precision style professional layout with logo header</li>
            <li>Tests grouped by section with dual SI/Conv. unit columns</li>
            <li>Multiline results (CBC, UA, etc.) displayed line-by-line</li>
            <li>Three-column signature area (MedTech 1, MedTech 2, Pathologist)</li>
            <li>Print-optimized — billing status hidden on print</li>
          </ul>
        </div>
      )}

      <style>{`
        @keyframes fadeInSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInSlideLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInSlideRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @media print {
          body { margin: 0; padding: 0; }
          #report-content { box-shadow: none !important; border-radius: 0 !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

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
      <div style={{ height: "52px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        {placeholder ? (
          <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "8pt" }}>No selection</span>
        ) : signatureFile && !imgError ? (
          <img src={`/signatures/${signatureFile}`} alt={`Signature of ${name}`} style={{ maxHeight: "52px", maxWidth: "100%", objectFit: "contain" }} onError={() => setImgError(true)} />
        ) : (
          <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "8pt" }}>Signature pending</span>
        )}
      </div>
      <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}></div>
      <div style={{ fontWeight: "bold", fontSize: "8.5pt" }}>{name || "—"}</div>
      <div style={{ color: "#555", fontSize: "7.5pt" }}>{license}</div>
      <div style={{ fontWeight: "bold", fontSize: "7.5pt", marginTop: "2px", textTransform: "uppercase" }}>{role}</div>
    </div>
  );
}