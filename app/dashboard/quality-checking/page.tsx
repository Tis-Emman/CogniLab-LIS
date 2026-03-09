"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ShieldX,
  Search,
  Loader,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ClipboardCheck,
  AlertTriangle,
  User,
  Calendar,
  MessageSquare,
  ArrowRight,
  Trash2,
  User2,
  FileText,
  X,
  Phone,
  MapPin,
  Stethoscope,
  FlaskConical,
} from "lucide-react";
import { fetchTestResults, fetchPatients } from "@/lib/database";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { logActivity } from "@/lib/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  patient_name: string;
  section: string;
  test_name: string;
  result_value: string;
  reference_range: string;
  unit: string;
  status: string;
  date_created: string;
}

interface QualityCheck {
  id: string;
  test_result_id: string;
  patient_name: string;
  test_name: string;
  section: string;
  result_value: string;
  reference_range: string;
  unit: string;
  qc_result: "pass" | "fail";
  checked_by: string;
  comments: string;
  checked_at: string;
  created_at: string;
}

// ─── Mock store ───────────────────────────────────────────────────────────────

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
let MOCK_QC_CHECKS: QualityCheck[] = [];

// ─── DB helpers ───────────────────────────────────────────────────────────────

const fetchQualityChecks = async (): Promise<QualityCheck[]> => {
  if (USE_MOCK_DATA) return [...MOCK_QC_CHECKS].reverse();
  const { data, error } = await supabase
    .from("quality_checks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("Error fetching quality checks:", error); return []; }
  return data || [];
};

const addQualityCheck = async (
  payload: Omit<QualityCheck, "id" | "created_at">,
  currentUser?: any
): Promise<QualityCheck | null> => {
  if (USE_MOCK_DATA) {
    const newQc: QualityCheck = {
      id: `qc-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    };
    MOCK_QC_CHECKS.push(newQc);
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || "Unknown User",
      encryption_key: currentUser?.encryption_key || "",
      action: "edit",
      resource: `QC - ${payload.test_name} - ${payload.patient_name}`,
      resource_type: "Quality Check",
      description: `Quality check ${payload.qc_result.toUpperCase()} for ${payload.test_name} (${payload.patient_name}) by ${payload.checked_by}`,
    });
    return newQc;
  }
  const { data, error } = await supabase
    .from("quality_checks")
    .insert([payload])
    .select();
  if (error) { console.error("Error adding quality check:", error); return null; }
  if (data?.[0]) {
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || "Unknown User",
      encryption_key: currentUser?.encryption_key || "",
      action: "edit",
      resource: `QC - ${payload.test_name} - ${payload.patient_name}`,
      resource_type: "Quality Check",
      description: `Quality check ${payload.qc_result.toUpperCase()} for ${payload.test_name} (${payload.patient_name}) by ${payload.checked_by}`,
    });
  }
  return data?.[0] || null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toLocalDatetimeValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });

// ─── QC Checklist items ───────────────────────────────────────────────────────


// ─── Report-style helpers for QC preview ─────────────────────────────────────

function getAbnormalStatusQC(val: string, ref: string): "high" | "low" | "normal" | null {
  const num = parseFloat(val);
  if (isNaN(num) || !ref) return null;
  const ltMatch = ref.match(/^[<≤]\s*([\d.]+)/);
  const gtMatch = ref.match(/^[>≥]\s*([\d.]+)/);
  const rangeMatch = ref.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (ltMatch) { const max = parseFloat(ltMatch[1]); return num > max ? "high" : "normal"; }
  if (gtMatch) { const min = parseFloat(gtMatch[1]); return num < min ? "low" : "normal"; }
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]), max = parseFloat(rangeMatch[2]);
    if (num < min) return "low";
    if (num > max) return "high";
    return "normal";
  }
  return null;
}

function groupBySectionQC(results: any[]) {
  const map: Record<string, any[]> = {};
  for (const r of results) {
    if (!map[r.section]) map[r.section] = [];
    map[r.section].push(r);
  }
  return map;
}

const QC_CHECKLIST = [
  { id: "patient_name_id",      label: "Patient Name & ID",       optionA: "Correct",   optionB: "Incorrect",        passOption: "Correct" },
  { id: "test_request",         label: "Test Request",            optionA: "Matched",   optionB: "Mismatch",         passOption: "Matched" },
  { id: "encoded_results",      label: "Encoded Results",         optionA: "Accurate",  optionB: "Needs Correction", passOption: "Accurate" },
  { id: "critical_values",      label: "Critical Values Flagged", optionA: "Not Flagged",   optionB: "Flagged",      passOption: "Not Flagged" },
  { id: "reference_ranges",     label: "Reference Ranges",        optionA: "Correct",   optionB: "Incorrect",        passOption: "Correct" },
  { id: "completeness_of_data", label: "Completeness of Data",    optionA: "Complete",  optionB: "Incomplete",       passOption: "Complete" },
];

// ─── Patient Info Panel (inline, no close button) ────────────────────────────

function PatientInfoPanel({
  patientName,
  patients,
  testRequests,
}: {
  patientName: string;
  patients: any[];
  testRequests: any[];
}) {
  const patient = patients.find(
    (p) => `${p.first_name} ${p.last_name}`.toLowerCase() === patientName.toLowerCase()
  );
  const requests = testRequests.filter(
    (tr) => tr.patient_name?.toLowerCase() === patientName.toLowerCase()
  );

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800 break-words">{value || <span className="text-gray-300 font-normal">—</span>}</p>
    </div>
  );

  if (!patient) return (
    <div className="text-center py-8 text-gray-400">
      <User2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-xs">Patient record not found</p>
    </div>
  );

  return (
    <div className="space-y-5 text-sm">
      {/* Identity */}
      <div>
        <p className="text-[10px] font-bold text-[#3B6255] uppercase tracking-widest mb-2 flex items-center gap-1">
          <User2 className="w-3 h-3" /> Identity
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Patient ID"   value={patient.patient_id_no} />
          <Field label="Sex"          value={patient.sex} />
          <Field label="Last Name"    value={patient.last_name} />
          <Field label="First Name"   value={patient.first_name} />
          <Field label="Middle Name"  value={patient.middle_name} />
          <Field label="Age"          value={patient.age?.toString()} />
          <Field label="Birthdate"    value={patient.birthdate ? new Date(patient.birthdate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null} />
          <Field label="Civil Status" value={patient.civil_status} />
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Contact & Address */}
      <div>
        <p className="text-[10px] font-bold text-[#3B6255] uppercase tracking-widest mb-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Contact & Address
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact No."  value={patient.contact_no} />
          <Field label="Barangay"     value={patient.address_barangay} />
          <Field label="Municipality" value={patient.municipality} />
          <Field label="Province"     value={patient.province} />
          <div className="col-span-2">
            <Field label="Full Address" value={[patient.address_house_no, patient.address_street, patient.address_barangay, patient.municipality, patient.province].filter(Boolean).join(", ")} />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Medical Background */}
      <div>
        <p className="text-[10px] font-bold text-[#3B6255] uppercase tracking-widest mb-2 flex items-center gap-1">
          <Stethoscope className="w-3 h-3" /> Medical Background
        </p>
        <div className="space-y-3">
          <Field label="Medical History" value={patient.medical_history} />
          <Field label="Medications"     value={patient.medications} />
          <Field label="Allergies"       value={patient.allergy} />
        </div>
      </div>

      {/* Test Requests */}
      {requests.length > 0 && (
        <>
          <div className="border-t border-gray-100" />
          <div>
            <p className="text-[10px] font-bold text-[#3B6255] uppercase tracking-widest mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Test Requests
            </p>
            <div className="space-y-3">
              {requests.map((tr, i) => (
                <div key={i} className="bg-[#F8FAF9] rounded-lg p-3 border border-[#CBDED3] space-y-2">
                  <Field label="Requesting Physician" value={tr.requesting_physician} />
                  <Field label="Encoded By"           value={tr.created_by} />
                  <Field label="Status"               value={tr.status} />
                  <Field label="Date"                 value={tr.created_at ? new Date(tr.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null} />
                  <Field label="Notes"                value={tr.notes} />
                  {tr.requested_tests && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Requested Tests</p>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(tr.requested_tests)
                          ? tr.requested_tests
                          : Object.keys(tr.requested_tests || {})
                        ).map((t: any, j: number) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 bg-white border border-[#CBDED3] rounded-full text-[#3B6255] font-medium">
                            {typeof t === "string" ? t : t.test_name || t.section || JSON.stringify(t)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Patient Info Modal ───────────────────────────────────────────────────────

function PatientInfoModal({
  patientName,
  patients,
  testRequests,
  onClose,
}: {
  patientName: string;
  patients: any[];
  testRequests: any[];
  onClose: () => void;
}) {
  const patient = patients.find(
    (p) => `${p.first_name} ${p.last_name}`.toLowerCase() === patientName.toLowerCase()
  );
  const requests = testRequests.filter(
    (tr) => tr.patient_name?.toLowerCase() === patientName.toLowerCase()
  );

  const Field = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value || <span className="text-gray-300 font-normal">—</span>}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <User2 className="w-5 h-5 text-[#3B6255]" />
            <h2 className="text-lg font-bold text-gray-800">Patient Information</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {!patient ? (
            <div className="text-center py-10 text-gray-400">
              <User2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Patient record not found for <span className="font-semibold text-gray-600">{patientName}</span></p>
            </div>
          ) : (
            <>
              {/* Identity */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User2 className="w-4 h-4 text-[#3B6255]" />
                  <h3 className="text-xs font-bold text-[#3B6255] uppercase tracking-widest">Identity</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-[#F8FAF9] rounded-xl p-4">
                  <Field label="Patient ID" value={patient.patient_id_no} />
                  <Field label="Last Name" value={patient.last_name} />
                  <Field label="First Name" value={patient.first_name} />
                  <Field label="Middle Name" value={patient.middle_name} />
                  <Field label="Age" value={patient.age?.toString()} />
                  <Field label="Sex" value={patient.sex} />
                  <Field label="Birthdate" value={patient.birthdate ? new Date(patient.birthdate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null} />
                  <Field label="Civil Status" value={patient.civil_status} />
                </div>
              </div>

              {/* Contact & Address */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-[#3B6255]" />
                  <h3 className="text-xs font-bold text-[#3B6255] uppercase tracking-widest">Contact & Address</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-[#F8FAF9] rounded-xl p-4">
                  <Field label="Contact No." value={patient.contact_no} />
                  <Field label="House No." value={patient.address_house_no} />
                  <Field label="Street" value={patient.address_street} />
                  <Field label="Barangay" value={patient.address_barangay} />
                  <Field label="Municipality" value={patient.municipality} />
                  <Field label="Province" value={patient.province} />
                </div>
              </div>

              {/* Medical Background */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Stethoscope className="w-4 h-4 text-[#3B6255]" />
                  <h3 className="text-xs font-bold text-[#3B6255] uppercase tracking-widest">Medical Background</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8FAF9] rounded-xl p-4">
                  <Field label="Medical History" value={patient.medical_history} />
                  <Field label="Medications" value={patient.medications} />
                  <Field label="Allergies" value={patient.allergy} />
                </div>
              </div>

              {/* Test Requests */}
              {requests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-[#3B6255]" />
                    <h3 className="text-xs font-bold text-[#3B6255] uppercase tracking-widest">Test Requests</h3>
                  </div>
                  <div className="space-y-3">
                    {requests.map((tr, i) => (
                      <div key={i} className="bg-[#F8FAF9] rounded-xl p-4 border border-[#CBDED3]">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <Field label="Requesting Physician" value={tr.requesting_physician} />
                          <Field label="Status" value={tr.status} />
                          <Field label="Date Requested" value={tr.created_at ? new Date(tr.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null} />
                          <Field label="Encoded By" value={tr.created_by} />
                          <Field label="Notes" value={tr.notes} />
                          {tr.requested_tests && (
                            <div className="sm:col-span-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Requested Tests</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(Array.isArray(tr.requested_tests)
                                  ? tr.requested_tests
                                  : Object.keys(tr.requested_tests || {})
                                ).map((t: any, j: number) => (
                                  <span key={j} className="text-xs px-2 py-0.5 bg-white border border-[#CBDED3] rounded-full text-[#3B6255] font-medium">
                                    {typeof t === "string" ? t : t.test_name || t.section || JSON.stringify(t)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl text-right">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LIS Workflow Stepper ─────────────────────────────────────────────────────

const LIS_STEPS = [
  { label: "Patient Registration", href: "/dashboard/patients" },
  { label: "Test Request",         href: "/dashboard/test-requests" },
  { label: "Billing",              href: "/dashboard/billing" },
  { label: "Test Results",         href: "/dashboard/test-results" },
  { label: "Quality Checking",     href: "/dashboard/quality-checking" },
  { label: "Report Generation",    href: "/dashboard/report" },
];

function LISWorkflowStepper({ currentStep }: { currentStep: number }) {
  const router = useRouter();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        LIS Workflow
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {LIS_STEPS.map((step, i) => {
          const isDone    = i < currentStep;
          const isCurrent = i === currentStep;
          const isNext    = i === currentStep + 1;
          return (
            <React.Fragment key={step.label}>
              <button
                onClick={() => router.push(step.href)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                  ${isCurrent
                    ? "bg-[#3B6255] text-white shadow-md"
                    : isDone
                    ? "bg-[#CBDED3] text-[#3B6255] hover:bg-[#b8d0c4]"
                    : isNext
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-dashed border-gray-300"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
              >
                {isDone ? (
                  <CheckCircle className="w-3 h-3 shrink-0" />
                ) : (
                  <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold shrink-0
                    ${isCurrent ? "bg-white text-[#3B6255]" : "bg-gray-300 text-gray-500"}`}>
                    {i + 1}
                  </span>
                )}
                {step.label}
              </button>
              {i < LIS_STEPS.length - 1 && (
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${i < currentStep ? "text-[#3B6255]" : "text-gray-300"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Access helper ────────────────────────────────────────────────────────────

const isSeniorOrAbove = (user: any): boolean => {
  if (!user) return false;
  const role = user.role?.toLowerCase();
  // Accept explicit senior/admin roles
  if (['faculty', 'senior_medtech', 'senior', 'admin', 'pathologist'].includes(role)) return true;
  // Fallback: check a dedicated is_senior flag if present
  if (user.is_senior === true) return true;
  return false;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QualityCheckingPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Data
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [qcChecks, setQcChecks] = useState<QualityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ testName: string; patientName: string; passed: boolean } | null>(null);

  // Selected test result to QC
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [showQCForm, setShowQCForm] = useState(false);

  // Checklist state — tracks which option is selected per item
  const [checklist, setChecklist] = useState<Record<string, string>>({});

  // Form fields
  const [checkedBy, setCheckedBy] = useState("");
  const [comments, setComments] = useState("");
  const [checkedAt, setCheckedAt] = useState(toLocalDatetimeValue(new Date()));

  // Filters
  const [filterQcResult, setFilterQcResult] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterPending, setFilterPending] = useState(true);

  // Expand
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qcToDelete, setQcToDelete] = useState<QualityCheck | null>(null);

  // Search for test results
  const [resultSearch, setResultSearch] = useState("");

  // Patient info modal
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [showLabReport, setShowLabReport] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [testRequests, setTestRequests] = useState<any[]>([]);

  // ── Auto-derive QC result from checklist ─────────────────────────────────────
  // If ANY item is on the fail option → overall result is FAIL
  const failingItems = useMemo(() =>
    QC_CHECKLIST.filter(item =>
      checklist[item.id] && checklist[item.id] !== item.passOption
    ),
    [checklist]
  );
  const allItemsAnswered = QC_CHECKLIST.every(item => checklist[item.id] && checklist[item.id].length > 0);
  const derivedQcResult: "pass" | "fail" | null = !allItemsAnswered ? null : failingItems.length === 0 ? "pass" : "fail";

  // ── Animations ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeInSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeInScale {
        from { opacity: 0; transform: scale(0.95); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ── Pre-fill checker name from logged-in user ────────────────────────────────
  useEffect(() => {
    if (user?.full_name) setCheckedBy(user.full_name);
  }, [user]);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [results, checks, patientsData] = await Promise.all([
      fetchTestResults(),
      fetchQualityChecks(),
      fetchPatients(),
    ]);
    setTestResults(results || []);
    setQcChecks(checks);
    setPatients(patientsData || []);
    // Fetch test requests
    const { data: trData } = await supabase.from("test_requests").select("*");
    setTestRequests(trData || []);
    setLoading(false);
  };

  // ── Computed: which test_result_ids already have a QC ─────────────────────
  const checkedResultIds = new Set(qcChecks.map((q) => q.test_result_id));

  // ── Pending results: any result that hasn't been QC-checked yet ──────────────
  const pendingResults = testResults.filter(
    (r) => !checkedResultIds.has(r.id)
  );

  // ── Filtered results for the picker ─────────────────────────────────────────
  const filteredResults = (filterPending ? pendingResults : testResults).filter(
    (r) =>
      !resultSearch ||
      r.patient_name.toLowerCase().includes(resultSearch.toLowerCase()) ||
      r.test_name.toLowerCase().includes(resultSearch.toLowerCase())
  );

  // ── Open QC form for a specific result ──────────────────────────────────────
  const openQCForm = (result: TestResult) => {
    setSelectedResult(result);
    setShowQCForm(true);
    setComments("");
    setCheckedAt(toLocalDatetimeValue(new Date()));
    setChecklist({});
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleDeleteQC = async () => {
    if (!qcToDelete) return;
    if (USE_MOCK_DATA) {
      MOCK_QC_CHECKS = MOCK_QC_CHECKS.filter((q) => q.id !== qcToDelete.id);
    } else {
      await supabase.from("quality_checks").delete().eq("id", qcToDelete.id);
    }
    setQcChecks((prev) => prev.filter((q) => q.id !== qcToDelete.id));
    setQcToDelete(null);
  };

  const closeQCForm = () => {
    setShowQCForm(false);
    setSelectedResult(null);
    setChecklist({});
    setSubmitError(null);
  };

  // ── Submit QC ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedResult || !checkedBy.trim()) return;

    if (!allItemsAnswered) {
      setSubmitError("Please complete all checklist items before submitting.");
      return;
    }

    // If FAIL, require comments
    if (derivedQcResult === "fail" && !comments.trim()) {
      setSubmitError("Comments are required when any checklist item fails. Please describe the issue(s) found.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      test_result_id: selectedResult.id,
      patient_name: selectedResult.patient_name,
      test_name: selectedResult.test_name,
      section: selectedResult.section,
      result_value: selectedResult.result_value,
      reference_range: selectedResult.reference_range,
      unit: selectedResult.unit,
      qc_result: derivedQcResult as "pass" | "fail",
      checked_by: checkedBy.trim(),
      comments: comments.trim(),
      checked_at: new Date(checkedAt).toISOString(),
    };

    const result = await addQualityCheck(payload, user);
    setSubmitting(false);

    if (!result) {
      setSubmitError("Failed to save quality check. Please try again.");
      return;
    }

    setSubmitSuccess({
      testName: selectedResult.test_name,
      patientName: selectedResult.patient_name,
      passed: derivedQcResult === "pass",
    });
    closeQCForm();
    loadData();
    setTimeout(() => setSubmitSuccess(null), 10000);
  };

  // ── Filtered QC history ──────────────────────────────────────────────────────
  const filteredQcChecks = qcChecks.filter((q) => {
    if (filterQcResult && q.qc_result !== filterQcResult) return false;
    if (
      filterSearch &&
      !q.patient_name.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !q.test_name.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !q.checked_by.toLowerCase().includes(filterSearch.toLowerCase())
    )
      return false;
    return true;
  });

  const inputCls =
    "w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white";

  // ─────────────────────────────────────────────────────────────────────────────
  // Block access for Junior Medical Technologists — checked here (after all hooks)
  // to comply with React's Rules of Hooks (no early returns before hook calls).
  if (!isSeniorOrAbove(user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Quality Checking is only available to Senior Medical Technologists and above.
          Please contact your supervisor if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" style={{ animation: "fadeIn 0.5s ease-out" }}>

      {/* ── LIS Workflow Stepper ───────────────────────────────────────────── */}
      <div style={{ animation: "fadeInSlideUp 0.6s ease-out 0s both" }}>
        <LISWorkflowStepper currentStep={4} />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ animation: "fadeInSlideUp 0.6s ease-out 0.1s both" }}>
        <h1 className="text-3xl font-bold text-gray-800">Quality Checking</h1>
        <p className="text-gray-600 text-sm mt-1">
          Review and verify test results before report generation
        </p>
      </div>

      {/* ── Success / Fail Banner ───────────────────────────────────────────── */}
      {submitSuccess && (
        <div
          className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl border ${
            submitSuccess.passed
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
          style={{ animation: "fadeInScale 0.3s ease-out" }}
        >
          <div className="flex items-center gap-3">
            {submitSuccess.passed
              ? <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
              : <ShieldX className="w-5 h-5 text-red-500 shrink-0" />
            }
            <div>
              <p className="font-semibold text-sm">
                QC {submitSuccess.passed ? "PASSED" : "FAILED"} — {submitSuccess.testName} ({submitSuccess.patientName})
              </p>
              <p className={`text-xs mt-0.5 ${submitSuccess.passed ? "text-green-600" : "text-red-600"}`}>
                {submitSuccess.passed
                  ? "This result has passed all QC checks and can proceed to Report Generation."
                  : "This result failed QC. It must be corrected and re-checked before a report can be generated."}
              </p>
            </div>
          </div>
          {submitSuccess.passed && (
            <a
              href="/dashboard/report"
              className="flex items-center gap-2 px-4 py-2 bg-[#3B6255] text-white rounded-lg text-sm font-semibold hover:bg-green-800 transition shrink-0 whitespace-nowrap"
            >
              Generate Report
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.2s both" }}
      >
        {[
          {
            label: "Pending QC",
            value: pendingResults.length,
            gradient: "from-yellow-400 to-yellow-600",
            Icon: Clock,
          },
          {
            label: "Total Checked",
            value: qcChecks.length,
            gradient: "from-[#3B6255] to-green-900",
            Icon: ClipboardCheck,
          },
          {
            label: "Passed",
            value: qcChecks.filter((q) => q.qc_result === "pass").length,
            gradient: "from-green-400 to-green-600",
            Icon: ShieldCheck,
          },
          {
            label: "Failed",
            value: qcChecks.filter((q) => q.qc_result === "fail").length,
            gradient: "from-red-400 to-red-600",
            Icon: ShieldX,
          },
        ].map(({ label, value, gradient, Icon }, i) => (
          <div
            key={label}
            className={`bg-gradient-to-br ${gradient} text-white rounded-lg shadow-lg p-5`}
            style={{ animation: `fadeInScale 0.5s ease-out ${0.25 + i * 0.05}s both` }}
          >
            <Icon className="w-7 h-7 mb-3 opacity-90" />
            <p className="text-sm opacity-90">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Lab Report Preview Modal ──────────────────────────────────────── */}
      {showLabReport && selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-bold text-gray-800">Lab Report Preview</h2>
                <span className="text-xs text-gray-400 ml-1">— {selectedResult.patient_name}</span>
              </div>
              <button onClick={() => setShowLabReport(false)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Report Content */}
            <div className="overflow-y-auto flex-1 bg-gray-100">
              {(() => {
                const patientAllResults = testResults.filter(
                  (r) => r.patient_name.toLowerCase() === selectedResult.patient_name.toLowerCase()
                );
                if (patientAllResults.length === 0) return (
                  <div className="p-8 text-center text-gray-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No results on record for this patient.</p>
                  </div>
                );
                const grouped = groupBySectionQC(patientAllResults);
                return (
                  <div style={{ maxWidth: "850px", margin: "32px auto", background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", borderRadius: "4px", fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt", color: "#000", padding: "48px 56px", minHeight: "1000px" }}>
                    {/* Mini header */}
                    <div style={{ borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "8px", fontFamily: "Arial, sans-serif" }}>
                      <div style={{ fontSize: "16pt", fontWeight: "900" }}>CogniLab</div>
                      <div style={{ fontSize: "8.5pt", color: "#555" }}>KRRAX-JAM Inc · Professional Medical Testing Services</div>
                    </div>
                    {/* Patient row */}
                    <div style={{ fontSize: "8.5pt", fontFamily: "Arial, sans-serif", marginBottom: "8px", paddingBottom: "6px", borderBottom: "1px solid #aaa" }}>
                      <span style={{ color: "#555" }}>Patient: </span>
                      <strong>{selectedResult.patient_name.toUpperCase()}</strong>
                    </div>
                    {/* Table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif", fontSize: "9pt", marginBottom: "10px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid #000", borderTop: "1.5px solid #000" }}>
                          <th style={{ textAlign: "left",   padding: "4px 6px", fontWeight: "bold", width: "42%" }}>Test Name</th>
                          <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "bold", width: "16%" }}>Result</th>
                          <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "bold", width: "28%" }}>Normal Range</th>
                          <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "bold", width: "14%" }}>Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(grouped).map(([section, rows]: [string, any[]]) => (
                          <React.Fragment key={`sec-${section}`}>
                            <tr>
                              <td colSpan={4} style={{ paddingTop: "10px", paddingBottom: "3px", paddingLeft: "4px", fontWeight: "bold", fontSize: "9.5pt", borderBottom: "1px solid #bbb" }}>
                                {section}
                              </td>
                            </tr>
                            {rows.map((r: any) => {
                              const isCurrent = r.id === selectedResult.id;
                              const isMultiline = r.result_value?.includes("\n");
                              const abnormal = !isMultiline ? getAbnormalStatusQC(r.result_value, r.reference_range) : null;
                              const isHigh = abnormal === "high";
                              const isLow  = abnormal === "low";
                              const resultColor = isHigh ? "#dc2626" : isLow ? "#2563eb" : "inherit";
                              const arrow = isHigh ? " ↑" : isLow ? " ↓" : "";
                              if (isMultiline) {
                                const lines = r.result_value.split("\n");
                                return (
                                  <React.Fragment key={`gh-${r.id}`}>
                                    <tr style={{ background: isCurrent ? "#fefce8" : "transparent" }}>
                                      <td colSpan={4} style={{ paddingLeft: "10px", paddingTop: "6px", paddingBottom: "2px", fontWeight: "bold", fontSize: "9pt", color: isCurrent ? "#92400e" : "#333" }}>
                                        {isCurrent ? "👁 " : ""}{r.test_name}
                                      </td>
                                    </tr>
                                    {lines.map((line: string, li: number) => {
                                      const colonIdx = line.indexOf(":");
                                      const subLabel = colonIdx !== -1 ? line.slice(0, colonIdx).trim() : line;
                                      const subVal   = colonIdx !== -1 ? line.slice(colonIdx + 1).trim() : "";
                                      return (
                                        <tr key={`sub-${r.id}-${li}`} style={{ borderBottom: "1px solid #f0f0f0", background: isCurrent ? "#fefce8" : "transparent" }}>
                                          <td style={{ paddingLeft: "20px", paddingTop: "3px", paddingBottom: "3px" }}>{subLabel}</td>
                                          <td style={{ textAlign: "center", paddingTop: "3px", paddingBottom: "3px" }}>{subVal}</td>
                                          <td></td>
                                          <td style={{ textAlign: "center", color: "#777" }}>{r.unit || ""}</td>
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              }
                              return (
                                <tr key={r.id} style={{ borderBottom: "1px solid #efefef", background: isCurrent ? "#fefce8" : "transparent" }}>
                                  <td style={{ paddingLeft: "10px", paddingTop: "4px", paddingBottom: "4px", color: isCurrent ? "#92400e" : "inherit" }}>
                                    {isCurrent ? "👁 " : ""}{r.test_name}
                                  </td>
                                  <td style={{ textAlign: "center", fontWeight: (isHigh || isLow) ? "700" : "normal", color: resultColor }}>
                                    {r.result_value}{arrow}
                                  </td>
                                  <td style={{ textAlign: "center", color: "#555", fontSize: "8.5pt" }}>{r.reference_range || ""}</td>
                                  <td style={{ textAlign: "center", color: "#777", fontSize: "8.5pt" }}>{r.unit || ""}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                    {/* Legend */}
                    <div style={{ borderTop: "1px solid #ccc", paddingTop: "5px", fontFamily: "Arial, sans-serif", fontSize: "7.5pt", color: "#555", display: "flex", gap: "16px" }}>
                      <strong>LEGEND:</strong>
                      <span style={{ color: "#dc2626" }}>↑ High</span>
                      <span style={{ color: "#2563eb" }}>↓ Low</span>
                      <span>👁 Currently reviewing</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* Footer */}
            <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <p className="text-xs text-gray-400 italic">This is a preview only — signatures will be added during Report Generation.</p>
              <button onClick={() => setShowLabReport(false)} className="flex items-center gap-2 px-5 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition">
                <X className="w-4 h-4" /> Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QC Form + Patient Info (side by side) ──────────────────────── */}
      {showQCForm && selectedResult && (
        <div className="flex gap-6 items-start" style={{ animation: "fadeInScale 0.4s ease-out" }}>

          {/* LEFT — QC Form */}
          <div className="flex-1 min-w-0 bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]">
          <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#3B6255]" />
            Quality Check Form
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Reviewing result for{" "}
            <span className="font-semibold text-gray-700">
              {selectedResult.patient_name}
            </span>
          </p>

          {/* Result Summary Card */}
          <div className="bg-[#F0F4F1] border border-[#CBDED3] rounded-lg p-4 mb-6">
            <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">
              Test Result Being Reviewed
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Section</p>
                <p className="font-semibold text-gray-800">{selectedResult.section}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Test</p>
                <p className="font-semibold text-gray-800">{selectedResult.test_name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Result</p>
                <p className="font-semibold text-gray-800">{selectedResult.result_value}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Reference Range</p>
                <p className="font-semibold text-gray-800">
                  {selectedResult.reference_range || "—"}{" "}
                  {selectedResult.unit && (
                    <span className="text-gray-500 font-normal">{selectedResult.unit}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* ── QC Checklist ─────────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#3B6255]" />
                QC Checklist
              </h3>
              <div className="flex items-center gap-2">
                {/* Live QC result badge — auto-derived */}
                {allItemsAnswered && (
                  <span className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
                    derivedQcResult === "pass"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {derivedQcResult === "pass"
                      ? <><ShieldCheck className="w-3 h-3" /> Will PASS</>
                      : <><ShieldX className="w-3 h-3" /> Will FAIL</>
                    }
                  </span>
                )}
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  allItemsAnswered
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {Object.values(checklist).filter(v => typeof v === "string" && v.length > 0).length} / {QC_CHECKLIST.length} answered
                </span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {QC_CHECKLIST.map((item, index) => {
                const selected = checklist[item.id];
                const isPass = selected === item.optionA;
                const isFail = selected === item.optionB;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-5 py-4 transition
                      ${index !== QC_CHECKLIST.length - 1 ? "border-b border-gray-100" : ""}
                      ${!selected ? "bg-white" : isPass ? "bg-green-50" : "bg-red-50"}
                    `}
                  >
                    <div className="flex items-center gap-2 w-52 shrink-0">
                      {isFail && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      <p className={`text-sm font-semibold ${
                        isPass ? "text-[#3B6255]" : isFail ? "text-red-700" : "text-gray-800"
                      }`}>
                        {item.label}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setChecklist(prev => ({ ...prev, [item.id]: item.optionA }))}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border-2 transition ${
                          isPass
                            ? "bg-[#3B6255] border-[#3B6255] text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-500 hover:border-[#3B6255] hover:text-[#3B6255]"
                        }`}
                      >
                        {item.optionA}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChecklist(prev => ({ ...prev, [item.id]: item.optionB }))}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border-2 transition ${
                          isFail
                            ? "bg-red-500 border-red-500 text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-500"
                        }`}
                      >
                        {item.optionB}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Failing items summary */}
            {failingItems.length > 0 && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-red-700 mb-1">
                    {failingItems.length} item{failingItems.length > 1 ? "s" : ""} failed — this result will be marked FAIL and cannot proceed to Report Generation.
                  </p>
                  <p className="text-xs text-red-600">
                    Failed: {failingItems.map(i => i.label).join(", ")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* QC Result — read-only, auto-derived */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                QC Result <span className="text-xs font-normal text-gray-400">(auto-determined by checklist)</span>
              </label>
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 font-bold text-sm ${
                !allItemsAnswered
                  ? "bg-gray-50 border-gray-200 text-gray-400"
                  : derivedQcResult === "pass"
                  ? "bg-green-50 border-green-400 text-green-700"
                  : "bg-red-50 border-red-400 text-red-700"
              }`}>
                {!allItemsAnswered ? (
                  <><Clock className="w-4 h-4" /> Complete checklist above</>
                ) : derivedQcResult === "pass" ? (
                  <><ShieldCheck className="w-4 h-4" /> PASS — All checks cleared</>
                ) : (
                  <><ShieldX className="w-4 h-4" /> FAIL — {failingItems.length} issue{failingItems.length > 1 ? "s" : ""} found</>
                )}
              </div>
            </div>

            {/* Checked By */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Reviewed By <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={checkedBy}
                onChange={(e) => setCheckedBy(e.target.value)}
                placeholder="e.g. Maria Santos, RMT"
                className={inputCls}
              />
            </div>

            {/* Date & Time of QC */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date & Time of QC Check <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={checkedAt}
                onChange={(e) => setCheckedAt(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Comments */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Comments / Findings{" "}
                <span className={`font-normal text-xs ${derivedQcResult === "fail" && allItemsAnswered ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                  {derivedQcResult === "fail" && allItemsAnswered ? "(required for FAIL)" : "(optional)"}
                </span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  derivedQcResult === "fail"
                    ? "Required: Describe the issue(s) found so lab staff can correct and re-run..."
                    : "Add any notes or observations..."
                }
                rows={3}
                className={`w-full px-4 py-2 border rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white resize-none ${
                  derivedQcResult === "fail" && allItemsAnswered && !comments.trim()
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
              />
            </div>
          </div>

          {/* FAIL block warning */}
          {derivedQcResult === "fail" && allItemsAnswered && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700 mb-1">
                  This result will be marked FAIL and blocked from Report Generation.
                </p>
                <p className="text-xs text-red-600">
                  The following items did not pass: <strong>{failingItems.map(i => i.label).join(", ")}</strong>.
                  Lab staff must correct and re-submit a new test result before a report can be generated.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {submitError && (
            <p className="text-sm text-red-600 mb-4 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
              ✕ {submitError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              disabled={submitting || !checkedBy.trim() || !allItemsAnswered}
              className={`flex-1 px-6 py-3 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${
                !allItemsAnswered
                  ? "bg-gray-400"
                  : derivedQcResult === "pass"
                  ? "bg-gradient-to-r from-[#3B6255] to-green-700"
                  : "bg-gradient-to-r from-red-500 to-red-700"
              }`}
            >
              {submitting ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : !allItemsAnswered ? (
                <ClipboardCheck className="w-5 h-5" />
              ) : derivedQcResult === "pass" ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldX className="w-5 h-5" />
              )}
              {submitting
                ? "Saving..."
                : !allItemsAnswered
                ? "Complete checklist to submit"
                : `Submit QC — ${derivedQcResult?.toUpperCase() ?? "..."}`}
            </button>
            <button
              onClick={closeQCForm}
              disabled={submitting}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancel
            </button>
          </div>
          </div>{/* end left QC form */}

          {/* RIGHT — Patient Info + Lab Results stacked */}
          <div className="w-80 shrink-0 space-y-4">

            {/* Patient Info */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border-t-4 border-[#3B6255]">
              <div className="px-5 py-4 bg-[#F0F4F1] border-b border-[#CBDED3] flex items-center gap-2">
                <User2 className="w-4 h-4 text-[#3B6255]" />
                <h3 className="text-sm font-bold text-[#3B6255]">Patient Information</h3>
              </div>
              <div className="overflow-y-auto max-h-[45vh] p-5">
                <PatientInfoPanel
                  patientName={selectedResult.patient_name}
                  patients={patients}
                  testRequests={testRequests}
                />
              </div>
            </div>

            {/* Lab Report Preview — button triggers modal */}
            <button
              onClick={() => setShowLabReport(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg shadow transition"
            >
              <FileText className="w-4 h-4" />
              View Lab Report Preview
            </button>

          </div>{/* end right panels */}

        </div>
      )}

      {/* ── Pending Results for QC ─────────────────────────────────────────── */}
      <div
        className="bg-white rounded-lg shadow-lg overflow-hidden"
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.3s both" }}
      >
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                Pending Quality Check ({pendingResults.length})
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Test results awaiting QC review
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterPending}
                  onChange={(e) => setFilterPending(e.target.checked)}
                  className="accent-[#3B6255]"
                />
                Show pending only
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={resultSearch}
                  onChange={(e) => setResultSearch(e.target.value)}
                  placeholder="Search patient / test..."
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white w-52"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Patient</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Section</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Test</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Result</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Reference Range</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((result) => {
                  const alreadyChecked = checkedResultIds.has(result.id);
                  return (
                    <tr
                      key={result.id}
                      className="border-b border-gray-100 hover:bg-[#F0F4F1] transition"
                    >
                      <td className="py-4 px-6 font-medium text-gray-800">{result.patient_name}</td>
                      <td className="py-4 px-6 text-gray-600 text-sm">{result.section}</td>
                      <td className="py-4 px-6 text-gray-800 text-sm font-medium">{result.test_name}</td>
                      <td className="py-4 px-6 font-mono text-sm text-gray-800">{result.result_value}</td>
                      <td className="py-4 px-6 text-gray-500 text-sm">
                        {result.reference_range || "—"}
                        {result.unit && <span className="ml-1 text-xs text-gray-400">{result.unit}</span>}
                      </td>
                      <td className="py-4 px-6">
                        {alreadyChecked ? (
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> QC Done
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {!alreadyChecked ? (
                          <button
                            onClick={() => openQCForm(result)}
                            className="px-4 py-2 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg text-xs font-semibold hover:shadow-md transition flex items-center gap-1"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            Review
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Already reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredResults.length === 0 && !loading && (
              <div className="p-12 text-center text-gray-500">
                <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {filterPending ? "All test results have been quality checked!" : "No test results found"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── QC History ────────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-lg shadow-lg overflow-hidden"
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.5s both" }}
      >
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            QC History ({filteredQcChecks.length})
          </h2>
        </div>

        {/* Filters */}
        <div className="px-8 py-4 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Result</label>
              <select
                value={filterQcResult}
                onChange={(e) => setFilterQcResult(e.target.value)}
                className={inputCls}
              >
                <option value="">All Results</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Patient, test, or reviewer..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Patient</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Test</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Result</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">QC Result</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Reviewed By</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Checked At</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredQcChecks.map((qc) => {
                const isExpanded = expandedId === qc.id;
                return (
                  <React.Fragment key={qc.id}>
                    <tr
                      className="border-b border-gray-100 hover:bg-[#F0F4F1] transition cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : qc.id)}
                    >
                      <td className="py-4 px-6 font-medium text-gray-800">{qc.patient_name}</td>
                      <td className="py-4 px-6 text-gray-700 text-sm">
                        <p className="font-medium">{qc.test_name}</p>
                        <p className="text-gray-400 text-xs">{qc.section}</p>
                      </td>
                      <td className="py-4 px-6 font-mono text-sm text-gray-700">
                        {qc.result_value}{" "}
                        {qc.unit && <span className="text-xs text-gray-400">{qc.unit}</span>}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${
                          qc.qc_result === "pass" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {qc.qc_result === "pass"
                            ? <ShieldCheck className="w-3 h-3" />
                            : <ShieldX className="w-3 h-3" />}
                          {qc.qc_result.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 text-sm">{qc.checked_by}</td>
                      <td className="py-4 px-6 font-mono text-sm text-gray-600">{formatDateTime(qc.checked_at)}</td>
                      <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : qc.id)}
                            className="p-1 text-gray-400 hover:text-[#3B6255] transition"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setQcToDelete(qc)}
                            className="p-1 text-red-400 hover:text-red-600 transition"
                            title="Delete QC Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#F8FBF9] border-b border-gray-200">
                        <td colSpan={7} className="px-8 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1 uppercase">Reference Range</p>
                              <p className="text-gray-800">
                                {qc.reference_range || "—"}{" "}
                                {qc.unit && <span className="text-gray-500">{qc.unit}</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1 uppercase">Comments / Findings</p>
                              <p className="text-gray-800">
                                {qc.comments || <span className="text-gray-400 italic">No comments</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1 uppercase">Record Created</p>
                              <p className="text-gray-800">{formatDateTime(qc.created_at)}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {filteredQcChecks.length === 0 && !loading && (
            <div className="p-12 text-center text-gray-500">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No quality check records found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Info Note ─────────────────────────────────────────────────────── */}
      <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg">
        <h3 className="font-semibold text-[#3B6255] mb-2">
          🔬 Quality Control Reminder
        </h3>
        <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
          <li>QC result is automatically determined by the checklist — any failed item = FAIL overall</li>
          <li>Failed results are blocked from Report Generation until corrected and re-checked</li>
          <li>Comments are required when submitting a FAIL result</li>
          <li>Only PASS results can proceed to Report Generation</li>
        </ul>
      </div>

      {/* ── Delete QC Confirmation Modal ──────────────────────────────────── */}
      {qcToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" style={{ animation: "fadeInScale 0.3s ease-out" }}>

            {/* Warning icon */}
            <div className="flex flex-col items-center pt-8 pb-4 px-8">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4 ring-8 ring-red-50">
                <Trash2 className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-800 mb-1">⚠️ Attention!</h3>
              <p className="text-sm font-semibold text-red-600 uppercase tracking-widest">This action cannot be undone</p>
            </div>

            {/* Body */}
            <div className="px-8 pb-6 text-center space-y-3">
              <p className="text-gray-700 text-base">
                You are about to permanently delete the QC record for:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3">
                <p className="font-bold text-gray-800 text-lg">{qcToDelete.patient_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {qcToDelete.section} &mdash; <span className="font-semibold text-gray-700">{qcToDelete.test_name}</span>
                </p>
                <span className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold ${qcToDelete.qc_result === "pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {qcToDelete.qc_result === "pass" ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                  {qcToDelete.qc_result.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-400">
                Once deleted, this QC record will be removed from the system and cannot be recovered.
              </p>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-100 px-8 py-5 flex gap-3">
              <button
                onClick={() => setQcToDelete(null)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteQC}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl transition font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-200"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}