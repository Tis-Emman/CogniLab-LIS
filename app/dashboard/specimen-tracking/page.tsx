"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FlaskConical,
  CheckCircle,
  Clock,
  Loader,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  User,
  Calendar,
  Microscope,
  Droplets,
  TestTube,
  ScanLine,
  BadgeCheck,
  X,
  Edit2,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import {
  addTestResult,
  updateTestResult,
  fetchPatients,
  logActivity,
} from "@/lib/database";
import { TEST_REFERENCE_RANGES } from "@/lib/mockData";

// ─── Pipeline definition ──────────────────────────────────────────────────────

const PIPELINE = [
  {
    key: "pending_accession",
    label: "Pending Accession",
    sublabel: "Awaiting specimen registration",
    icon: Clock,
    color: "#94A3B8",
    fill: "#F1F5F9",
    textDark: "#475569",
  },
  {
    key: "collection_in_progress",
    label: "Collection In-Progress",
    sublabel: "Sample collection underway",
    icon: Droplets,
    color: "#F59E0B",
    fill: "#FFFBEB",
    textDark: "#92400E",
  },
  {
    key: "sample_collected",
    label: "Sample Collected",
    sublabel: "Successfully collected from patient",
    icon: TestTube,
    color: "#3B82F6",
    fill: "#EFF6FF",
    textDark: "#1E40AF",
  },
  {
    key: "sample_received",
    label: "Sample Received",
    sublabel: "Received and logged at laboratory",
    icon: ScanLine,
    color: "#8B5CF6",
    fill: "#F5F3FF",
    textDark: "#5B21B6",
  },
  {
    key: "analytical",
    label: "Analytical Phase",
    sublabel: "Analysis in progress",
    icon: Microscope,
    color: "#F97316",
    fill: "#FFF7ED",
    textDark: "#9A3412",
  },
  {
    key: "test_complete",
    label: "Test Complete",
    sublabel: "Ready for result encoding",
    icon: BadgeCheck,
    color: "#3B6255",
    fill: "#F0F9F4",
    textDark: "#14532D",
  },
] as const;

type SpecimenStatus = (typeof PIPELINE)[number]["key"];

const PIPELINE_INDEX: Record<string, number> = Object.fromEntries(
  PIPELINE.map((s, i) => [s.key, i])
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpecimenRecord {
  id: string;
  patient_name: string;
  patient_id?: string;
  test_name: string;
  section: string;
  status: SpecimenStatus;
  collected_by?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  sample_collected_at?: string;
  sample_received_at?: string;
  test_request_id?: string;
  billing_id?: string;
}

// ─── Test Result Form constants (mirrored from test-results/page.tsx) ─────────

const LAB_SECTIONS = [
  "BLOOD BANK",
  "HEMATOLOGY",
  "CLINICAL MICROSCOPY",
  "CLINICAL CHEMISTRY",
  "MICROBIOLOGY",
  "IMMUNOLOGY/SEROLOGY",
  "HISTOPATHOLOGY",
];

const TESTS_BY_SECTION: Record<string, { name: string; referenceRange: string; unit: string }[]> =
  Object.keys(TEST_REFERENCE_RANGES).reduce((acc, section) => {
    acc[section] = Object.entries(TEST_REFERENCE_RANGES[section]).map(
      ([testName, range]: [string, any]) => ({
        name: testName,
        referenceRange: range.normal || `${range.min || ""} - ${range.max || ""}`,
        unit: range.unit,
      })
    );
    return acc;
  }, {} as Record<string, { name: string; referenceRange: string; unit: string }[]>);

const TEST_DROPDOWN_OPTIONS: Record<string, string[]> = {
  "ABO Blood Typing": ["Type A", "Type B", "Type AB", "Type O"],
  "Rh Typing": ["Rh Positive (D+)", "Rh Negative (D-)"],
  Crossmatching: ["Compatible", "Incompatible", "Least Compatible"],
  "Antibody Screening": ["Positive", "Negative"],
  "Infectious Disease Screening": ["Non-Reactive for any infectious disease", "Reactive for HIV", "Reactive for HBV", "Reactive for HCV", "Reactive for Syphilis", "Reactive for Malaria"],
  "Gram Staining": ["Negative/Normal", "Positive - Gram Positive Cocci", "Positive - Gram Positive Bacilli", "Positive - Gram Negative Cocci", "Positive - Gram Negative Bacilli"],
  "India Ink": ["Positive (Encapsulated yeast cells seen)", "Negative (No encapsulated yeast cells seen)"],
  "Wet Mount": ["Normal/Negative", "Abnormal"],
  "KOH Mount": ["Negative", "Positive"],
  "Pregnancy Test (hCG)": ["Negative", "Positive"],
  "Pregnancy Test (PT)": ["Positive", "Negative", "Invalid"],
  "HBsAg (Hepa B Surface Ag) - Qualitative": ["Positive/Reactive", "Negative/Non-reactive"],
  "Dengue NS1Ag": ["Positive/Reactive", "Negative/Non-reactive"],
  "Leptospirosis Test": ["Positive/Reactive", "Negative/Non-reactive"],
  "Syphilis Test (Qualitative)": ["Positive/Reactive", "Negative/Non-reactive"],
  "Typhidot Test (IgG, IgM)": ["Positive/Reactive", "Negative/Non-reactive"],
  "HIV Screening": ["Positive/Reactive", "Negative/Non-reactive"],
  "RPR/VDRL": ["Positive/Reactive", "Negative/Non-reactive"],
  "Fecal Occult Blood Test": ["Negative", "Positive"],
  "Routine Fecalysis (FA)": ["No Ova or Parasite seen", "Scant/Few Ova or Parasite seen", "Moderate Ova or Parasite seen", "Many/Numerous Ova or Parasite seen"],
  "Liver Biopsy Fibrosis": ["F0: No fibrosis (Healthy)", "F1: Portal fibrosis without septa (Mild fibrosis)", "F2: Portal fibrosis with few septa (Moderate/Significant fibrosis)", "F3: Numerous septa without cirrhosis (Severe fibrosis)", "F4: Cirrhosis (Advanced scarring)"],
  "Liver Biopsy Activity": ["A0: No activity", "A1: Minimal/mild activity", "A2: Moderate activity", "A3: Severe activity"],
};

const MULTI_FIELD_TESTS = [
  "CBC", "RBC Indices (MCV, MCH, RDW)", "Hemoglobin", "PT/INR, PTT",
  "Routine Urinalysis (UA)", "Culture and Sensitivity", "Routine Fecalysis (FA)",
  "Lipid Profile", "Liver Function Test", "Renal Function Test",
  "Electrolytes", "Glucose & Diabetes Monitoring", "Arterial Blood Gas",
];

const CC_GROUPED_TEST_NAMES = [
  "Lipid Profile", "Liver Function Test", "Renal Function Test",
  "Electrolytes", "Glucose & Diabetes Monitoring", "Arterial Blood Gas",
];

const LIPID_PROFILE_TESTS = [
  { name: "Total Cholesterol", referenceRange: "< 200 mg/dL", unit: "mg/dL" },
  { name: "Triglycerides", referenceRange: "40 - 150 mg/dL", unit: "mg/dL" },
  { name: "HDL", referenceRange: "> 60 mg/dL", unit: "mg/dL" },
  { name: "LDL", referenceRange: "< 100 mg/dL", unit: "mg/dL" },
];

const LIVER_FUNCTION_TESTS = [
  { name: "Total Bilirubin", referenceRange: "0.0 - 1.0 mg/dL", unit: "mg/dL" },
  { name: "Direct Bilirubin", referenceRange: "0.0 - 0.4 mg/dL", unit: "mg/dL" },
  { name: "Indirect Bilirubin", referenceRange: "0.2 - 0.8 mg/dL", unit: "mg/dL" },
  { name: "SGOT / AST (Female)", referenceRange: "9 - 25 U/L", unit: "U/L" },
  { name: "SGOT / AST (Male)", referenceRange: "10 - 40 U/L", unit: "U/L" },
  { name: "SGPT / ALT (Female)", referenceRange: "7 - 30 U/L", unit: "U/L" },
  { name: "SGPT / ALT (Male)", referenceRange: "10 - 55 U/L", unit: "U/L" },
  { name: "Total Protein", referenceRange: "6.4 - 8.3 g/dL", unit: "g/dL" },
  { name: "Total Protein A/G Ratio (TPAG)", referenceRange: "", unit: "" },
  { name: "Albumin (Adults)", referenceRange: "3.5 - 5 g/dL", unit: "g/dL" },
  { name: "Albumin (Children)", referenceRange: "3.4 - 4.2 g/dL", unit: "g/dL" },
  { name: "Alkaline Phosphatase ALP (Female)", referenceRange: "30 - 100 U/L", unit: "U/L" },
  { name: "Alkaline Phosphatase ALP (Male)", referenceRange: "45 - 115 U/L", unit: "U/L" },
];

const RENAL_FUNCTION_TESTS = [
  { name: "Blood Urea Nitrogen (BUN)", referenceRange: "8 - 23 mg/dL", unit: "mg/dL" },
  { name: "Blood Uric Acid (BUA)", referenceRange: "4 - 8 mg/dL", unit: "mg/dL" },
  { name: "Creatinine (Male)", referenceRange: "0.7 - 1.3 mg/dL", unit: "mg/dL" },
  { name: "Creatinine (Female)", referenceRange: "0.6 - 1.1 mg/dL", unit: "mg/dL" },
  { name: "eGFR", referenceRange: "", unit: "mL/min/1.73m²" },
  { name: "Blood Urea Nitrogen/Creatinine Ratio", referenceRange: "", unit: "" },
];

const ELECTROLYTES_TESTS = [
  { name: "Sodium (Na+)", referenceRange: "135 - 145 mmol/L", unit: "mmol/L" },
  { name: "Potassium (K+)", referenceRange: "3.4 - 5.0 mmol/L", unit: "mmol/L" },
  { name: "Chloride (Cl-)", referenceRange: "95 - 108 mmol/L", unit: "mmol/L" },
  { name: "Bicarbonate", referenceRange: "22 - 28 mEq/L", unit: "mEq/L" },
  { name: "Calcium – Total (Ca++)", referenceRange: "8.5 - 10.5 mg/dL", unit: "mg/dL" },
  { name: "Phosphorus", referenceRange: "3.0 - 4.5 mmol/L", unit: "mmol/L" },
  { name: "Magnesium (Mg++)", referenceRange: "1.8 - 3 mmol/L", unit: "mmol/L" },
];

const GLUCOSE_TESTS = [
  { name: "Random Blood Sugar (RBS)", referenceRange: "< 140 mg/dL", unit: "mg/dL" },
  { name: "Fasting Blood Sugar (FBS)", referenceRange: "70 - 110 mg/dL", unit: "mg/dL" },
  { name: "Oral Glucose Tolerance Test (OGTT) 100g", referenceRange: "< 140 mg/dL", unit: "mg/dL" },
  { name: "Oral Glucose Tolerance Test (OGTT) 75g", referenceRange: "< 140 mg/dL", unit: "mg/dL" },
  { name: "Oral Glucose Challenge Test (OGCT) 50g", referenceRange: "< 140 mg/dL", unit: "mg/dL" },
  { name: "Hemoglobin A1c (HBA1c)", referenceRange: "< 5.7%", unit: "%" },
];

const ABG_TESTS = [
  { name: "ABG pH", referenceRange: "7.35 - 7.45", unit: "" },
  { name: "pCO2", referenceRange: "35 - 45 mmHg", unit: "mmHg" },
  { name: "PO2", referenceRange: "80 - 100 mmHg", unit: "mmHg" },
  { name: "SaO2", referenceRange: "> 90%", unit: "%" },
  { name: "HCO3-", referenceRange: "22 - 26 mEq/L", unit: "mEq/L" },
];

const HEMATOLOGY_HIDDEN = [
  "Neutrophils","Lymphocytes","Monocytes","Eosinophils","Basophils",
  "PT","INR","aPTT","PT/INR/aPTT","ESR (Male)","ESR (Female)",
  "Hematocrit","Hematocrit (Male)","Hematocrit (Female)",
  "Hemoglobin","Hemoglobin (Male)","Hemoglobin (Female)",
  "MCH","MCV","Platelet Count","RBC Indices (MCV, MCH, RDW)","RDW","WBC Count",
];

const CC_HIDDEN_INDIVIDUAL = [
  "Total Cholesterol","Triglycerides","HDL","LDL",
  "Total Bilirubin","Direct Bilirubin","Indirect Bilirubin","SGOT / AST","SGPT / ALT",
  "Total Protein","Total Protein A/G Ratio (TPAG)","Albumin","Alkaline Phosphatase (ALP)",
  "Blood Urea Nitrogen (BUN)","Blood Uric Acid (BUA)","Creatinine","eGFR","Blood Urea Nitrogen/Creatinine Ratio",
  "Sodium (Na+)","Potassium (K+)","Chloride (Cl-)","Bicarbonate","Calcium – Total (Ca++)",
  "Phosphorus","Magnesium (Mg++)",
  "Random Blood Sugar (RBS)","Fasting Blood Sugar (FBS)",
  "Oral Glucose Tolerance Test (OGTT) 100g","Oral Glucose Tolerance Test (OGTT) 75g",
  "Oral Glucose Challenge Test (OGCT) 50g","Hemoglobin A1c (HBA1c)",
  "ABG pH","pCO2","PO2","SaO2","HCO3-",
];

const INITIAL_ELECTROLYTES = { sodium: "", potassium: "", chloride: "", bicarbonate: "", calcium: "", phosphorus: "", magnesium: "" };
const INITIAL_ABG = { pH: "", pco2: "", po2: "", sao2: "", hco3: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDT = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila",
  });

