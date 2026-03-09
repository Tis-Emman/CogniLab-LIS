"use client";

import React, { useState, useEffect } from "react";
import PhoneInputMask from "@/components/PhoneInputMask";
import { useRouter } from "next/navigation";
import {
  Plus,
  User,
  ArrowRight,
  Trash2,
  Loader,
  ClipboardList,
  Stethoscope,
  Calendar,
  FlaskConical,
  Check,
  CheckCircle,
  X,
  Pencil,
  Save,
} from "lucide-react";
import {
  fetchPatients,
  addPatient,
  updatePatient,
  deletePatient,
  addBilling,
  getTestPrice,
} from "@/lib/database";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { logActivity } from "@/lib/database";

function generatePatientId(existingPatients: any[]): string {
  const year = new Date().getFullYear().toString().slice(-2); // "26"
  const prefix = `CL-${year}-PAT-`;
  
  // Find highest existing number
  const nums = existingPatients
    .map(p => p.patient_id_no)
    .filter(id => id?.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

interface Patient {
  id: string;
  patient_id_no: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  age: number;
  birthdate: string;
  sex: string;
  civil_status?: string;
  contact_no: string;
  address_house_no?: string;
  address_street?: string;
  address_barangay?: string;
  municipality: string;
  province: string;
  medical_history: string;
  medications: string;
  allergy: string;
  demographics_complete: boolean;
  date_registered: string;
}

// ── Lab sections for test request popup ─────────────────────────────────────
const TR_LAB_SECTIONS = [
  "BLOOD BANK","HEMATOLOGY","CLINICAL MICROSCOPY",
  "CLINICAL CHEMISTRY","MICROBIOLOGY","IMMUNOLOGY/SEROLOGY","HISTOPATHOLOGY",
];
const TR_TESTS_BY_SECTION: Record<string, string[]> = {
  "BLOOD BANK": ["ABO Blood Typing","Rh Typing","Crossmatching","Antibody Screening","Infectious Disease Screening"],
  "HEMATOLOGY": ["CBC","Hemoglobin","Hematocrit","WBC Count","Platelet Count","RBC Indices (MCV, MCH, RDW)","Peripheral Blood Smear","ESR","PT/INR, PTT","Clotting Time","Bleeding Time","Reticulocyte Count"],
  "CLINICAL MICROSCOPY": ["Routine Urinalysis (UA)","Routine Fecalysis (FA)","Fecal Occult Blood Test","Pregnancy Test (hCG)","Pregnancy Test (PT)","Semen Analysis","KOH Mount","Wet Mount"],
  "CLINICAL CHEMISTRY": ["Lipid Profile","Liver Function Test","Renal Function Test","Electrolytes","Glucose & Diabetes Monitoring","Arterial Blood Gas","Fasting Blood Sugar (FBS)","Random Blood Sugar (RBS)","HbA1c","Uric Acid","Creatinine","BUN","Total Cholesterol","Triglycerides","HDL","LDL"],
  "MICROBIOLOGY": ["Culture and Sensitivity","Gram Staining","AFB Smear","India Ink","KOH Preparation"],
  "IMMUNOLOGY/SEROLOGY": ["HBsAg (Hepa B Surface Ag) - Qualitative","Dengue NS1Ag","Leptospirosis Test","Syphilis Test (Qualitative)","Typhidot Test (IgG, IgM)","HIV Screening","RPR/VDRL","ANA","RF (Rheumatoid Factor)","C-Reactive Protein (CRP)","PSA","TSH","Free T3 / T4"],
  "HISTOPATHOLOGY": ["Tissue Biopsy","Skin Biopsy","Kidney Biopsy","Liver Biopsy Fibrosis","Liver Biopsy Activity","Bone Biopsy","PAP Smear","Fine Needle Aspiration Cytology (FNAC)"],
};
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
let MOCK_TEST_REQUESTS: any[] = [];
const toLocalDatetimeValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// ── Test-form constants removed (test entry moved to Test Request module) ──
export default function PatientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ── Edit Demographics Modal State ────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [editFormData, setEditFormData] = useState<typeof formData | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  // ── Test Request Popup State ─────────────────────────────────────────────
  const [showTRPopup, setShowTRPopup] = useState(false);
  const [trPatient, setTrPatient] = useState<Patient | null>(null);
  const [trPhysician, setTrPhysician] = useState("");
  const [trNotes, setTrNotes] = useState("");
  const [trDatetime, setTrDatetime] = useState("");
  const [trSection, setTrSection] = useState(TR_LAB_SECTIONS[0]);
  const [trTests, setTrTests] = useState<{section: string; test_name: string}[]>([]);
  const [trSubmitting, setTrSubmitting] = useState(false);
  const [trError, setTrError] = useState<string | null>(null);
  const [trSuccess, setTrSuccess] = useState(false);

  // ── Lab History State ────────────────────────────────────────────────────
  const [labHistory, setLabHistory] = useState<any[]>([]);
  const [labHistoryLoading, setLabHistoryLoading] = useState(false);
  const [labHistoryTab, setLabHistoryTab] = useState<"all" | string>("all");

  const [formData, setFormData] = useState({
  patient_id_no: "", // ← empty, generated when button is clicked
  last_name: "",
  first_name: "",
  middle_name: "",
  age: "",
  birthdate: "",
  sex: "Male",
  civil_status: "Single",
  contact_no: "",
  address_house_no: "",
  address_street: "",
  address_barangay: "",
  municipality: "",
  province: "",
  medical_history: "",
  medications: "",
  allergy: "",
});

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inject animation keyframes
  useEffect(() => {
    const style = document.createElement("style");
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
      
      @keyframes slideInFromTop {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  
  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await fetchPatients();
    setPatients(data);
    setLoading(false);
    
  };

  

  

  // Returns the errors object directly so callers can read it without relying on stale state
  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    if (!formData.last_name.trim())
      newErrors.last_name = "Last name is required";
    if (!formData.first_name.trim())
      newErrors.first_name = "First name is required";
    if (!formData.age || parseInt(formData.age) < 1)
      newErrors.age = "Valid age is required";
    if (!formData.birthdate) newErrors.birthdate = "Birthdate is required";
    // Philippine mobile number validation
    let contact = formData.contact_no.replace(/\s|-/g, "").trim();
    // Acceptable formats: 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX
    let valid = false;
    if (/^09\d{9}$/.test(contact)) {
      valid = true;
    } else if (/^\+639\d{9}$/.test(contact)) {
      valid = true;
    } else if (/^639\d{9}$/.test(contact)) {
      valid = true;
    }
    if (!contact) {
      newErrors.contact_no = "Contact number is required";
    } else if (!valid) {
      newErrors.contact_no = "Invalid Philippine mobile number.";
    }
    if (!formData.municipality.trim())
      newErrors.municipality = "Municipality is required";
    if (!formData.province.trim()) newErrors.province = "Province is required";
    if (!formData.medical_history.trim())
      newErrors.medical_history = "Medical history is required";
    if (!formData.medications.trim())
      newErrors.medications = "Medications is required";
    if (!formData.allergy.trim())
      newErrors.allergy = "Allergy information is required";

    setErrors(newErrors);
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      // Scroll to first error field using the freshly computed errors (not stale state)
      const errorOrder = [
        "last_name",
        "first_name",
        "age",
        "birthdate",
        "contact_no",
        "municipality",
        "province",
        "medical_history",
        "medications",
        "allergy",
      ];
      for (const key of errorOrder) {
        if (newErrors[key]) {
          let selector = "";
          if (key === "contact_no") selector = 'input[type="tel"]';
          else if (key === "birthdate") selector = 'input[type="date"]';
          else if (key === "age") selector = 'input[type="number"]';
          else selector = `input[name="${key}"]`;
          const el = document.querySelector(selector);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            (el as HTMLInputElement).focus();
          }
          break;
        }
      }
      return;
    }
    // Normalize and store contact_no
    let contact = formData.contact_no.replace(/\s|-/g, "").trim();
    let normalized = "";
    if (/^09\d{9}$/.test(contact)) {
      normalized = "+63" + contact.slice(1);
    } else if (/^\+639\d{9}$/.test(contact)) {
      normalized = contact;
    } else if (/^639\d{9}$/.test(contact)) {
      normalized = "+63" + contact.slice(2);
    }
    // ...existing code...

    setSubmitting(true);
    try {
      await addPatient(
        {
          patient_id_no: formData.patient_id_no,
          last_name: formData.last_name,
          first_name: formData.first_name,
          middle_name: formData.middle_name || null,
          age: parseInt(formData.age),
          birthdate: formData.birthdate,
          sex: formData.sex,
          civil_status: formData.civil_status || "Single",
          contact_no: normalized,
          address_house_no: formData.address_house_no || null,
          address_street: formData.address_street || null,
          address_barangay: formData.address_barangay,
          municipality: formData.municipality,
          province: formData.province,
          medical_history: formData.medical_history,
          medications: formData.medications,
          allergy: formData.allergy,
          demographics_complete: true,
        },
        user,
      );
      const newPatientIdNo = formData.patient_id_no; // capture before reset
      await loadPatients();
      setFormData({
        patient_id_no: "",
        last_name: "",
        first_name: "",
        middle_name: "",
        age: "",
        birthdate: "",
        sex: "Male",
        civil_status: "Single",
        contact_no: "",
        address_house_no: "",
        address_street: "",
        address_barangay: "",
        municipality: "",
        province: "",
        medical_history: "",
        medications: "",
        allergy: "",
      });
      setErrors({});
      setShowForm(false);

      // Open Test Request popup for the newly registered patient
      const refreshed = await fetchPatients();
      // Find the newly registered patient by their captured ID
      const newPat =
        refreshed.find((p: Patient) => p.patient_id_no === newPatientIdNo) ??
        refreshed[0] ??
        null;
      setTrPatient(newPat);
      setTrDatetime(toLocalDatetimeValue(new Date()));
      setTrTests([]);
      setTrSection(TR_LAB_SECTIONS[0]);
      setTrPhysician("");
      setTrNotes("");
      setTrError(null);
      setTrSuccess(false);
      setShowTRPopup(true);
    } catch (error: any) {
      const msg: string = error?.message || "";
      if (msg.includes("Patient ID already exists") || msg.includes("patient_id_no")) {
        setErrors((prev) => ({
          ...prev,
          patient_id_no: "Patient ID already exists",
        }));
      } else if (msg.includes("duplicate") || msg.includes("unique")) {
        setErrors((prev) => ({
          ...prev,
          patient_id_no: "A patient with this ID already exists",
        }));
      } else {
        console.error("Error adding patient:", error);
        setErrors((prev) => ({
          ...prev,
          submit: msg || "Failed to save patient. Please try again.",
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };


  // ── Test Request Popup Submit ─────────────────────────────────────────────
  const handleTRSubmit = async () => {
    if (!trPatient || !trPhysician.trim() || trTests.length === 0) {
      setTrError("Please fill in physician name and select at least one test.");
      return;
    }
    setTrSubmitting(true);
    setTrError(null);
    const payload = {
      patient_id: trPatient.id,
      patient_name: `${trPatient.first_name} ${trPatient.last_name}`.trim(),
      requesting_physician: trPhysician.trim(),
      requested_tests: trTests,
      sample_collection_datetime: trDatetime ? new Date(trDatetime).toISOString() : new Date().toISOString(),
      status: "pending" as const,
      notes: trNotes.trim() || undefined,
      created_by: user?.full_name || user?.email || "Unknown",
    };
    try {
      if (USE_MOCK_DATA) {
        MOCK_TEST_REQUESTS.push({ id: `tr-${Date.now()}`, ...payload, created_at: new Date().toISOString() });
        await logActivity({ user_id: user?.id, user_name: user?.full_name || "Unknown", encryption_key: user?.encryption_key || "", action: "edit", resource: `Test Request - ${payload.patient_name}`, resource_type: "Test Request", description: `Created test request for ${payload.patient_name}` });
      } else {
        const { error } = await supabase.from("test_requests").insert([payload]);
        if (error) throw error;
        await logActivity({ user_id: user?.id, user_name: user?.full_name || "Unknown", encryption_key: user?.encryption_key || "", action: "edit", resource: `Test Request - ${payload.patient_name}`, resource_type: "Test Request", description: `Created test request for ${payload.patient_name} with ${trTests.length} test(s)` });
      }
      // ── Auto-create billing records for each requested test ──────────────
      for (const t of trTests) {
        const price = getTestPrice(t.test_name, t.section) ?? 300;
        await addBilling({
          patient_name: payload.patient_name,
          test_name: t.test_name,
          section: t.section,
          amount: price,
          description: `Lab test: ${t.test_name}`,
        });
      }
      setTrSuccess(true);
    } catch (e) {
      setTrError("Failed to save test request. Please try again.");
    } finally {
      setTrSubmitting(false);
    }
  };

  const closeTRPopup = () => {
    setShowTRPopup(false);
    setTrPatient(null);
    setTrSuccess(false);
    setTrError(null);
  };

  // ── Fetch Lab History for a patient ──────────────────────────────────────
  const fetchLabHistory = async (patient: Patient) => {
    setLabHistoryLoading(true);
    setLabHistory([]);
    setLabHistoryTab("all");
    try {
      if (USE_MOCK_DATA) {
        // Filter mock test requests by patient id
        const mock = MOCK_TEST_REQUESTS.filter((r: any) => r.patient_id === patient.id);
        setLabHistory(mock);
      } else {
        const { data, error } = await supabase
          .from("test_requests")
          .select("*")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setLabHistory(data || []);
      }
    } catch (e) {
      setLabHistory([]);
    } finally {
      setLabHistoryLoading(false);
    }
  };
  const handleDelete = async () => {
    if (!patientToDelete) return;
    await deletePatient(patientToDelete.id);
    await loadPatients();
    setShowDeleteModal(false);
    setPatientToDelete(null);
  };

  // ── Edit Demographics ────────────────────────────────────────────────────
  const openEditModal = (patient: Patient) => {
    setPatientToEdit(patient);
    setEditFormData({
      patient_id_no: patient.patient_id_no,
      last_name: patient.last_name,
      first_name: patient.first_name,
      middle_name: patient.middle_name || "",
      age: String(patient.age),
      birthdate: patient.birthdate,
      sex: patient.sex,
      civil_status: patient.civil_status || "Single",
      contact_no: patient.contact_no,
      address_house_no: patient.address_house_no || "",
      address_street: patient.address_street || "",
      address_barangay: patient.address_barangay || "",
      municipality: patient.municipality,
      province: patient.province,
      medical_history: patient.medical_history,
      medications: patient.medications,
      allergy: patient.allergy,
    });
    setEditErrors({});
    setEditSuccess(false);
    setShowEditModal(true);
  };

  const validateEditForm = (data: typeof formData) => {
    const newErrors: Record<string, string> = {};
    if (!data.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!data.first_name.trim()) newErrors.first_name = "First name is required";
    if (!data.age || parseInt(data.age) < 1) newErrors.age = "Valid age is required";
    if (!data.birthdate) newErrors.birthdate = "Birthdate is required";
    let contact = data.contact_no.replace(/\s|-/g, "").trim();
    let valid = /^09\d{9}$/.test(contact) || /^\+639\d{9}$/.test(contact) || /^639\d{9}$/.test(contact);
    if (!contact) newErrors.contact_no = "Contact number is required";
    else if (!valid) newErrors.contact_no = "Invalid Philippine mobile number.";
    if (!data.municipality.trim()) newErrors.municipality = "Municipality is required";
    if (!data.province.trim()) newErrors.province = "Province is required";
    if (!data.medical_history.trim()) newErrors.medical_history = "Medical history is required";
    if (!data.medications.trim()) newErrors.medications = "Medications is required";
    if (!data.allergy.trim()) newErrors.allergy = "Allergy information is required";
    return newErrors;
  };

  const handleEditSubmit = async () => {
    if (!patientToEdit || !editFormData) return;
    const newErrors = validateEditForm(editFormData);
    setEditErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    let contact = editFormData.contact_no.replace(/\s|-/g, "").trim();
    let normalized = contact; // default — handles +639XXXXXXXXX which is already correct
    if (/^09\d{9}$/.test(contact)) normalized = "+63" + contact.slice(1);
    else if (/^639\d{9}$/.test(contact)) normalized = "+63" + contact.slice(2);
    else if (/^\+639\d{9}$/.test(contact)) normalized = contact;

    setEditSubmitting(true);
    try {
      await updatePatient(patientToEdit.id, {
        last_name: editFormData.last_name,
        first_name: editFormData.first_name,
        middle_name: editFormData.middle_name || null,
        age: parseInt(editFormData.age),
        birthdate: editFormData.birthdate,
        sex: editFormData.sex,
        civil_status: editFormData.civil_status || "Single",
        contact_no: normalized,
        address_house_no: editFormData.address_house_no || null,
        address_street: editFormData.address_street || null,
        address_barangay: editFormData.address_barangay || "",
        municipality: editFormData.municipality,
        province: editFormData.province,
        medical_history: editFormData.medical_history,
        medications: editFormData.medications,
        allergy: editFormData.allergy,
        demographics_complete: true,
      }, user);
      await loadPatients();
      setEditSuccess(true);
      // Update selectedPatient if the details modal is also open
      setSelectedPatient(prev =>
        prev?.id === patientToEdit.id
          ? { ...prev, ...editFormData, age: parseInt(editFormData.age), contact_no: normalized }
          : prev
      );
    } catch (err: any) {
      setEditErrors({ submit: err?.message || "Failed to update patient. Please try again." });
    } finally {
      setEditSubmitting(false);
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
    <div
      className="space-y-8"
      style={{
        animation: "fadeIn 0.5s ease-out",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          animation: "fadeInSlideUp 0.6s ease-out",
          animationDelay: "0.1s",
          animationFillMode: "both",
        }}
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Patient Management
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Register and manage patient demographics and information
          </p>
        </div>
        <button
  onClick={() => {
    if (!showForm) {
      setFormData((prev) => ({
        ...prev,
        patient_id_no: generatePatientId(patients), // ← pass patients here
      }));
    }
    setShowForm(!showForm);
  }}
  className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
>
  {showForm ? (
    <>✕ Cancel</>
  ) : (
    <>
      <Plus className="w-5 h-5" />
      Add New Patient
    </>
  )}
</button>
      </div>

      {/* Add Patient Form */}
      {showForm && (
        <div
          className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]"
          style={{
            animation: "fadeInSlideUp 0.6s ease-out 0.2s backwards",
          }}
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Patient Demographics Form
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            Fields marked with <span className="text-red-500 font-bold">*</span>{" "}
            are required
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient ID Section */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Patient ID No.{" "}
                <span className="text-xs text-gray-500 font-normal">
                  (Auto-generated)
                </span>
              </label>
              <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 font-mono font-semibold tracking-wider">
                {formData.patient_id_no}
              </div>
            </div>

            {/* Names Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.last_name
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="Surname"
                />
                {errors.last_name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.last_name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.first_name
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="Given name"
                />
                {errors.first_name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.first_name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) =>
                    setFormData({ ...formData, middle_name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Age and Birthdate Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.age ? "border-red-500 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder="Enter age"
                  min="1"
                />
                {errors.age && (
                  <p className="text-red-500 text-sm mt-1">{errors.age}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Birthdate (dd/mm/yyyy) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.birthdate}
                  onChange={(e) =>
                    setFormData({ ...formData, birthdate: e.target.value })
                  }
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                    errors.birthdate
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                />
                {errors.birthdate && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.birthdate}
                  </p>
                )}
              </div>
            </div>

            {/* Sex and Contact Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sex <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sex}
                  onChange={(e) =>
                    setFormData({ ...formData, sex: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                >
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contact No. <span className="text-red-500">*</span>
                </label>
                {/* Improved PhoneInputMask component */}
                <PhoneInputMask
                  value={formData.contact_no}
                  onChange={(val) =>
                    setFormData({ ...formData, contact_no: val })
                  }
                  error={errors.contact_no}
                  className="mb-0"
                />
              </div>
            </div>

            {/* Civil Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Civil Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.civil_status || "Single"}
                  onChange={(e) =>
                    setFormData({ ...formData, civil_status: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                >
                  <option>Single</option>
                  <option>Married</option>
                  <option>Widowed</option>
                  <option>Separated</option>
                  <option>Divorced</option>
                </select>
              </div>
            </div>

            {/* Address Section */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-gray-800 mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    House No.
                  </label>
                  <input
                    type="text"
                    value={formData.address_house_no}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address_house_no: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Street Name
                  </label>
                  <input
                    type="text"
                    value={formData.address_street}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address_street: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Barangay
                  </label>
                  <input
                    type="text"
                    value={formData.address_barangay}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address_barangay: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Municipality/City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.municipality}
                    onChange={(e) =>
                      setFormData({ ...formData, municipality: e.target.value })
                    }
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                      errors.municipality
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="e.g., Makati"
                  />
                  {errors.municipality && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.municipality}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) =>
                      setFormData({ ...formData, province: e.target.value })
                    }
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                      errors.province
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="e.g., NCR"
                  />
                  {errors.province && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.province}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Medical Section */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-gray-800 mb-4">
                Medical Information
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medical History <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="medical_history"
                  value={formData.medical_history}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medical_history: e.target.value,
                    })
                  }
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.medical_history
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="e.g., Hypertension, Diabetes"
                  rows={3}
                />
                {errors.medical_history && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.medical_history}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medications <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="medications"
                  value={formData.medications}
                  onChange={(e) =>
                    setFormData({ ...formData, medications: e.target.value })
                  }
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.medications
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="e.g., Metoprolol 50mg daily, Atorvastatin 20mg"
                  rows={3}
                />
                {errors.medications && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.medications}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Allergy <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="allergy"
                  value={formData.allergy}
                  onChange={(e) =>
                    setFormData({ ...formData, allergy: e.target.value })
                  }
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.allergy
                      ? "border-red-500 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="e.g., Penicillin, None"
                  rows={2}
                />
                {errors.allergy && (
                  <p className="text-red-500 text-sm mt-1">{errors.allergy}</p>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? "Registering..." : "✓ Register Patient"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Patients List */}
      <div
        className="bg-white rounded-lg shadow-lg overflow-hidden"
        style={{
          animation: "fadeInSlideUp 0.6s ease-out 0.3s backwards",
        }}
      >
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-800">
              Registered Patients ({patients.length})
            </h2>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, ID, location..."
                className="w-full md:w-80 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Patient ID
                </th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Name
                </th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Age
                </th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Sex
                </th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Location
                </th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Demographics
                </th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Registered
                </th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {patients
                .filter((patient) => {
                  if (!searchTerm) return true;
                  const search = searchTerm.toLowerCase();
                  return (
                    patient.patient_id_no?.toLowerCase().includes(search) ||
                    patient.first_name?.toLowerCase().includes(search) ||
                    patient.last_name?.toLowerCase().includes(search) ||
                    `${patient.first_name} ${patient.last_name}`
                      .toLowerCase()
                      .includes(search) ||
                    patient.municipality?.toLowerCase().includes(search) ||
                    patient.province?.toLowerCase().includes(search) ||
                    patient.contact_no?.toLowerCase().includes(search)
                  );
                })
                .map((patient) => (
                  <tr
                    key={patient.id}
                    className="border-b border-gray-100 hover:bg-[#F0F4F1] transition"
                  >
                    <td className="py-4 px-8 font-semibold text-gray-800">
                      {patient.patient_id_no}
                    </td>
                    <td className="py-4 px-8 font-medium text-gray-800">
                      {patient.first_name} {patient.last_name}
                    </td>
                    <td className="py-4 px-8 text-gray-600">{patient.age}</td>
                    <td className="py-4 px-8 text-gray-600">{patient.sex}</td>
                    <td className="py-4 px-8 text-gray-600">
                      {patient.municipality}, {patient.province}
                    </td>
                    <td className="py-4 px-8">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          patient.demographics_complete
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {patient.demographics_complete
                          ? "✓ Complete"
                          : "Incomplete"}
                      </span>
                    </td>
                    <td className="py-4 px-8 text-gray-600">
                      {new Date(patient.date_registered).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-8">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedPatient(patient);
                            setShowDetailsModal(true);
                            fetchLabHistory(patient);
                          }}
                          className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1 hover:underline transition"
                        >
                          View Details <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(patient)}
                          className="text-amber-600 hover:text-amber-800 font-semibold text-sm flex items-center gap-1 hover:underline transition"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => router.push("/dashboard/test-request")}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-1 hover:underline transition"
                        >
                          Test Request <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setPatientToDelete(patient);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-500 hover:text-red-700 font-semibold text-sm flex items-center gap-1 hover:underline transition"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Details Modal */}
      {showDetailsModal && selectedPatient && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              animation: "slideInFromTop 0.4s ease-out",
            }}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#3B6255] to-green-900 text-white px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <h3 className="text-2xl font-bold">Patient Details</h3>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPatient(null);
                  setLabHistory([]);
                }}
                className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6">
              {/* Personal Information */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#3B6255]" />
                  Personal Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Patient ID
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.patient_id_no}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Full Name
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.first_name}{" "}
                      {selectedPatient.middle_name
                        ? selectedPatient.middle_name + " "
                        : ""}
                      {selectedPatient.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Age
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.age} years old
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Sex
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.sex}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Civil Status
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.civil_status || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Birthdate
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {new Date(selectedPatient.birthdate).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Contact No.
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.contact_no}
                    </p>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">
                  Address
                </h4>
                <div className="space-y-2 text-gray-700">
                  {selectedPatient.address_house_no && (
                    <p>
                      <span className="font-semibold">House No.:</span>{" "}
                      {selectedPatient.address_house_no}
                    </p>
                  )}
                  {selectedPatient.address_street && (
                    <p>
                      <span className="font-semibold">Street:</span>{" "}
                      {selectedPatient.address_street}
                    </p>
                  )}
                  {selectedPatient.address_barangay && (
                    <p>
                      <span className="font-semibold">Barangay:</span>{" "}
                      {selectedPatient.address_barangay}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold">Municipality:</span>{" "}
                    {selectedPatient.municipality}
                  </p>
                  <p>
                    <span className="font-semibold">Province:</span>{" "}
                    {selectedPatient.province}
                  </p>
                </div>
              </div>

              {/* Medical Information */}
              <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">
                  Medical Information
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Medical History
                    </label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">
                      {selectedPatient.medical_history}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Medications
                    </label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">
                      {selectedPatient.medications}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Allergies
                    </label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">
                      {selectedPatient.allergy}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lab History */}
              <div className="bg-teal-50 p-6 rounded-lg border border-teal-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-[#3B6255]" />
                  Lab History
                </h4>

                {labHistoryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="w-6 h-6 text-[#3B6255] animate-spin mr-2" />
                    <span className="text-gray-500 text-sm">Loading lab history...</span>
                  </div>
                ) : labHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No lab results on record yet.</p>
                  </div>
                ) : (
                  <>
                    {/* Section filter tabs */}
                    {(() => {
                      const allSections = Array.from(
                        new Set(
                          labHistory.flatMap((r: any) =>
                            (r.requested_tests || []).map((t: any) => t.section)
                          )
                        )
                      ) as string[];
                      return (
                        <div className="flex flex-wrap gap-2 mb-4">
                          <button
                            onClick={() => setLabHistoryTab("all")}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${labHistoryTab === "all" ? "bg-[#3B6255] text-white" : "bg-white text-gray-600 border border-gray-300 hover:border-[#3B6255]"}`}
                          >
                            All
                          </button>
                          {allSections.map((sec) => (
                            <button
                              key={sec}
                              onClick={() => setLabHistoryTab(sec)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${labHistoryTab === sec ? "bg-[#3B6255] text-white" : "bg-white text-gray-600 border border-gray-300 hover:border-[#3B6255]"}`}
                            >
                              {sec}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Test request cards */}
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {labHistory.map((req: any) => {
                        const filteredTests = (req.requested_tests || []).filter(
                          (t: any) => labHistoryTab === "all" || t.section === labHistoryTab
                        );
                        if (filteredTests.length === 0) return null;
                        return (
                          <div key={req.id} className="bg-white rounded-lg border border-teal-100 p-4 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  {req.requesting_physician || "—"}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {req.sample_collection_datetime
                                    ? new Date(req.sample_collection_datetime).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                    : req.created_at
                                    ? new Date(req.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                    : "—"}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                req.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : req.status === "in_progress"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                                {req.status === "completed" ? "✓ Completed" : req.status === "in_progress" ? "In Progress" : "Pending"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {filteredTests.map((t: any, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 rounded text-xs font-medium">
                                  {t.test_name}
                                </span>
                              ))}
                            </div>
                            {req.notes && (
                              <p className="text-xs text-gray-400 mt-2 italic">Note: {req.notes}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-gray-400 mt-3 text-right">
                      {labHistory.length} request{labHistory.length !== 1 ? "s" : ""} found
                    </p>
                  </>
                )}
              </div>

              {/* Registration Info */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">
                  Registration
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Registered On
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {new Date(
                        selectedPatient.date_registered,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">
                      Demographics Status
                    </label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          selectedPatient.demographics_complete
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {selectedPatient.demographics_complete
                          ? "✓ Complete"
                          : "Incomplete"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (selectedPatient) openEditModal(selectedPatient);
                }}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition font-semibold flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit Demographics
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPatient(null);
                  setLabHistory([]);
                }}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Patient Confirmation Modal */}
      {showDeleteModal && patientToDelete && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{ animation: "fadeIn 0.3s ease-out" }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full"
            style={{ animation: "slideInFromTop 0.4s ease-out" }}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-700 text-white px-8 py-6 rounded-t-lg flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-xl font-bold">Delete Patient</h3>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-gray-700 text-sm">
                  Are you sure you want to delete{" "}
                  <span className="font-bold text-red-700">
                    {patientToDelete.first_name} {patientToDelete.last_name}
                  </span>
                  ?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Patient ID: {patientToDelete.patient_id_no}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                This action cannot be undone. All records associated with this
                patient may also be affected.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-8 py-4 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPatientToDelete(null);
                }}
                className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Demographics Modal ─────────────────────────────────────────── */}
      {showEditModal && patientToEdit && editFormData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: "fadeIn 0.3s ease-out" }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ animation: "slideInFromTop 0.4s ease-out" }}>

            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-amber-700 text-white px-8 py-5 flex items-center justify-between rounded-t-xl z-10">
              <div className="flex items-center gap-3">
                <Pencil className="w-6 h-6" />
                <div>
                  <h3 className="text-xl font-bold">Edit Patient Demographics</h3>
                  <p className="text-xs text-amber-100 mt-0.5">{patientToEdit.patient_id_no} — {patientToEdit.first_name} {patientToEdit.last_name}</p>
                </div>
              </div>
              <button onClick={() => { setShowEditModal(false); setPatientToEdit(null); setEditSuccess(false); }} className="hover:bg-white/20 p-2 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSuccess ? (
              <div className="p-10 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-2xl font-bold text-gray-800 mb-2">Demographics Updated!</h4>
                <p className="text-gray-500 mb-8">Changes for <span className="font-semibold text-gray-700">{editFormData.first_name} {editFormData.last_name}</span> have been saved.</p>
                <button onClick={() => { setShowEditModal(false); setPatientToEdit(null); setEditSuccess(false); }} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-700 text-white rounded-lg hover:shadow-lg transition font-semibold">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-8 space-y-6">

                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(["last_name", "first_name", "middle_name"] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {field === "last_name" ? "Last Name" : field === "first_name" ? "First Name" : "Middle Name"}
                        {field !== "middle_name" && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={editFormData[field]}
                        onChange={(e) => setEditFormData({ ...editFormData, [field]: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-800 bg-white ${editErrors[field] ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                        placeholder={field === "middle_name" ? "Optional" : ""}
                      />
                      {editErrors[field] && <p className="text-red-500 text-sm mt-1">{editErrors[field]}</p>}
                    </div>
                  ))}
                </div>

                {/* Age and Birthdate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Age <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={editFormData.age}
                      onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-800 bg-white ${editErrors.age ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                      min="1"
                    />
                    {editErrors.age && <p className="text-red-500 text-sm mt-1">{editErrors.age}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Birthdate <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={editFormData.birthdate}
                      onChange={(e) => setEditFormData({ ...editFormData, birthdate: e.target.value })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-800 bg-white ${editErrors.birthdate ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                    />
                    {editErrors.birthdate && <p className="text-red-500 text-sm mt-1">{editErrors.birthdate}</p>}
                  </div>
                </div>

                {/* Sex, Civil Status, Contact */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Sex <span className="text-red-500">*</span></label>
                    <select
                      value={editFormData.sex}
                      onChange={(e) => setEditFormData({ ...editFormData, sex: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-800 bg-white"
                    >
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Civil Status</label>
                    <select
                      value={editFormData.civil_status || "Single"}
                      onChange={(e) => setEditFormData({ ...editFormData, civil_status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-800 bg-white"
                    >
                      <option>Single</option>
                      <option>Married</option>
                      <option>Widowed</option>
                      <option>Separated</option>
                      <option>Divorced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact No. <span className="text-red-500">*</span></label>
                    <PhoneInputMask
                      value={editFormData.contact_no}
                      onChange={(val) => setEditFormData({ ...editFormData, contact_no: val })}
                      error={editErrors.contact_no}
                      className="mb-0"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-gray-800 mb-4">Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: "address_house_no", label: "House No.", required: false, placeholder: "Optional" },
                      { key: "address_street", label: "Street Name", required: false, placeholder: "Optional" },
                      { key: "address_barangay", label: "Barangay", required: false, placeholder: "Optional" },
                      { key: "municipality", label: "Municipality/City", required: true, placeholder: "e.g., Makati" },
                      { key: "province", label: "Province", required: true, placeholder: "e.g., NCR" },
                    ].map(({ key, label, required, placeholder }) => (
                      <div key={key}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          value={(editFormData as any)[key]}
                          onChange={(e) => setEditFormData({ ...editFormData, [key]: e.target.value })}
                          placeholder={placeholder}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-800 bg-white ${(editErrors as any)[key] ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                        />
                        {(editErrors as any)[key] && <p className="text-red-500 text-sm mt-1">{(editErrors as any)[key]}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Medical Information */}
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-gray-800 mb-4">Medical Information</h3>
                  {[
                    { key: "medical_history", label: "Medical History", placeholder: "e.g., Hypertension, Diabetes" },
                    { key: "medications", label: "Current Medications", placeholder: "e.g., Metformin 500mg" },
                    { key: "allergy", label: "Allergies", placeholder: "e.g., Penicillin, Shellfish" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="mb-4 last:mb-0">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {label} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={(editFormData as any)[key]}
                        onChange={(e) => setEditFormData({ ...editFormData, [key]: e.target.value })}
                        placeholder={placeholder}
                        rows={3}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-800 bg-white ${(editErrors as any)[key] ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                      />
                      {(editErrors as any)[key] && <p className="text-red-500 text-sm mt-1">{(editErrors as any)[key]}</p>}
                    </div>
                  ))}
                </div>

                {/* Submit error */}
                {editErrors.submit && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-lg">✕ {editErrors.submit}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleEditSubmit}
                    disabled={editSubmitting}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-700 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {editSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => { setShowEditModal(false); setPatientToEdit(null); }}
                    disabled={editSubmitting}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Test Request Popup ───────────────────────────────────────────────── */}
      {showTRPopup && trPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: "fadeIn 0.3s ease-out" }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ animation: "slideInFromTop 0.4s ease-out" }}>

            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#3B6255] to-green-900 text-white px-8 py-5 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-6 h-6" />
                <div>
                  <h3 className="text-xl font-bold">Create Test Request</h3>
                  <p className="text-xs text-[#CBDED3] mt-0.5">Patient just registered — create their test request now</p>
                </div>
              </div>
              <button onClick={closeTRPopup} className="hover:bg-white/20 p-2 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {trSuccess ? (
              /* Success state */
              <div className="p-10 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-2xl font-bold text-gray-800 mb-2">Test Request Created!</h4>
                <p className="text-gray-500 mb-2">
                  Test request for <span className="font-semibold text-gray-700">{trPatient.first_name} {trPatient.last_name}</span> has been saved.
                </p>
                <p className="text-sm text-gray-400 mb-8">{trTests.length} test{trTests.length !== 1 ? "s" : ""} requested</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={closeTRPopup} className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold">
                    Close
                  </button>
                  <button onClick={() => router.push("/dashboard/billing")} className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2">
                    Go to Billing <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 space-y-6">

                {/* Patient info banner */}
                <div className="bg-[#F0F4F1] border border-[#CBDED3] rounded-lg px-5 py-3 flex items-center gap-3">
                  <User className="w-5 h-5 text-[#3B6255]" />
                  <div>
                    <p className="font-bold text-gray-800">{trPatient.first_name} {trPatient.middle_name ? trPatient.middle_name + " " : ""}{trPatient.last_name}</p>
                    <p className="text-xs text-gray-500">{trPatient.patient_id_no} · {trPatient.sex} · {trPatient.age} yrs</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Physician */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Stethoscope className="w-4 h-4 inline mr-1" />
                      Requesting Physician <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={trPhysician}
                      onChange={e => setTrPhysician(e.target.value)}
                      placeholder="e.g. Dr. Juan Dela Cruz"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white"
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={trNotes}
                      onChange={e => setTrNotes(e.target.value)}
                      placeholder="e.g. Fasting required, STAT..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition bg-white"
                    />
                  </div>
                </div>

                {/* Test selection */}
                <div className="border border-gray-200 rounded-lg p-5">
                  <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-[#3B6255]" />
                    Select Tests <span className="text-red-500">*</span>
                  </h4>

                  {/* Section tabs */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {TR_LAB_SECTIONS.map(sec => (
                      <button
                        key={sec}
                        onClick={() => setTrSection(sec)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${trSection === sec ? "bg-[#3B6255] text-white" : "bg-gray-100 text-gray-600 hover:bg-[#CBDED3] hover:text-[#3B6255]"}`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>

                  {/* Test buttons */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                    {(TR_TESTS_BY_SECTION[trSection] || []).map(test => {
                      const added = trTests.some(t => t.test_name === test && t.section === trSection);
                      return (
                        <button
                          key={test}
                          onClick={() => {
                            if (!added) setTrTests(prev => [...prev, { section: trSection, test_name: test }]);
                          }}
                          disabled={added}
                          className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition border ${added ? "bg-[#CBDED3] text-[#3B6255] border-[#3B6255] cursor-default" : "bg-white text-gray-700 border-gray-200 hover:border-[#3B6255] hover:bg-[#F0F4F1]"}`}
                        >
                          {added ? <Check className="w-3 h-3 inline mr-1" /> : <span className="mr-1">+</span>}
                          {test}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected tests */}
                  {trTests.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Selected ({trTests.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {trTests.map((t, i) => (
                          <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B6255] text-white rounded-full text-xs font-medium">
                            <span className="opacity-60 text-[10px] uppercase">{t.section.split(" ")[0]}</span>
                            <span>{t.test_name}</span>
                            <button onClick={() => setTrTests(prev => prev.filter((_, idx) => idx !== i))} className="ml-1 opacity-70 hover:opacity-100 text-sm leading-none">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error */}
                {trError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-lg">✕ {trError}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleTRSubmit}
                    disabled={trSubmitting || !trPhysician.trim() || trTests.length === 0}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {trSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    {trSubmitting ? "Saving..." : "Submit Test Request"}
                  </button>
                  <button
                    onClick={closeTRPopup}
                    disabled={trSubmitting}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                  >
                    Skip for Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}