"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Stethoscope,
  FlaskConical,
  Check,
  Trash2,
} from "lucide-react";
import { fetchPatients, addBilling, getTestPrice } from "@/lib/database";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { logActivity } from "@/lib/database";

// ─── Constants (mirrors your existing LAB_SECTIONS / TESTS_BY_SECTION) ────────

const LAB_SECTIONS = [
  "BLOOD BANK",
  "HEMATOLOGY",
  "CLINICAL MICROSCOPY",
  "CLINICAL CHEMISTRY",
  "MICROBIOLOGY",
  "IMMUNOLOGY/SEROLOGY",
  "HISTOPATHOLOGY",
];

const TESTS_BY_SECTION: Record<string, string[]> = {
  "BLOOD BANK": [
    "ABO Blood Typing",
    "Rh Typing",
    "Crossmatching",
    "Antibody Screening",
    "Infectious Disease Screening",
  ],
  HEMATOLOGY: [
    "CBC",
    "Hemoglobin",
    "Hematocrit",
    "WBC Count",
    "Platelet Count",
    "RBC Indices (MCV, MCH, RDW)",
    "Peripheral Blood Smear",
    "ESR",
    "PT/INR, PTT",
    "Clotting Time",
    "Bleeding Time",
    "Reticulocyte Count",
  ],
  "CLINICAL MICROSCOPY": [
    "Routine Urinalysis (UA)",
    "Routine Fecalysis (FA)",
    "Fecal Occult Blood Test",
    "Pregnancy Test (hCG)",
    "Pregnancy Test (PT)",
    "Semen Analysis",
    "KOH Mount",
    "Wet Mount",
  ],
  "CLINICAL CHEMISTRY": [
    "Lipid Profile",
    "Liver Function Test",
    "Renal Function Test",
    "Electrolytes",
    "Glucose & Diabetes Monitoring",
    "Arterial Blood Gas",
    "Fasting Blood Sugar (FBS)",
    "Random Blood Sugar (RBS)",
    "HbA1c",
    "Uric Acid",
    "Creatinine",
    "BUN",
    "Total Cholesterol",
    "Triglycerides",
    "HDL",
    "LDL",
  ],
  MICROBIOLOGY: [
    "Culture and Sensitivity",
    "Gram Staining",
    "AFB Smear",
    "India Ink",
    "KOH Preparation",
  ],
  "IMMUNOLOGY/SEROLOGY": [
    "HBsAg (Hepa B Surface Ag) - Qualitative",
    "Dengue NS1Ag",
    "Leptospirosis Test",
    "Syphilis Test (Qualitative)",
    "Typhidot Test (IgG, IgM)",
    "HIV Screening",
    "RPR/VDRL",
    "ANA",
    "RF (Rheumatoid Factor)",
    "C-Reactive Protein (CRP)",
    "PSA",
    "TSH",
    "Free T3 / T4",
  ],
  HISTOPATHOLOGY: [
    "Tissue Biopsy",
    "Skin Biopsy",
    "Kidney Biopsy",
    "Liver Biopsy Fibrosis",
    "Liver Biopsy Activity",
    "Bone Biopsy",
    "PAP Smear",
    "Fine Needle Aspiration Cytology (FNAC)",
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  birthdate?: string;
  sex?: string;
  patient_id_no?: string;
}

interface RequestedTest {
  section: string;
  test_name: string;
}

interface TestRequest {
  id: string;
  patient_id: string;
  patient_name: string;
  requesting_physician: string;
  requested_tests: RequestedTest[];
  sample_collection_datetime: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  notes?: string;
  created_by?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPatientFullName = (p: Patient): string => {
  if (p.full_name) return p.full_name;
  const parts = [p.first_name, p.middle_name, p.last_name].filter(Boolean);
  return parts.join(" ") || "Unknown";
};

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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    gradient: "from-yellow-400 to-yellow-600",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800",
    gradient: "from-blue-400 to-blue-600",
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    gradient: "from-[#3B6255] to-green-900",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    gradient: "from-red-400 to-red-600",
  },
};

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// In-memory mock store (only used when USE_MOCK_DATA=true)
let MOCK_TEST_REQUESTS: TestRequest[] = [];