// ─── Vertical Timeline ────────────────────────────────────────────────────────

function SpecimenTimeline({
  currentStatus, specimenId, onAdvance, isUpdating,
}: {
  currentStatus: SpecimenStatus;
  specimenId: string;
  onAdvance: (id: string, next: SpecimenStatus) => void;
  isUpdating: boolean;
}) {
  const currentIdx = PIPELINE_INDEX[currentStatus];
  const isComplete = currentStatus === "test_complete";

  return (
    <div className="relative">
      {PIPELINE.map((step, idx) => {
        const Icon = step.icon;
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isNext = idx === currentIdx + 1;
        const isLast = idx === PIPELINE.length - 1;

        return (
          <div key={step.key} className="flex gap-4 relative">
            {!isLast && (
              <div className="absolute left-[16px] top-[36px] w-[2px] z-0 transition-all duration-500"
                style={{ height: "calc(100% - 4px)", background: isDone ? "linear-gradient(to bottom, #3B6255, #3B625566)" : "#E2E8F0" }} />
            )}
            <div className="relative z-10 flex-shrink-0 mt-0.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: isDone ? "#3B6255" : isCurrent ? step.color : "#E2E8F0",
                  boxShadow: isCurrent ? `0 0 0 4px ${step.color}28` : "none",
                }}>
                {isDone
                  ? <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                  : <Icon className="w-3.5 h-3.5" style={{ color: isCurrent ? "#fff" : "#CBD5E1" }} strokeWidth={2} />}
              </div>
            </div>
            <div className={`flex-1 pb-6 flex items-start justify-between gap-2 ${isLast ? "pb-1" : ""}`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold"
                    style={{ color: isDone ? "#3B6255" : isCurrent ? step.textDark : "#94A3B8" }}>
                    {step.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: step.color + "22", color: step.color }}>
                      Active
                    </span>
                  )}
                  {isDone && <span className="text-[10px] font-semibold text-[#3B6255] opacity-60">✓ Done</span>}
                </div>
                <p className="text-xs mt-0.5" style={{ color: isCurrent ? step.color + "99" : "#CBD5E1" }}>
                  {step.sublabel}
                </p>
              </div>
              {isCurrent && !isComplete && (
                <button
                  onClick={() => { const next = PIPELINE[idx + 1]; if (next) onAdvance(specimenId, next.key as SpecimenStatus); }}
                  disabled={isUpdating}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: step.color }}>
                  {isUpdating ? <Loader className="w-3 h-3 animate-spin" /> : <>Advance <ArrowRight className="w-3 h-3" /></>}
                </button>
              )}
              {isNext && !isComplete && (
                <span className="flex-shrink-0 text-[10px] text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-lg font-medium">Up next</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Test Result Form (popup) ─────────────────────────────────────────────────

function TestResultForm({
  specimen,
  onClose,
  onSaved,
  patientSex,
}: {
  specimen: SpecimenRecord;
  onClose: () => void;
  onSaved: () => void;
  patientSex?: "Male" | "Female" | null;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const submittedRef = useRef(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState(specimen.section || "");
  const [selectedTest, setSelectedTest] = useState(specimen.test_name || "");
  const [resultValue, setResultValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Multi-field states
  const [cbcValues, setCbcValues] = useState({ neutrophils: "", lymphocytes: "", monocytes: "", eosinophils: "", basophils: "" });
  const [cbcRbcValues, setCbcRbcValues] = useState({ mcv: "", mch: "", rdw: "" });
  const [cbcHemoglobinValue, setCbcHemoglobinValue] = useState("");
  const [cbcHematocritValue, setCbcHematocritValue] = useState("");
  const [cbcPeripheralSmearValue, setCbcPeripheralSmearValue] = useState("");
  const [cbcPlateletCountValue, setCbcPlateletCountValue] = useState("");
  const [rbcValues, setRbcValues] = useState({ mcv: "", mch: "", rdw: "" });
  const [hemoglobinValue, setHemoglobinValue] = useState("");
  const [coagulationValues, setCoagulationValues] = useState({ pt: "", inr: "", aptt: "" });
  const [urinalysisValues, setUrinalysisValues] = useState({ color: "", transparency: "", pH: "", proteinGlucose: "", bilirubinKetone: "", urobilinogen: "", wbcMicroscopic: "", rbcMicroscopic: "", bacteriaCastsCrystals: "" });
  const [cultureSensitivityValues, setCultureSensitivityValues] = useState({ culture: "", preliminaryReport: "", finalReport: "", sensitivity: "" });
  const [fecalysisColor, setFecalysisColor] = useState("");
  const [fecalysisOva, setFecalysisOva] = useState("");
  const [fecalysisParasiteName, setFecalysisParasiteName] = useState("");
  const [lipidSubTest, setLipidSubTest] = useState("");
  const [lipidValue, setLipidValue] = useState("");
  const [lftSubTest, setLftSubTest] = useState("");
  const [lftValue, setLftValue] = useState("");
  const [rftSubTest, setRftSubTest] = useState("");
  const [rftValue, setRftValue] = useState("");
  const [glucoseSubTest, setGlucoseSubTest] = useState("");
  const [glucoseValue, setGlucoseValue] = useState("");
  const [electrolytesValues, setElectrolytesValues] = useState(INITIAL_ELECTROLYTES);
  const [abgValues, setAbgValues] = useState(INITIAL_ABG);

  useEffect(() => {
    if (patientSex !== undefined) return; // sex already resolved by parent, skip fetch
    fetchPatients().then((data) => {
      console.debug("[SpecimenTracking] fetchPatients returned", data.length, "patients");
      if (data.length > 0) {
        console.debug("[SpecimenTracking] Patient record keys:", Object.keys(data[0]));
        console.debug("[SpecimenTracking] First patient sample:", JSON.stringify(data[0]));
      } else {
        console.warn("[SpecimenTracking] fetchPatients returned EMPTY array — check DB/mock flag");
      }
      console.debug("[SpecimenTracking] Looking for specimen.patient_name:", JSON.stringify(specimen.patient_name));
      console.debug("[SpecimenTracking] specimen.patient_id:", specimen.patient_id);
      setPatients(data);
    });
  }, []);

  const selectedPatient = patients.find((p) => {
    const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim().toLowerCase();
    const altName = (p.full_name ?? "").trim().toLowerCase();
    const target = specimen.patient_name.trim().toLowerCase();
    const byId = !!(specimen.patient_id && p.id === specimen.patient_id);
    const byName = fullName === target || altName === target;
    if (byId || byName) {
      console.debug("[SpecimenTracking] ✅ Patient MATCHED:", { byId, byName, patient: JSON.stringify(p) });
    }
    return byId || byName;
  });

  // Log when no match found after patients load
  useEffect(() => {
    if (patients.length > 0 && !selectedPatient) {
      console.warn(
        "[SpecimenTracking] ❌ No patient match for:",
        JSON.stringify(specimen.patient_name),
        "| patient_id:", specimen.patient_id,
        "| Available:",
        patients.map((p) => `"${p.first_name ?? ""} ${p.last_name ?? ""}" / "${p.full_name ?? ""}" (id:${p.id})`).join(", ")
      );
    }
  }, [patients, selectedPatient]);

  const selectedPatientSex: "Male" | "Female" | null =
    patientSex !== undefined
      ? patientSex ?? null
      : selectedPatient?.sex === "Male" || selectedPatient?.sex === "Female"
        ? selectedPatient.sex : null;

  const getFilteredTests = (section: string) => {
    let base = (TESTS_BY_SECTION[section] || []).filter((t) => {
      if (section === "HEMATOLOGY" && HEMATOLOGY_HIDDEN.includes(t.name)) return false;
      if (section === "CLINICAL CHEMISTRY" && CC_HIDDEN_INDIVIDUAL.includes(t.name)) return false;
      return true;
    });
    if (section === "CLINICAL CHEMISTRY") {
      base = [...CC_GROUPED_TEST_NAMES.map((name) => ({ name, referenceRange: "", unit: "" })), ...base];
    }
    return base;
  };

  const currentTests = selectedSection ? getFilteredTests(selectedSection) : [];

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-400 bg-white text-sm ${err ? "border-red-400" : "border-gray-300"}`;
  const selectCls = (err?: string) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white text-sm ${err ? "border-red-400" : "border-gray-300"}`;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedSection) e.section = "Section is required";
    if (!selectedTest) e.test = "Test is required";
    if (selectedTest === "CBC") {
      if (!cbcValues.neutrophils || !cbcValues.lymphocytes || !cbcValues.monocytes || !cbcValues.eosinophils || !cbcValues.basophils) e.cbc = "All CBC differential components are required";
      if (!cbcRbcValues.mcv || !cbcRbcValues.mch || !cbcRbcValues.rdw) e.rbc = "MCV, MCH, and RDW are required";
      if (!cbcHemoglobinValue) e.hemoglobin = "Hemoglobin is required";
      if (!cbcHematocritValue) e.hematocrit = "Hematocrit is required";
      if (!cbcPlateletCountValue) e.platelet = "Platelet count is required";
    } else if (selectedTest === "RBC Indices (MCV, MCH, RDW)") {
      if (!rbcValues.mcv || !rbcValues.mch || !rbcValues.rdw) e.rbc = "All RBC indices are required";
    } else if (selectedTest === "Hemoglobin") {
      if (!hemoglobinValue) e.hemoglobin = "Hemoglobin value is required";
    } else if (selectedTest === "PT/INR, PTT") {
      if (!coagulationValues.pt || !coagulationValues.inr || !coagulationValues.aptt) e.coagulation = "All coagulation values are required";
    } else if (selectedTest === "Routine Urinalysis (UA)") {
      const vals = Object.values(urinalysisValues);
      if (vals.some((v) => !v)) e.urinalysis = "All urinalysis components are required";
    } else if (selectedTest === "Culture and Sensitivity") {
      if (!cultureSensitivityValues.culture || !cultureSensitivityValues.preliminaryReport || !cultureSensitivityValues.finalReport || !cultureSensitivityValues.sensitivity) e.cultureSensitivity = "All culture and sensitivity fields are required";
    } else if (selectedTest === "Routine Fecalysis (FA)") {
      if (!fecalysisColor) e.fecalysis = "Color is required";
      else if (!fecalysisOva) e.fecalysis = "Ova/Parasite result is required";
      else if (fecalysisOva !== "No Ova or Parasite seen" && !fecalysisParasiteName) e.fecalysis = "Name of Ova/Parasite is required";
    } else if (selectedTest === "Lipid Profile") {
      if (!lipidSubTest) e.lipid = "Please select a sub-test";
      else if (!lipidValue) e.lipid = "Result value is required";
    } else if (selectedTest === "Liver Function Test") {
      if (!lftSubTest) e.lft = "Please select a sub-test";
      else if (!lftValue) e.lft = "Result value is required";
    } else if (selectedTest === "Renal Function Test") {
      if (!rftSubTest) e.rft = "Please select a sub-test";
      else if (!rftValue) e.rft = "Result value is required";
    } else if (selectedTest === "Glucose & Diabetes Monitoring") {
      if (!glucoseSubTest) e.glucose = "Please select a sub-test";
      else if (!glucoseValue) e.glucose = "Result value is required";
    } else if (selectedTest === "Electrolytes") {
      if (Object.values(electrolytesValues).some((v) => !v)) e.electrolytes = "All electrolyte values are required";
    } else if (selectedTest === "Arterial Blood Gas") {
      if (Object.values(abgValues).some((v) => !v)) e.abg = "All ABG values are required";
    } else {
      if (!resultValue) e.resultValue = "Result value is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    if (submittedRef.current) return; // prevent duplicate insert
    submittedRef.current = true;
    setSubmitting(true);

    try {
      const sexLabel = selectedPatientSex || "Male";
      const testDetails = currentTests.find((t) => t.name === selectedTest);
      const base = { patient_name: specimen.patient_name, section: selectedSection };

      if (selectedTest === "CBC") {
        const cbcLines = [
          `Neutrophils: ${cbcValues.neutrophils}%`,
          `Lymphocytes: ${cbcValues.lymphocytes}%`,
          `Monocytes: ${cbcValues.monocytes}%`,
          `Eosinophils: ${cbcValues.eosinophils}%`,
          `Basophils: ${cbcValues.basophils}%`,
          `MCV: ${cbcRbcValues.mcv} fL`,
          `MCH: ${cbcRbcValues.mch} pg`,
          `RDW: ${cbcRbcValues.rdw} %`,
          `Hemoglobin (${sexLabel}): ${cbcHemoglobinValue} g/dL`,
          `Hematocrit (${sexLabel}): ${cbcHematocritValue} %`,
          `Platelet Count: ${cbcPlateletCountValue} x10^9/L`,
          ...(cbcPeripheralSmearValue ? [`Peripheral Blood Smear: ${cbcPeripheralSmearValue}`] : []),
        ];
        await addTestResult({ ...base, test_name: "CBC", result_value: cbcLines.join("\n"), reference_range: "", unit: "" }, user, true);
      } else if (selectedTest === "RBC Indices (MCV, MCH, RDW)") {
        for (const c of [{ name: "MCV", value: rbcValues.mcv, range: "80 - 100", unit: "fL" }, { name: "MCH", value: rbcValues.mch, range: "27 - 31", unit: "pg" }, { name: "RDW", value: rbcValues.rdw, range: "11.5 - 14.5", unit: "%" }])
          await addTestResult({ ...base, test_name: c.name, result_value: c.value, reference_range: c.range, unit: c.unit }, user, true);
      } else if (selectedTest === "Hemoglobin") {
        const testName = sexLabel === "Male" ? "Hemoglobin (Male)" : "Hemoglobin (Female)";
        const referenceRange = sexLabel === "Male" ? "14.0 - 17.0" : "12.0 - 15.0";
        await addTestResult({ ...base, test_name: testName, result_value: hemoglobinValue, reference_range: referenceRange, unit: "g/dL" }, user, true);
      } else if (selectedTest === "PT/INR, PTT") {
        const coagLines = [`PT: ${coagulationValues.pt} seconds`, `INR: ${coagulationValues.inr}`, `aPTT: ${coagulationValues.aptt} seconds`];
        await addTestResult({ ...base, test_name: "PT/INR, PTT", result_value: coagLines.join("\n"), reference_range: "", unit: "" }, user, true);
      } else if (selectedTest === "Routine Urinalysis (UA)") {
        const resultString = [`Color: ${urinalysisValues.color}`, `Transparency: ${urinalysisValues.transparency}`, `pH (Urine): ${urinalysisValues.pH}`, `Protein/Glucose: ${urinalysisValues.proteinGlucose}`, `Bilirubin/Ketone: ${urinalysisValues.bilirubinKetone}`, `Urobilinogen: ${urinalysisValues.urobilinogen} IEU/dL`, `WBC (Microscopic): ${urinalysisValues.wbcMicroscopic} hpf`, `RBC (Microscopic): ${urinalysisValues.rbcMicroscopic} hpf`, `Bacteria/Casts/Crystals: ${urinalysisValues.bacteriaCastsCrystals}`].join("\n");
        await addTestResult({ ...base, test_name: "Routine Urinalysis (UA)", result_value: resultString, reference_range: "", unit: "" }, user, true);
      } else if (selectedTest === "Culture and Sensitivity") {
        const resultString = [`Culture: ${cultureSensitivityValues.culture}`, `Preliminary Report: ${cultureSensitivityValues.preliminaryReport}`, `Final Report: ${cultureSensitivityValues.finalReport}`, `Sensitivity: ${cultureSensitivityValues.sensitivity}`].join("\n");
        await addTestResult({ ...base, test_name: "Culture and Sensitivity", result_value: resultString, reference_range: "", unit: "" }, user, true);
      } else if (selectedTest === "Routine Fecalysis (FA)") {
        const resultLines = [`Color: ${fecalysisColor}`, `Ova/Parasite: ${fecalysisOva}`, ...(fecalysisOva !== "No Ova or Parasite seen" && fecalysisParasiteName ? [`Name of Ova/Parasite: ${fecalysisParasiteName}`] : [])].join("\n");
        await addTestResult({ ...base, test_name: "Routine Fecalysis (FA)", result_value: resultLines, reference_range: "", unit: "" }, user, true);
      } else if (selectedTest === "Lipid Profile") {
        const sub = LIPID_PROFILE_TESTS.find((t) => t.name === lipidSubTest)!;
        await addTestResult({ ...base, test_name: lipidSubTest, result_value: lipidValue, reference_range: sub.referenceRange, unit: sub.unit }, user, true);
      } else if (selectedTest === "Liver Function Test") {
        const sub = LIVER_FUNCTION_TESTS.find((t) => t.name === lftSubTest)!;
        await addTestResult({ ...base, test_name: lftSubTest, result_value: lftValue, reference_range: sub.referenceRange, unit: sub.unit }, user, true);
      } else if (selectedTest === "Renal Function Test") {
        const sub = RENAL_FUNCTION_TESTS.find((t) => t.name === rftSubTest)!;
        await addTestResult({ ...base, test_name: rftSubTest, result_value: rftValue, reference_range: sub.referenceRange, unit: sub.unit }, user, true);
      } else if (selectedTest === "Glucose & Diabetes Monitoring") {
        const sub = GLUCOSE_TESTS.find((t) => t.name === glucoseSubTest)!;
        await addTestResult({ ...base, test_name: glucoseSubTest, result_value: glucoseValue, reference_range: sub.referenceRange, unit: sub.unit }, user, true);
      } else if (selectedTest === "Electrolytes") {
        const resultString = [`Sodium (Na+): ${electrolytesValues.sodium} mmol/L`, `Potassium (K+): ${electrolytesValues.potassium} mmol/L`, `Chloride (Cl-): ${electrolytesValues.chloride} mmol/L`, `Bicarbonate: ${electrolytesValues.bicarbonate} mEq/L`, `Calcium – Total (Ca++): ${electrolytesValues.calcium} mg/dL`, `Phosphorus: ${electrolytesValues.phosphorus} mmol/L`, `Magnesium (Mg++): ${electrolytesValues.magnesium} mmol/L`].join("\n");
        await addTestResult({ ...base, test_name: "Electrolytes", result_value: resultString, reference_range: "", unit: "" }, user, true);
      } else if (selectedTest === "Arterial Blood Gas") {
        const resultString = [`pH: ${abgValues.pH}`, `pCO2: ${abgValues.pco2} mmHg`, `PO2: ${abgValues.po2} mmHg`, `SaO2: ${abgValues.sao2} %`, `HCO3-: ${abgValues.hco3} mEq/L`].join("\n");
        await addTestResult({ ...base, test_name: "Arterial Blood Gas", result_value: resultString, reference_range: "", unit: "" }, user, true);
      } else {
        await addTestResult({ ...base, test_name: selectedTest, result_value: resultValue, reference_range: testDetails?.referenceRange || "", unit: testDetails?.unit || "" }, user, true);
      }

      setSaved(true);
    } catch (err) {
      console.error("Error saving result:", err);
      submittedRef.current = false; // allow retry on error
    } finally {
      setSubmitting(false);
    }
  };

  // ── Sub-test picker component ──────────────────────────────────────────────
  const SubTestPicker = ({ label, tests, selectedSub, onSelectSub, value, onChangeValue, error }: {
    label: string;
    tests: { name: string; referenceRange: string; unit: string }[];
    selectedSub: string;
    onSelectSub: (v: string) => void;
    value: string;
    onChangeValue: (v: string) => void;
    error?: string;
  }) => {
    const sub = tests.find((t) => t.name === selectedSub);
    return (
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">{label} Sub-Test <span className="text-red-500">*</span></label>
        <select value={selectedSub} onChange={(e) => { onSelectSub(e.target.value); onChangeValue(""); }} className={selectCls(error)}>
          <option value="">-- Select Sub-Test --</option>
          {tests.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        {selectedSub && (
          <div className="space-y-2">
            <input type="text" value={value} onChange={(e) => onChangeValue(e.target.value)} placeholder="Enter result value" className={inputCls(error)} />
            {sub?.referenceRange && <p className="text-xs text-gray-500 bg-blue-50 px-3 py-1.5 rounded-lg">Ref: {sub.referenceRange} {sub.unit ? `(${sub.unit})` : ""}</p>}
          </div>
        )}
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto"
      style={{ animation: "fadeIn 0.2s ease-out" }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl z-10 mb-8"
        style={{ animation: "slideUpModal 0.3s ease-out" }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#3B6255] to-green-900 text-white px-6 py-5 rounded-t-2xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BadgeCheck className="w-5 h-5" />
              <h2 className="text-lg font-bold">Test Complete — Encode Results</h2>
            </div>
            <p className="text-sm text-green-200 font-medium">{specimen.patient_name}</p>
            <p className="text-xs text-green-300 mt-0.5">
              Specimen: {specimen.test_name} · {specimen.section}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Success screen ───────────────────────────────────────────────── */}
        {saved ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[#3B6255]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Result Saved!</h3>
              <p className="text-sm text-gray-500 mt-1">
                The test result for <strong>{specimen.patient_name}</strong> has been created with status{" "}
                <span className="font-semibold text-blue-600">Encoding</span>.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Go to Test Results to advance it through Verification → Approved → Released.
              </p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <button
                onClick={() => { onSaved(); router.push("/dashboard/results"); }}
                className="flex-1 py-3 bg-[#3B6255] text-white rounded-xl font-semibold text-sm hover:bg-[#2d4f44] transition flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> Go to Test Results
              </button>
              <button
                onClick={onSaved}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
              >
                Stay Here
              </button>
            </div>
          </div>
        ) : (
        <>

        {/* Status notice */}
        <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Saving this result will set the Test Result status to <strong>Encoding</strong>.
            The result can then be advanced through Verification → Approved → Released from the Test Results page.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Lab Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Laboratory Section <span className="text-red-500">*</span>
            </label>
            <select value={selectedSection} onChange={(e) => { setSelectedSection(e.target.value); setSelectedTest(""); setResultValue(""); }}
              className={selectCls(errors.section)}>
              <option value="">-- Select Laboratory Section --</option>
              {LAB_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.section && <p className="text-red-500 text-xs mt-1">{errors.section}</p>}
          </div>

          {/* Test Name */}
          {selectedSection && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Test Name <span className="text-red-500">*</span>
              </label>
              <select value={selectedTest} onChange={(e) => { setSelectedTest(e.target.value); setResultValue(""); }}
                className={selectCls(errors.test)}>
                <option value="">-- Select Test --</option>
                {selectedSection === "CLINICAL CHEMISTRY" ? (
                  <>
                    <optgroup label="── Panels / Groups ──">
                      {CC_GROUPED_TEST_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                    </optgroup>
                    <optgroup label="── Individual Tests ──">
                      {currentTests.filter((t) => !CC_GROUPED_TEST_NAMES.includes(t.name)).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </optgroup>
                  </>
                ) : (
                  currentTests.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)
                )}
              </select>
              {errors.test && <p className="text-red-500 text-xs mt-1">{errors.test}</p>}
            </div>
          )}

          {/* ── Result inputs ──────────────────────────────────────────────── */}
          {selectedTest && (
            <div className="space-y-4">

              {/* CBC */}
              {selectedTest === "CBC" && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-700">WBC Differential Count <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: "Neutrophils (%)", key: "neutrophils", ph: "45-75" }, { label: "Lymphocytes (%)", key: "lymphocytes", ph: "16-46" }, { label: "Monocytes (%)", key: "monocytes", ph: "4-11" }, { label: "Eosinophils (%)", key: "eosinophils", ph: "0-8" }, { label: "Basophils (%)", key: "basophils", ph: "0-3" }].map(({ label, key, ph }) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-gray-600">{label}</label>
                        <input type="text" value={(cbcValues as any)[key]} onChange={(e) => setCbcValues({ ...cbcValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                      </div>
                    ))}
                  </div>
                  {errors.cbc && <p className="text-red-500 text-xs">{errors.cbc}</p>}

                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">RBC Indices <span className="text-red-500">*</span></p>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ label: "MCV (fL)", key: "mcv", ph: "80-100" }, { label: "MCH (pg)", key: "mch", ph: "27-31" }, { label: "RDW (%)", key: "rdw", ph: "11.5-14.5" }].map(({ label, key, ph }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-gray-600">{label}</label>
                          <input type="text" value={(cbcRbcValues as any)[key]} onChange={(e) => setCbcRbcValues({ ...cbcRbcValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                        </div>
                      ))}
                    </div>
                    {errors.rbc && <p className="text-red-500 text-xs">{errors.rbc}</p>}
                  </div>

                  <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Hemoglobin ({selectedPatientSex || "Male"}) <span className="text-red-500">*</span></label>
                      <input type="text" value={cbcHemoglobinValue} onChange={(e) => setCbcHemoglobinValue(e.target.value)} placeholder={selectedPatientSex === "Female" ? "12.0-15.0" : "14.0-17.0"} className={inputCls(errors.hemoglobin)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Hematocrit ({selectedPatientSex || "Male"}) <span className="text-red-500">*</span></label>
                      <input type="text" value={cbcHematocritValue} onChange={(e) => setCbcHematocritValue(e.target.value)} placeholder={selectedPatientSex === "Female" ? "37-47" : "40-54"} className={inputCls(errors.hematocrit)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Platelet Count <span className="text-red-500">*</span></label>
                      <input type="text" value={cbcPlateletCountValue} onChange={(e) => setCbcPlateletCountValue(e.target.value)} placeholder="150-450" className={inputCls(errors.platelet)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Peripheral Blood Smear</label>
                      <input type="text" value={cbcPeripheralSmearValue} onChange={(e) => setCbcPeripheralSmearValue(e.target.value)} placeholder="Optional findings" className={inputCls()} />
                    </div>
                  </div>
                </div>
              )}

              {/* RBC Indices */}
              {selectedTest === "RBC Indices (MCV, MCH, RDW)" && (
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: "MCV (fL)", key: "mcv", ph: "80-100" }, { label: "MCH (pg)", key: "mch", ph: "27-31" }, { label: "RDW (%)", key: "rdw", ph: "11.5-14.5" }].map(({ label, key, ph }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-gray-600">{label}</label>
                      <input type="text" value={(rbcValues as any)[key]} onChange={(e) => setRbcValues({ ...rbcValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                    </div>
                  ))}
                  {errors.rbc && <p className="col-span-3 text-red-500 text-xs">{errors.rbc}</p>}
                </div>
              )}

              {/* Hemoglobin */}
              {selectedTest === "Hemoglobin" && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Hemoglobin ({selectedPatientSex || "Male"}) <span className="text-red-500">*</span></label>
                  <input type="text" value={hemoglobinValue} onChange={(e) => setHemoglobinValue(e.target.value)} placeholder={selectedPatientSex === "Female" ? "12.0-15.0" : "14.0-17.0"} className={`mt-1.5 ${inputCls(errors.hemoglobin)}`} />
                  {errors.hemoglobin && <p className="text-red-500 text-xs mt-1">{errors.hemoglobin}</p>}
                </div>
              )}

              {/* PT/INR, PTT */}
              {selectedTest === "PT/INR, PTT" && (
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: "PT (seconds)", key: "pt", ph: "11.0-13.5" }, { label: "INR", key: "inr", ph: "0.8-1.2" }, { label: "aPTT (seconds)", key: "aptt", ph: "25.0-35.0" }].map(({ label, key, ph }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-gray-600">{label}</label>
                      <input type="text" value={(coagulationValues as any)[key]} onChange={(e) => setCoagulationValues({ ...coagulationValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                    </div>
                  ))}
                  {errors.coagulation && <p className="col-span-3 text-red-500 text-xs">{errors.coagulation}</p>}
                </div>
              )}

              {/* Routine Urinalysis */}
              {selectedTest === "Routine Urinalysis (UA)" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Physical Examination</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600">Color</label>
                        <select value={urinalysisValues.color} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, color: e.target.value })} className={selectCls()}>
                          <option value="">Select</option>
                          {["Clear", "Pale Yellow", "Amber"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Transparency</label>
                        <select value={urinalysisValues.transparency} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, transparency: e.target.value })} className={selectCls()}>
                          <option value="">Select</option>
                          {["Clear", "Slightly Turbid", "Turbid", "Very Turbid"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Chemical Examination</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600">pH</label>
                        <input type="text" value={urinalysisValues.pH} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, pH: e.target.value })} placeholder="4.5-8.0" className={inputCls()} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Urobilinogen (IEU/dL)</label>
                        <input type="text" value={urinalysisValues.urobilinogen} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, urobilinogen: e.target.value })} placeholder="0.2-1.0" className={inputCls()} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Protein / Glucose</label>
                        <select value={urinalysisValues.proteinGlucose} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, proteinGlucose: e.target.value })} className={selectCls()}>
                          <option value="">Select</option>
                          {["Positive", "Negative"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Bilirubin / Ketone</label>
                        <select value={urinalysisValues.bilirubinKetone} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, bilirubinKetone: e.target.value })} className={selectCls()}>
                          <option value="">Select</option>
                          {["Positive", "Negative"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Microscopic Examination</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600">WBC/Pus Cells (hpf)</label>
                        <input type="text" value={urinalysisValues.wbcMicroscopic} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, wbcMicroscopic: e.target.value })} placeholder="0-5" className={inputCls()} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">RBC (hpf)</label>
                        <input type="text" value={urinalysisValues.rbcMicroscopic} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, rbcMicroscopic: e.target.value })} placeholder="0-2" className={inputCls()} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Bacteria/Casts/Crystals</label>
                        <select value={urinalysisValues.bacteriaCastsCrystals} onChange={(e) => setUrinalysisValues({ ...urinalysisValues, bacteriaCastsCrystals: e.target.value })} className={selectCls()}>
                          <option value="">Select</option>
                          {["None", "Rare", "Few", "Many"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {errors.urinalysis && <p className="text-red-500 text-xs">{errors.urinalysis}</p>}
                </div>
              )}

              {/* Culture and Sensitivity */}
              {selectedTest === "Culture and Sensitivity" && (
                <div className="space-y-3">
                  {[{ label: "Culture", key: "culture", ph: "e.g. Staphylococcus aureus" }, { label: "Preliminary Report", key: "preliminaryReport", ph: "e.g. No growth after 24/48 hours" }, { label: "Final Report", key: "finalReport", ph: "e.g. No growth after 5-7 days" }].map(({ label, key, ph }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-gray-600">{label}</label>
                      <input type="text" value={(cultureSensitivityValues as any)[key]} onChange={(e) => setCultureSensitivityValues({ ...cultureSensitivityValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium text-gray-600">Sensitivity</label>
                    <select value={cultureSensitivityValues.sensitivity} onChange={(e) => setCultureSensitivityValues({ ...cultureSensitivityValues, sensitivity: e.target.value })} className={selectCls()}>
                      <option value="">Select sensitivity</option>
                      <option value="S (Susceptible): The antibiotic is effective">S (Susceptible)</option>
                      <option value="I (Intermediate): The antibiotic may work at higher doses">I (Intermediate)</option>
                      <option value="R (Resistant): The antibiotic will not work">R (Resistant)</option>
                    </select>
                  </div>
                  {errors.cultureSensitivity && <p className="text-red-500 text-xs">{errors.cultureSensitivity}</p>}
                </div>
              )}

              {/* Routine Fecalysis */}
              {selectedTest === "Routine Fecalysis (FA)" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Physical Examination</p>
                    <label className="text-xs font-medium text-gray-600">Color</label>
                    <input type="text" value={fecalysisColor} onChange={(e) => setFecalysisColor(e.target.value)} placeholder="e.g. Brown, Yellow, Green" className={`mt-1 ${inputCls()}`} />
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Microscopic Examination</p>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Ova or Parasite</label>
                      <select value={fecalysisOva} onChange={(e) => { setFecalysisOva(e.target.value); setFecalysisParasiteName(""); }} className={`mt-1 ${selectCls()}`}>
                        <option value="">Select result</option>
                        {["No Ova or Parasite seen", "Scant/Few Ova or Parasite seen", "Moderate Ova or Parasite seen", "Many/Numerous Ova or Parasite seen"].map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    {fecalysisOva && fecalysisOva !== "No Ova or Parasite seen" && (
                      <div>
                        <label className="text-xs font-medium text-gray-600">Name of Ova/Parasite <span className="text-red-500">*</span></label>
                        <input type="text" value={fecalysisParasiteName} onChange={(e) => setFecalysisParasiteName(e.target.value)} placeholder="e.g. Ascaris lumbricoides" className={`mt-1 ${inputCls()}`} />
                      </div>
                    )}
                  </div>
                  {errors.fecalysis && <p className="text-red-500 text-xs">{errors.fecalysis}</p>}
                </div>
              )}

              {/* Grouped CC tests */}
              {selectedTest === "Lipid Profile" && <SubTestPicker label="Lipid Profile" tests={LIPID_PROFILE_TESTS} selectedSub={lipidSubTest} onSelectSub={setLipidSubTest} value={lipidValue} onChangeValue={setLipidValue} error={errors.lipid} />}
              {selectedTest === "Liver Function Test" && <SubTestPicker label="Liver Function Test" tests={LIVER_FUNCTION_TESTS} selectedSub={lftSubTest} onSelectSub={setLftSubTest} value={lftValue} onChangeValue={setLftValue} error={errors.lft} />}
              {selectedTest === "Renal Function Test" && <SubTestPicker label="Renal Function Test" tests={RENAL_FUNCTION_TESTS} selectedSub={rftSubTest} onSelectSub={setRftSubTest} value={rftValue} onChangeValue={setRftValue} error={errors.rft} />}
              {selectedTest === "Glucose & Diabetes Monitoring" && <SubTestPicker label="Glucose & Diabetes Monitoring" tests={GLUCOSE_TESTS} selectedSub={glucoseSubTest} onSelectSub={setGlucoseSubTest} value={glucoseValue} onChangeValue={setGlucoseValue} error={errors.glucose} />}

              {/* Electrolytes */}
              {selectedTest === "Electrolytes" && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">Electrolytes — All required</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: "Sodium (Na+)", key: "sodium", ph: "135-145", unit: "mmol/L" }, { label: "Potassium (K+)", key: "potassium", ph: "3.4-5.0", unit: "mmol/L" }, { label: "Chloride (Cl-)", key: "chloride", ph: "95-108", unit: "mmol/L" }, { label: "Bicarbonate", key: "bicarbonate", ph: "22-28", unit: "mEq/L" }, { label: "Calcium – Total (Ca++)", key: "calcium", ph: "8.5-10.5", unit: "mg/dL" }, { label: "Phosphorus", key: "phosphorus", ph: "3.0-4.5", unit: "mmol/L" }, { label: "Magnesium (Mg++)", key: "magnesium", ph: "1.8-3", unit: "mmol/L" }].map(({ label, key, ph, unit }) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-gray-600">{label} <span className="text-gray-400">({unit})</span></label>
                        <input type="text" value={(electrolytesValues as any)[key]} onChange={(e) => setElectrolytesValues({ ...electrolytesValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                      </div>
                    ))}
                  </div>
                  {errors.electrolytes && <p className="text-red-500 text-xs">{errors.electrolytes}</p>}
                </div>
              )}

              {/* Arterial Blood Gas */}
              {selectedTest === "Arterial Blood Gas" && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Arterial Blood Gas — All required</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: "pH", key: "pH", ph: "7.35-7.45" }, { label: "pCO2 (mmHg)", key: "pco2", ph: "35-45" }, { label: "PO2 (mmHg)", key: "po2", ph: "80-100" }, { label: "SaO2 (%)", key: "sao2", ph: "> 90" }, { label: "HCO3- (mEq/L)", key: "hco3", ph: "22-26" }].map(({ label, key, ph }) => (
                      <div key={key}>
                        <label className="text-xs font-medium text-gray-600">{label}</label>
                        <input type="text" value={(abgValues as any)[key]} onChange={(e) => setAbgValues({ ...abgValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                      </div>
                    ))}
                  </div>
                  {errors.abg && <p className="text-red-500 text-xs">{errors.abg}</p>}
                </div>
              )}

              {/* Regular single-value tests */}
              {selectedTest && !MULTI_FIELD_TESTS.includes(selectedTest) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Result Value <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {TEST_DROPDOWN_OPTIONS[selectedTest] ? (
                      <select value={resultValue} onChange={(e) => setResultValue(e.target.value)} className={`flex-1 ${selectCls(errors.resultValue)}`}>
                        <option value="">Select result</option>
                        {TEST_DROPDOWN_OPTIONS[selectedTest].map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={resultValue} onChange={(e) => setResultValue(e.target.value)} placeholder="Enter result value" className={`flex-1 ${inputCls(errors.resultValue)}`} />
                    )}
                    <span className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm font-medium whitespace-nowrap">
                      {currentTests.find((t) => t.name === selectedTest)?.unit || "—"}
                    </span>
                  </div>
                  {errors.resultValue && <p className="text-red-500 text-xs mt-1">{errors.resultValue}</p>}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button type="submit" disabled={submitting}
              className="flex-1 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Save & Set to Encoding</>}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SpecimenTrackingPage() {
  const { user } = useAuth();

  const [specimens, setSpecimens] = useState<SpecimenRecord[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [testResultPopup, setTestResultPopup] = useState<SpecimenRecord | null>(null);

  // ── Animations ──
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @keyframes fadeInDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeInUp   { from{opacity:0;transform:translateY(14px)}  to{opacity:1;transform:translateY(0)} }
      @keyframes fadeIn     { from{opacity:0}                              to{opacity:1}                         }
      @keyframes expandDown { from{opacity:0;transform:scaleY(0.95)}      to{opacity:1;transform:scaleY(1)}     }
      @keyframes pulseRing  { 0%,100%{transform:scale(1);opacity:.8} 60%{transform:scale(1.5);opacity:0}       }
      @keyframes slideUpModal { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
    `;
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);

  // ── Load: only paid billing records ──
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      // Fetch specimens, billing, and patients in parallel
      const [{ data: specimenData, error: specimenError }, { data: billingData }, patientData] = await Promise.all([
        supabase.from("specimen_tracking").select("*").order("created_at", { ascending: false }),
        supabase.from("billing").select("id, patient_name, test_name, status").eq("status", "paid"),
        fetchPatients(),
      ]);

      if (!cancelled) {
        if (patientData) setPatients(patientData);
        if (!specimenError && specimenData) {
          const paidBilling = billingData || [];

          const paid = specimenData.filter((s: any) => {
            // Primary: match by billing_id FK
            if (s.billing_id) {
              return paidBilling.some((b: any) => b.id === s.billing_id);
            }
            // Fallback: match by patient_name + test_name
            return paidBilling.some(
              (b: any) =>
                b.patient_name === s.patient_name &&
                b.test_name === s.test_name
            );
          });

          setSpecimens(paid as SpecimenRecord[]);
        }
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Advance status ──
  const handleAdvance = async (id: string, next: SpecimenStatus) => {
    setUpdatingId(id);
    const specimen = specimens.find((s) => s.id === id);
    const now = new Date().toISOString();

    const extraFields: Record<string, string> = {};
    if (next === "collection_in_progress") extraFields.collected_by = user?.full_name || user?.email || "";
    if (next === "sample_collected") extraFields.sample_collected_at = now;
    if (next === "sample_received") extraFields.sample_received_at = now;

    if (next === "test_complete") {
      // First persist the status change
      const { error } = await supabase
        .from("specimen_tracking")
        .update({ status: next, updated_at: now, ...extraFields })
        .eq("id", id);
      setUpdatingId(null);
      if (!error) {
        setSpecimens((prev) => prev.map((s) => s.id === id ? { ...s, status: next, updated_at: now, ...extraFields } : s));
        // Open the test result encoding popup
        setTestResultPopup(specimen ? { ...specimen, status: next } : null);
      }
      return;
    }

    const { error } = await supabase
      .from("specimen_tracking")
      .update({ status: next, updated_at: now, ...extraFields })
      .eq("id", id);

    if (!error) {
      setSpecimens((prev) => prev.map((s) => s.id === id ? { ...s, status: next, updated_at: now, ...extraFields } : s));
      try {
        await logActivity({
          user_id: user?.id,
          user_name: user?.full_name || user?.email || "Unknown",
          encryption_key: user?.id || "",
          action: "edit",
          resource: "specimen_tracking",
          resource_type: "specimen_tracking",
          description: `Advanced specimen for ${specimen?.patient_name} to ${next}`,
        });
      } catch (_) {}
    }
    setUpdatingId(null);
  };

  const handleResultSaved = () => {
    setTestResultPopup(null);
  };

  // ── Stats ──
  const counts = Object.fromEntries(PIPELINE.map((s) => [s.key, specimens.filter((sp) => sp.status === s.key).length]));

  // ── Filter ──
  const filtered = specimens.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.patient_name.toLowerCase().includes(q) || s.test_name.toLowerCase().includes(q) || s.section?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6" style={{ animation: "fadeInUp 0.4s ease-out" }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Specimen Tracking</h1>
        <p className="text-sm text-gray-500 mt-0.5">Only patients with paid billing are shown</p>
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
        {PIPELINE.map((step, i) => {
          const Icon = step.icon;
          const active = statusFilter === step.key;
          return (
            <button key={step.key} onClick={() => setStatusFilter(active ? "all" : step.key)}
              className="rounded-xl px-3 py-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: active ? step.color : step.fill,
                border: `1.5px solid ${active ? step.color : "transparent"}`,
                boxShadow: active ? `0 4px 16px ${step.color}44` : "0 1px 3px #00000008",
                animation: `fadeInUp 0.4s ease-out ${0.05 + i * 0.04}s both`,
              }}>
              <Icon className="w-4 h-4 mb-1.5" style={{ color: active ? "#fff" : step.color }} strokeWidth={1.8} />
              <p className="text-xl font-black leading-none" style={{ color: active ? "#fff" : step.textDark }}>{counts[step.key] ?? 0}</p>
              <p className="text-[10px] font-semibold mt-0.5 leading-tight" style={{ color: active ? "#ffffffbb" : step.color }}>{step.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Table Card ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" style={{ animation: "fadeInUp 0.4s ease-out 0.2s both" }}>

        {/* Search + filter */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, test, or section…"
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">✕</button>}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition">
            <option value="all">All Statuses</option>
            {PIPELINE.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <span className="text-xs text-gray-400 self-center whitespace-nowrap">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-52"><Loader className="w-7 h-7 text-[#3B6255] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center" style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FlaskConical className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-gray-400">No specimens found</p>
            <p className="text-xs text-gray-300 mt-1">Only paid billing records appear here. Mark billing as paid to unlock specimen tracking.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Patient", "Lab Section", "Test Name", "Status", "Action"].map((h) => (
                  <th key={h} className={`py-3.5 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider ${h === "Action" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((specimen) => {
                const cfg = PIPELINE[PIPELINE_INDEX[specimen.status]];
                const Icon = cfg.icon;
                const isExpanded = expandedId === specimen.id;
                const isComplete = specimen.status === "test_complete";
                const nextStep = PIPELINE[PIPELINE_INDEX[specimen.status] + 1];

                return (
                  <React.Fragment key={specimen.id}>
                    <tr className={`border-b border-gray-100 transition-colors cursor-pointer ${isExpanded ? "bg-[#F8FBF9]" : "hover:bg-gray-50"}`}
                      onClick={() => setExpandedId(isExpanded ? null : specimen.id)}>

                      {/* Patient */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#CBDED3] flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-[#3B6255]">{specimen.patient_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="text-sm font-semibold text-gray-800">{specimen.patient_name}</span>
                        </div>
                      </td>

                      {/* Lab Section */}
                      <td className="py-4 px-6"><span className="text-sm text-gray-600">{specimen.section}</span></td>

                      {/* Test Name */}
                      <td className="py-4 px-6"><span className="text-sm text-gray-700 font-medium">{specimen.test_name}</span></td>

                      {/* Status pill */}
                      <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-shrink-0">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                            {!isComplete && <div className="absolute inset-0 rounded-full" style={{ backgroundColor: cfg.color, opacity: 0.35, animation: "pulseRing 2.4s infinite" }} />}
                          </div>
                          <button
                            onClick={() => { if (!isComplete && nextStep) handleAdvance(specimen.id, nextStep.key as SpecimenStatus); else if (isComplete) setTestResultPopup(specimen); }}
                            disabled={updatingId === specimen.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                            style={{ backgroundColor: cfg.fill, color: cfg.textDark, border: `1.5px solid ${cfg.color}55`, cursor: "pointer" }}>
                            {updatingId === specimen.id ? <Loader className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" strokeWidth={2} style={{ color: cfg.color }} />}
                            {cfg.label}
                            <ArrowRight className="w-3 h-3 ml-0.5 opacity-60" />
                          </button>
                        </div>
                      </td>

                      {/* Chevron */}
                      <td className="py-4 px-6 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : specimen.id); }}
                          className="p-1.5 text-gray-400 hover:text-[#3B6255] hover:bg-[#3B625514] rounded-lg transition">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* ── Expanded row ───────────────────────────────────────── */}
                    {isExpanded && (
                      <tr className="bg-[#F8FBF9]">
                        <td colSpan={5} className="px-6 py-6 border-b border-gray-100">
                          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" style={{ animation: "expandDown 0.2s ease-out", transformOrigin: "top" }}>

                            {/* Timeline */}
                            <div className="lg:col-span-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Specimen Pipeline</p>
                              <SpecimenTimeline currentStatus={specimen.status} specimenId={specimen.id} onAdvance={handleAdvance} isUpdating={updatingId === specimen.id} />
                            </div>

                            {/* Details */}
                            <div className="lg:col-span-2">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Details</p>
                              <div className="space-y-3">
                                {[
                                  { label: "Patient", value: specimen.patient_name, icon: User },
                                  { label: "Test", value: specimen.test_name, icon: TestTube },
                                  { label: "Section", value: specimen.section, icon: FlaskConical },
                                  specimen.collected_by && { label: "Collected by", value: specimen.collected_by, icon: User },
                                  { label: "Created", value: formatDT(specimen.created_at), icon: Calendar },
                                  specimen.sample_collected_at && { label: "Sample Collected", value: formatDT(specimen.sample_collected_at), icon: Calendar },
                                  specimen.sample_received_at && { label: "Sample Received", value: formatDT(specimen.sample_received_at), icon: Calendar },
                                  specimen.updated_at && { label: "Last Updated", value: formatDT(specimen.updated_at), icon: Calendar },
                                ].filter(Boolean).map((row: any, i) => {
                                  const RowIcon = row.icon;
                                  return (
                                    <div key={i} className="flex items-start gap-2.5">
                                      <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <RowIcon className="w-3 h-3 text-gray-400" strokeWidth={2} />
                                      </div>
                                      <div>
                                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{row.label}</p>
                                        <p className="text-sm font-semibold text-gray-700 mt-0.5">{row.value}</p>
                                      </div>
                                    </div>
                                  );
                                })}

                                {specimen.notes && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">Notes</p>
                                    <p className="text-xs text-amber-800 leading-relaxed">{specimen.notes}</p>
                                  </div>
                                )}

                                {/* Test Complete CTA */}
                                {isComplete && (
                                  <div className="rounded-xl p-4 mt-1" style={{ background: "linear-gradient(135deg,#F0F9F4,#E6F4EC)", border: "1px solid #3B625530" }}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <BadgeCheck className="w-4 h-4 text-[#3B6255]" />
                                      <p className="text-sm font-bold text-[#14532D]">Ready for Encoding</p>
                                    </div>
                                    <p className="text-xs text-[#3B6255] mb-3 leading-relaxed">All specimen steps complete. Encode test results now.</p>
                                    <button onClick={() => setTestResultPopup(specimen)}
                                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#3B6255] text-white rounded-xl text-sm font-semibold hover:bg-[#2d4f44] transition">
                                      <Edit2 className="w-4 h-4" /> Encode Test Results
                                    </button>
                                  </div>
                                )}
                              </div>
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
        )}
      </div>

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-5 rounded-xl">
        <h3 className="font-bold text-[#3B6255] text-sm mb-1.5">🧪 Specimen Tracking Notes</h3>
        <ul className="text-sm text-[#3B6255] space-y-1 list-disc list-inside opacity-80">
          <li>Only patients with <strong>paid</strong> billing records appear here</li>
          <li>Pipeline: Pending Accession → Collection In-Progress → Sample Collected → Sample Received → Analytical → Test Complete</li>
          <li><strong>Sample Collected</strong> and <strong>Sample Received</strong> are auto-timestamped when reached</li>
          <li>Reaching <strong>Test Complete</strong> opens the result encoding form — test result status is set to <strong>Encoding</strong> automatically</li>
        </ul>
      </div>

      {/* ── Test Result Popup ─────────────────────────────────────────────────── */}
      {testResultPopup && (
        <TestResultForm
          specimen={testResultPopup}
          onClose={() => setTestResultPopup(null)}
          onSaved={handleResultSaved}
          patientSex={(() => {
            const p = patients.find((pt) =>
              (testResultPopup.patient_id && pt.id === testResultPopup.patient_id) ||
              `${pt.first_name ?? ""} ${pt.last_name ?? ""}`.trim().toLowerCase() === testResultPopup.patient_name.trim().toLowerCase()
            );
            return p?.sex === "Male" || p?.sex === "Female" ? p.sex : null;
          })()}
        />
      )}
    </div>
  );
}