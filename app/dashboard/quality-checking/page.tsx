"use client";

import React, { useState, useEffect } from "react";
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
  ClipboardCheck,
  AlertTriangle,
  User,
  Calendar,
  MessageSquare,
  FlaskConical,
} from "lucide-react";
import { fetchTestResults } from "@/lib/database";
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

const QC_CHECKLIST = [
  { id: "patient_name_id",      label: "Patient Name & ID",       optionA: "Correct",   optionB: "Incorrect",        passOption: "Correct" },
  { id: "test_request",         label: "Test Request",            optionA: "Matched",   optionB: "Mismatch",         passOption: "Matched" },
  { id: "encoded_results",      label: "Encoded Results",         optionA: "Accurate",  optionB: "Needs Correction", passOption: "Accurate" },
  { id: "critical_values",      label: "Critical Values Flagged", optionA: "Flagged",   optionB: "Not Flagged",      passOption: "Flagged" },
  { id: "reference_ranges",     label: "Reference Ranges",        optionA: "Correct",   optionB: "Incorrect",        passOption: "Correct" },
  { id: "completeness_of_data", label: "Completeness of Data",    optionA: "Complete",  optionB: "Incomplete",       passOption: "Complete" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QualityCheckingPage() {
  const { user } = useAuth();

  // Data
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [qcChecks, setQcChecks] = useState<QualityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Selected test result to QC
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [showQCForm, setShowQCForm] = useState(false);

  // Checklist state — tracks which option is selected per item
  const [checklist, setChecklist] = useState<Record<string, string>>({});

  // Form fields
  const [qcResult, setQcResult] = useState<"pass" | "fail">("pass");
  const [checkedBy, setCheckedBy] = useState("");
  const [comments, setComments] = useState("");
  const [checkedAt, setCheckedAt] = useState(toLocalDatetimeValue(new Date()));

  // Filters
  const [filterQcResult, setFilterQcResult] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterPending, setFilterPending] = useState(true);

  // Expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Search for test results
  const [resultSearch, setResultSearch] = useState("");

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
    const [results, checks] = await Promise.all([
      fetchTestResults(),
      fetchQualityChecks(),
    ]);
    setTestResults(results || []);
    setQcChecks(checks);
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
    setQcResult("pass");
    setComments("");
    setCheckedAt(toLocalDatetimeValue(new Date()));
    setChecklist({});
    setSubmitError(null);
    setSubmitSuccess(null);
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

    const allChecked = QC_CHECKLIST.every((item) => checklist[item.id]);
    if (!allChecked) {
      setSubmitError("Please complete all checklist items before submitting.");
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
      qc_result: qcResult,
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

    setSubmitSuccess(
      `Quality check recorded: ${qcResult.toUpperCase()} for ${selectedResult.test_name} (${selectedResult.patient_name})`
    );
    setTimeout(() => setSubmitSuccess(null), 4000);
    closeQCForm();
    loadData();
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
  return (
    <div className="space-y-8" style={{ animation: "fadeIn 0.5s ease-out" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.1s both" }}
      >
        <h1 className="text-3xl font-bold text-gray-800">Quality Checking</h1>
        <p className="text-gray-600 text-sm mt-1">
          Review and verify test results before report generation
        </p>
      </div>

      {/* ── Success banner ──────────────────────────────────────────────────── */}
      {submitSuccess && (
        <div className="px-4 py-3 rounded-lg font-medium text-sm bg-green-100 text-green-800 border border-green-300"
          style={{ animation: "fadeInScale 0.3s ease-out" }}>
          ✓ {submitSuccess}
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

      {/* ── QC Form Modal ──────────────────────────────────────────────────── */}
      {showQCForm && selectedResult && (
        <div
          className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]"
          style={{ animation: "fadeInScale 0.4s ease-out" }}
        >
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
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                QC_CHECKLIST.every(i => checklist[i.id] && checklist[i.id].length > 0)
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {Object.values(checklist).filter(v => typeof v === "string" && v.length > 0).length} / {QC_CHECKLIST.length} completed
              </span>
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
                    {/* Label */}
                    <p className={`text-sm font-semibold w-48 shrink-0 ${
                      isPass ? "text-[#3B6255]" : isFail ? "text-red-700" : "text-gray-800"
                    }`}>
                      {item.label}
                    </p>
                    {/* Toggle buttons */}
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* QC Result — Pass / Fail */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                QC Result <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setQcResult("pass")}
                  className={`flex-1 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition border-2 ${
                    qcResult === "pass"
                      ? "bg-green-500 text-white border-green-500 shadow-md"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  PASS
                </button>
                <button
                  onClick={() => setQcResult("fail")}
                  className={`flex-1 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition border-2 ${
                    qcResult === "fail"
                      ? "bg-red-500 text-white border-red-500 shadow-md"
                      : "bg-white text-gray-600 border-gray-200 hover:border-red-400"
                  }`}
                >
                  <ShieldX className="w-4 h-4" />
                  FAIL
                </button>
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
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  qcResult === "fail"
                    ? "Describe the issue found..."
                    : "Add any notes or observations..."
                }
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white resize-none"
              />
            </div>
          </div>

          {/* Fail warning */}
          {qcResult === "fail" && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                Marking as <strong>FAIL</strong> means this result did not pass
                quality control. Please add comments describing the issue so the
                lab staff can re-examine or re-run the test.
              </p>
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
              disabled={submitting || !checkedBy.trim()}
              className={`flex-1 px-6 py-3 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${
                qcResult === "pass"
                  ? "bg-gradient-to-r from-[#3B6255] to-green-700"
                  : "bg-gradient-to-r from-red-500 to-red-700"
              }`}
            >
              {submitting ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : qcResult === "pass" ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldX className="w-5 h-5" />
              )}
              {submitting
                ? "Saving..."
                : `Submit QC — ${qcResult.toUpperCase()}`}
            </button>
            <button
              onClick={closeQCForm}
              disabled={submitting}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancel
            </button>
          </div>
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
                      <td className="py-4 px-6 font-medium text-gray-800">
                        {result.patient_name}
                      </td>
                      <td className="py-4 px-6 text-gray-600 text-sm">
                        {result.section}
                      </td>
                      <td className="py-4 px-6 text-gray-800 text-sm font-medium">
                        {result.test_name}
                      </td>
                      <td className="py-4 px-6 font-mono text-sm text-gray-800">
                        {result.result_value}
                      </td>
                      <td className="py-4 px-6 text-gray-500 text-sm">
                        {result.reference_range || "—"}
                        {result.unit && (
                          <span className="ml-1 text-xs text-gray-400">
                            {result.unit}
                          </span>
                        )}
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
                          <span className="text-xs text-gray-400 italic">
                            Already reviewed
                          </span>
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
                  {filterPending
                    ? "All test results have been quality checked!"
                    : "No test results found"}
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by Result
              </label>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Search
              </label>
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
                      <td className="py-4 px-6 font-medium text-gray-800">
                        {qc.patient_name}
                      </td>
                      <td className="py-4 px-6 text-gray-700 text-sm">
                        <p className="font-medium">{qc.test_name}</p>
                        <p className="text-gray-400 text-xs">{qc.section}</p>
                      </td>
                      <td className="py-4 px-6 font-mono text-sm text-gray-700">
                        {qc.result_value}{" "}
                        {qc.unit && (
                          <span className="text-xs text-gray-400">{qc.unit}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${
                            qc.qc_result === "pass"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {qc.qc_result === "pass" ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <ShieldX className="w-3 h-3" />
                          )}
                          {qc.qc_result.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 text-sm">
                        {qc.checked_by}
                      </td>
                      <td className="py-4 px-6 font-mono text-sm text-gray-600">
                        {formatDateTime(qc.checked_at)}
                      </td>
                      <td
                        className="py-4 px-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : qc.id)
                          }
                          className="p-1 text-gray-400 hover:text-[#3B6255] transition"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr
                        className="bg-[#F8FBF9] border-b border-gray-200"
                      >
                        <td colSpan={7} className="px-8 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1 uppercase">
                                Reference Range
                              </p>
                              <p className="text-gray-800">
                                {qc.reference_range || "—"}{" "}
                                {qc.unit && (
                                  <span className="text-gray-500">{qc.unit}</span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1 uppercase">
                                Comments / Findings
                              </p>
                              <p className="text-gray-800">
                                {qc.comments || (
                                  <span className="text-gray-400 italic">
                                    No comments
                                  </span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500 mb-1 uppercase">
                                Record Created
                              </p>
                              <p className="text-gray-800">
                                {formatDateTime(qc.created_at)}
                              </p>
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
          <li>Quality Checking is done after Test Results and before Report Generation</li>
          <li>Each test result must be individually reviewed and marked Pass or Fail</li>
          <li>Failed results should include comments explaining the issue</li>
          <li>Only results that have passed QC should proceed to Report Generation</li>
        </ul>
      </div>
    </div>
  );
}