// ─── Database helpers (mirrors pattern from database.ts) ──────────────────────

const fetchTestRequests = async (): Promise<TestRequest[]> => {
  if (USE_MOCK_DATA) {
    return [...MOCK_TEST_REQUESTS].reverse();
  }
  const { data, error } = await supabase
    .from("test_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching test requests:", error);
    return [];
  }
  return data || [];
};

const addTestRequest = async (
  payload: Omit<TestRequest, "id" | "created_at">,
  currentUser?: any
): Promise<TestRequest | null> => {
  if (USE_MOCK_DATA) {
    const newReq: TestRequest = {
      id: `tr-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    };
    MOCK_TEST_REQUESTS.push(newReq);
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || "Unknown User",
      encryption_key: currentUser?.encryption_key || "",
      action: "edit",
      resource: `Test Request - ${payload.patient_name}`,
      resource_type: "Test Request",
      description: `Created test request for ${payload.patient_name} with ${payload.requested_tests.length} test(s)`,
    });
    return newReq;
  }

  const { data, error } = await supabase
    .from("test_requests")
    .insert([payload])
    .select();
  if (error) {
    console.error("Error adding test request:", error);
    return null;
  }
  if (data?.[0]) {
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || "Unknown User",
      encryption_key: currentUser?.encryption_key || "",
      action: "edit",
      resource: `Test Request - ${payload.patient_name}`,
      resource_type: "Test Request",
      description: `Created test request for ${payload.patient_name} with ${payload.requested_tests.length} test(s)`,
    });
  }
  return data?.[0] || null;
};

const updateTestRequestStatus = async (
  id: string,
  status: TestRequest["status"],
  currentUser?: any
): Promise<boolean> => {
  if (USE_MOCK_DATA) {
    const idx = MOCK_TEST_REQUESTS.findIndex((r) => r.id === id);
    if (idx !== -1) MOCK_TEST_REQUESTS[idx].status = status;
    return true;
  }
  const { error } = await supabase
    .from("test_requests")
    .update({ status })
    .eq("id", id);
  if (error) {
    console.error("Error updating test request:", error);
    return false;
  }
  return true;
};

const deleteTestRequest = async (
  id: string,
  currentUser?: any
): Promise<boolean> => {
  if (USE_MOCK_DATA) {
    const idx = MOCK_TEST_REQUESTS.findIndex((r) => r.id === id);
    if (idx !== -1) {
      const req = MOCK_TEST_REQUESTS[idx];
      MOCK_TEST_REQUESTS.splice(idx, 1);
      await logActivity({
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || "Unknown User",
        encryption_key: currentUser?.encryption_key || "",
        action: "delete",
        resource: `Test Request - ${req.patient_name}`,
        resource_type: "Test Request",
        description: `Deleted test request for ${req.patient_name}`,
      });
    }
    return true;
  }
  const { data: reqData } = await supabase
    .from("test_requests")
    .select("patient_name")
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("test_requests")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("Error deleting test request:", error);
    return false;
  }
  if (reqData) {
    await logActivity({
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || "Unknown User",
      encryption_key: currentUser?.encryption_key || "",
      action: "delete",
      resource: `Test Request - ${reqData.patient_name}`,
      resource_type: "Test Request",
      description: `Deleted test request for ${reqData.patient_name}`,
    });
  }
  return true;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TestRequestPage() {
  const { user } = useAuth();

  // Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [testRequests, setTestRequests] = useState<TestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form visibility
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [physician, setPhysician] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSection, setSelectedSection] = useState(LAB_SECTIONS[0]);
  const [requestedTests, setRequestedTests] = useState<RequestedTest[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Expand row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();

    // Re-fetch patients when window regains focus — catches redirect from Patients page
    const handleFocus = () => {
      fetchPatients().then((pts) => setPatients(pts || []));
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [pts, reqs] = await Promise.all([
      fetchPatients(),
      fetchTestRequests(),
    ]);
    setPatients(pts || []);
    setTestRequests(reqs);
    setLoading(false);
  };

  // Reload patients every time the form is opened (catches newly registered patients)
  useEffect(() => {
    if (showForm) {
      fetchPatients().then((pts) => setPatients(pts || []));
    }
  }, [showForm]);

  // ── Patient search ───────────────────────────────────────────────────────────
  const filteredPatients = patients.filter((p) =>
    getPatientFullName(p)
      .toLowerCase()
      .includes(patientSearch.toLowerCase())
  );

  // ── Test selection ───────────────────────────────────────────────────────────
  const addTest = (testName: string) => {
    if (
      requestedTests.some(
        (t) => t.test_name === testName && t.section === selectedSection
      )
    )
      return;
    setRequestedTests([
      ...requestedTests,
      { section: selectedSection, test_name: testName },
    ]);
  };

  const removeTest = (index: number) => {
    setRequestedTests(requestedTests.filter((_, i) => i !== index));
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedPatient || !physician.trim() || requestedTests.length === 0)
      return;

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      patient_id: selectedPatient.id,
      patient_name: getPatientFullName(selectedPatient),
      requesting_physician: physician.trim(),
      requested_tests: requestedTests,
      sample_collection_datetime: new Date().toISOString(),
      status: "pending" as const,
      notes: notes.trim() || undefined,
      created_by: user?.full_name || user?.email || "Unknown",
    };

    const result = await addTestRequest(payload, user);

    if (!result) {
      setSubmitting(false);
      setSubmitError("Failed to submit. Please try again.");
      return;
    }

    // ── Auto-create billing records for each requested test ──────────────
    for (const t of requestedTests) {
      const price = getTestPrice(t.test_name, t.section) ?? 300;
      await addBilling({
        patient_name: payload.patient_name,
        test_name: t.test_name,
        section: t.section,
        amount: price,
        description: `Lab test: ${t.test_name}`,
      });
    }

    setSubmitting(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedPatient(null);
    setPatientSearch("");
    setPhysician("");
    setNotes("");
    setRequestedTests([]);
    setSelectedSection(LAB_SECTIONS[0]);
    setSubmitError(null);
    setShowPatientDropdown(false);
  };

  // ── Status update ────────────────────────────────────────────────────────────
  const handleStatusUpdate = async (
    id: string,
    status: TestRequest["status"]
  ) => {
    await updateTestRequestStatus(id, status, user);
    setTestRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await deleteTestRequest(id, user);
    setTestRequests((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);
    if (expandedId === id) setExpandedId(null);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filteredRequests = testRequests.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (
      filterSearch &&
      !r.patient_name.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !r.requesting_physician
        .toLowerCase()
        .includes(filterSearch.toLowerCase())
    )
      return false;
    return true;
  });

  // ── Shared input class ────────────────────────────────────────────────────────
  const inputCls =
    "w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white";

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8" style={{ animation: "fadeIn 0.5s ease-out" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.1s both" }}
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Test Requests</h1>
          <p className="text-gray-600 text-sm mt-1">
            Manage and create laboratory test requests for patients
          </p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchPatients().then((pts) => setPatients(pts || []))}
              className="px-4 py-3 border-2 border-[#3B6255] text-[#3B6255] rounded-lg hover:bg-[#F0F4F1] transition font-semibold flex items-center gap-2"
              title="Refresh patient list"
            >
              <Loader className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Test Request
            </button>
          </div>
        )}
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.2s both" }}
      >
        {(["pending", "in_progress", "completed", "cancelled"] as const).map(
          (status, i) => {
            const count = testRequests.filter(
              (r) => r.status === status
            ).length;
            const cfg = STATUS_CONFIG[status];
            const icons = [Clock, Loader, CheckCircle, XCircle];
            const Icon = icons[i];
            return (
              <div
                key={status}
                className={`bg-gradient-to-br ${cfg.gradient} text-white rounded-lg shadow-lg p-5`}
                style={{
                  animation: `fadeInScale 0.5s ease-out ${0.25 + i * 0.05}s both`,
                }}
              >
                <Icon className="w-7 h-7 mb-3 opacity-90" />
                <p className="text-sm opacity-90">{cfg.label}</p>
                <p className="text-3xl font-bold">{count}</p>
              </div>
            );
          }
        )}
      </div>

      {/* ── New Request Form ───────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]"
          style={{ animation: "fadeInScale 0.4s ease-out" }}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#3B6255]" />
            New Test Request
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Patient Search */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Patient <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={
                    selectedPatient
                      ? getPatientFullName(selectedPatient)
                      : patientSearch
                  }
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setSelectedPatient(null);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowPatientDropdown(false), 150)
                  }
                  placeholder="Search patient name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white"
                />
              </div>
              {showPatientDropdown && !selectedPatient && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredPatients.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      <p>No patients found.</p>
                      <p className="text-xs mt-1 text-[#3B6255]">
                        If a patient was just registered, close this form and click <strong>Refresh</strong>.
                      </p>
                    </div>
                  ) : (
                    filteredPatients.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        onMouseDown={() => {
                          setSelectedPatient(p);
                          setPatientSearch(getPatientFullName(p));
                          setShowPatientDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-[#F0F4F1] transition text-sm border-b border-gray-100 last:border-0"
                      >
                        <p className="font-medium text-gray-800">
                          {getPatientFullName(p)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {p.patient_id_no && `ID: ${p.patient_id_no}`}
                          {p.birthdate &&
                            ` · DOB: ${new Date(p.birthdate).toLocaleDateString("en-US")}`}
                          {p.sex && ` · ${p.sex}`}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Requesting Physician */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Stethoscope className="w-4 h-4 inline mr-1" />
                Requesting Physician <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={physician}
                onChange={(e) => setPhysician(e.target.value)}
                placeholder="e.g. Dr. Juan Dela Cruz"
                className={inputCls}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Fasting required, STAT request..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Test Selection */}
          <div className="border border-gray-200 rounded-lg p-5 mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#3B6255]" />
              Select Tests <span className="text-red-500">*</span>
            </h3>

            {/* Section Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {LAB_SECTIONS.map((section) => (
                <button
                  key={section}
                  onClick={() => setSelectedSection(section)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    selectedSection === section
                      ? "bg-[#3B6255] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-[#CBDED3] hover:text-[#3B6255]"
                  }`}
                >
                  {section}
                </button>
              ))}
            </div>

            {/* Tests Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-5">
              {(TESTS_BY_SECTION[selectedSection] || []).map((test) => {
                const alreadyAdded = requestedTests.some(
                  (t) =>
                    t.test_name === test && t.section === selectedSection
                );
                return (
                  <button
                    key={test}
                    onClick={() => addTest(test)}
                    disabled={alreadyAdded}
                    className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition border ${
                      alreadyAdded
                        ? "bg-[#CBDED3] text-[#3B6255] border-[#3B6255] cursor-default"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#3B6255] hover:bg-[#F0F4F1]"
                    }`}
                  >
                    {alreadyAdded ? (
                      <Check className="w-3 h-3 inline mr-1" />
                    ) : (
                      <span className="mr-1">+</span>
                    )}
                    {test}
                  </button>
                );
              })}
            </div>

            {/* Selected Tests */}
            {requestedTests.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                  Selected Tests ({requestedTests.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {requestedTests.map((t, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B6255] text-white rounded-full text-xs font-medium"
                    >
                      <span className="opacity-60 text-[10px] uppercase">
                        {t.section.split(" ")[0]}
                      </span>
                      <span>{t.test_name}</span>
                      <button
                        onClick={() => removeTest(i)}
                        className="ml-1 opacity-70 hover:opacity-100 transition text-sm leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Validation message */}
          {submitError && (
            <p className="text-sm text-red-600 mb-4 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
              ✕ {submitError}
            </p>
          )}
          {(!selectedPatient ||
            !physician.trim() ||
            requestedTests.length === 0) && (
            <p className="text-xs text-gray-500 mb-4">
              <span className="text-red-500">*</span> Patient, requesting
              physician, and at least one test are required.
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !selectedPatient ||
                !physician.trim() ||
                requestedTests.length === 0
              }
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {submitting ? "Submitting..." : "Submit Test Request"}
            </button>
            <button
              onClick={resetForm}
              disabled={submitting}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-lg shadow-lg p-6"
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.4s both" }}
      >
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Filter Records
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={inputCls}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search Patient / Physician
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Requests Table ────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-lg shadow-lg overflow-hidden"
        style={{ animation: "fadeInSlideUp 0.6s ease-out 0.5s both" }}
      >
        <div className="px-8 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            Test Request Records ({filteredRequests.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">
                    Patient
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">
                    Physician
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">
                    Tests
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const cfg = STATUS_CONFIG[req.status];
                  const isExpanded = expandedId === req.id;
                  return (
                    <React.Fragment key={req.id}>
                      <tr
                        className="border-b border-gray-100 hover:bg-[#F0F4F1] transition cursor-pointer"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : req.id)
                        }
                      >
                        <td className="py-4 px-6 font-medium text-gray-800">
                          {req.patient_name}
                        </td>
                        <td className="py-4 px-6 text-gray-600 text-sm">
                          {req.requesting_physician}
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-1 bg-[#CBDED3] text-[#3B6255] rounded-full text-xs font-semibold">
                            {req.requested_tests?.length ?? 0} test
                            {(req.requested_tests?.length ?? 0) !== 1
                              ? "s"
                              : ""}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td
                          className="py-4 px-6"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            {req.status === "pending" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(req.id, "in_progress")
                                }
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition"
                              >
                                Start
                              </button>
                            )}
                            {req.status === "in_progress" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(req.id, "completed")
                                }
                                className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition"
                              >
                                Complete
                              </button>
                            )}
                            {(req.status === "pending" ||
                              req.status === "in_progress") && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(req.id, "cancelled")
                                }
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition"
                              >
                                Cancel
                              </button>
                            )}
                            {/* Delete */}
                            {deleteConfirmId === req.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(req.id)}
                                  className="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-semibold hover:bg-gray-300 transition"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(req.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                title="Delete request"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {/* Expand toggle */}
                            <button className="p-1 text-gray-400 hover:text-[#3B6255] transition">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr
                          className="bg-[#F8FBF9] border-b border-gray-200"
                        >
                          <td colSpan={5} className="px-8 py-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">
                                  Requested Tests (
                                  {req.requested_tests?.length ?? 0})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {(req.requested_tests || []).map((t, i) => (
                                    <span
                                      key={i}
                                      className="px-3 py-1.5 bg-white border border-[#CBDED3] text-[#3B6255] rounded-full text-xs font-medium"
                                    >
                                      <span className="text-gray-400 mr-1 uppercase">
                                        [{t.section.split(" ")[0]}]
                                      </span>
                                      {t.test_name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2 text-sm text-gray-600">
                                <p>
                                  <span className="font-semibold">
                                    Date Requested:
                                  </span>{" "}
                                  {formatDateTime(req.created_at)}
                                </p>
                                {req.created_by && (
                                  <p>
                                    <span className="font-semibold">
                                      Requested by:
                                    </span>{" "}
                                    {req.created_by}
                                  </p>
                                )}
                                {req.notes && (
                                  <p>
                                    <span className="font-semibold">
                                      Notes:
                                    </span>{" "}
                                    {req.notes}
                                  </p>
                                )}
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

            {filteredRequests.length === 0 && !loading && (
              <div className="p-12 text-center text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No test requests found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Workflow Note ─────────────────────────────────────────────────── */}
      <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-6 rounded-lg">
        <h3 className="font-semibold text-[#3B6255] mb-2">
          📋 Workflow Reminder
        </h3>
        <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside">
          <li>
            Test Requests must be submitted before proceeding to Billing
          </li>
          <li>
            Each request records the patient, physician, tests, and sample
            collection time
          </li>
          <li>Status flow: Pending → In Progress → Completed</li>
          <li>
            Cancelled requests cannot be reactivated — create a new request
            instead
          </li>
        </ul>
      </div>
    </div>
  );
}