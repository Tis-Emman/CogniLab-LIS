'use client';

import { useState, useEffect } from 'react';
import PhoneInputMask from '@/components/PhoneInputMask';
import { useRouter } from 'next/navigation';
import { Plus, User, ArrowRight, Trash2, Loader, X, CheckCircle } from 'lucide-react';
import { fetchPatients, addPatient, updatePatient, deletePatient, addTestResult } from '@/lib/database';
import { useAuth } from '@/lib/authContext';
import { TEST_REFERENCE_RANGES } from '@/lib/mockData';

interface Patient {
  id: string;
  patient_id_no: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  age: number;
  birthdate: string;
  sex: string;
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

const LAB_SECTIONS = [
  'BLOOD BANK',
  'HEMATOLOGY',
  'CLINICAL MICROSCOPY',
  'CLINICAL CHEMISTRY',
  'MICROBIOLOGY',
  'IMMUNOLOGY/SEROLOGY',
  'HISTOPATHOLOGY',
];

// Dynamically generate TESTS_BY_SECTION from TEST_REFERENCE_RANGES
const TESTS_BY_SECTION: Record<string, { name: string; referenceRange: string; unit: string }[]> = Object.keys(
  TEST_REFERENCE_RANGES,
).reduce((acc, section) => {
  acc[section] = Object.entries(TEST_REFERENCE_RANGES[section]).map(([testName, range]) => ({
    name: testName,
    referenceRange: range.normal || `${range.min || ''} - ${range.max || ''}`,
    unit: range.unit,
  }));
  return acc;
}, {} as Record<string, { name: string; referenceRange: string; unit: string }[]>);

// Predefined dropdown options for specific tests
const TEST_DROPDOWN_OPTIONS: Record<string, string[]> = {
  'ABO Blood Typing': ['Type A', 'Type B', 'Type AB', 'Type O'],
  'Rh Typing': ['Rh Positive (D+)', 'Rh Negative (D-)'],
  'Crossmatching': ['Compatible', 'Incompatible', 'Least Compatible'],
  'Antibody Screening': ['Positive', 'Negative'],
  'Infectious Disease Screening': ['Non-Reactive for any infectious disease', 'Reactive for HIV', 'Reactive for HBV', 'Reactive for HCV', 'Reactive for Syphilis', 'Reactive for Malaria'],
  'Culture': ['No growth', 'Growth detected'],
  'Sensitivity': ['S (Susceptible)', 'I (Intermediate)', 'R (Resistant)'],
  'Gram Staining': [
    'Negative/Normal',
    'Positive - Gram Positive Cocci',
    'Positive - Gram Positive Bacilli',
    'Positive - Gram Negative Cocci',
    'Positive - Gram Negative Bacilli',
  ],
  'Pus Cells (WBCs)': ['Occasional', 'Few', 'Moderate', 'Many'],
  'India Ink': ['Positive (Encapsulated yeast cells seen)', 'Negative (No encapsulated yeast cells seen)'],
  'Wet Mount': ['Normal/Negative', 'Abnormal'],
  'KOH Mount': ['Negative', 'Positive'],
  'Pregnancy Test (hCG)': ['Negative', 'Positive'],
  'Fecal Occult Blood Test': ['Negative', 'Positive'],
  'Fecalysis - Ova or Parasite': ['Negative', 'Positive - Ascaris', 'Positive - Hookworm', 'Positive - Trichuris'],
  'Kidney Biopsy': ['Normal/Unremarkable', 'Active disease', 'Scarring'],
  'Bone Biopsy': ['Normal', 'Anormal', 'Inconclusive'],
  'Liver Biopsy Fibrosis': ['F0: No fibrosis (Healthy)', 'F1: Portal fibrosis without septa (Mild fibrosis)', 'F2: Portal fibrosis with few septa (Moderate/Significant fibrosis)', 'F3: Numerous septa without cirrhosis (Severe fibrosis)', 'F4: Cirrhosis (Advanced scarring)'],
  'Liver Biopsy Activity': ['A0: No activity', 'A1: Minimal/mild activity', 'A2: Moderate activity', 'A3: Severe activity'],
  'Fecal Occult Blood Test (FOBT)': ['Positive', 'Negative', 'Invalid'],
  'Pregnancy Test (PT)': ['Positive', 'Negative', 'Invalid'],
  // Routine Fecalysis (FA) Component
  'Routine Fecalysis (FA)': ['No Ova or Parasite seen', 'Scant/Few Ova or Parasite seen', 'Moderate Ova or Parasite seen', 'Many/Numerous Ova or Parasite seen'],
  // Routine Urinalysis (UA) Components
  'UA_Color': ['Clear', 'Pale Yellow', 'Amber'],
  'UA_Transparency': ['Clear', 'Slightly Turbid', 'Turbid', 'Very Turbid'],
  'UA_Protein_Glucose': ['Positive', 'Negative'],
  'UA_Bilirubin_Ketone': ['Positive', 'Negative'],
  'UA_Bacteria_Casts_Crystals': ['None', 'Rare', 'Few', 'Many'],
};

// Custom placeholder hints for specific tests
const TEST_PLACEHOLDER_HINTS: Record<string, string> = {
  'Skin Biopsy': 'e.g., Unremarkable skin',
};

export default function PatientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    patient_id_no: '',
    last_name: '',
    first_name: '',
    middle_name: '',
    age: '',
    birthdate: '',
    sex: 'Male',
    contact_no: '',
    address_house_no: '',
    address_street: '',
    address_barangay: '',
    municipality: '',
    province: '',
    medical_history: '',
    medications: '',
    allergy: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Test Result Form States
  const [showTestForm, setShowTestForm] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [patientSex, setPatientSex] = useState<'Male' | 'Female'>('Male');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [resultValue, setResultValue] = useState('');
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});
  
  // CBC Components State
  const [cbcValues, setCbcValues] = useState({
    neutrophils: '',
    lymphocytes: '',
    monocytes: '',
    eosinophils: '',
    basophils: '',
  });

  // RBC Indices State
  const [rbcValues, setRbcValues] = useState({
    mcv: '',
    mch: '',
    rdw: '',
  });

  // Hemoglobin State (single value based on patient sex)
  const [hemoglobinValue, setHemoglobinValue] = useState('');

  // Hematocrit State (single value based on patient sex)
  const [hematocritValue, setHematocritValue] = useState('');

  // Peripheral Blood Smear (free text)
  const [peripheralSmearValue, setPeripheralSmearValue] = useState('');

  // Platelet Count
  const [plateletCountValue, setPlateletCountValue] = useState('');

  // PT/INR, PTT State
  const [coagulationValues, setCoagulationValues] = useState({
    pt: '',
    inr: '',
    aptt: '',
  });

  // Routine Urinalysis (UA) State
  const [urinalysisValues, setUrinalysisValues] = useState({
    color: '',
    transparency: '',
    pH: '',
    proteinGlucose: '',
    bilirubinKetone: '',
    urobilinogen: '',
    wbcMicroscopic: '',
    rbcMicroscopic: '',
    bacteriaCastsCrystals: '',
  });

  // Culture and Sensitivity State
  const [cultureSensitivityValues, setCultureSensitivityValues] = useState({
    culture: '',
    preliminaryReport: '',
    finalReport: '',
    sensitivity: '',
  });

  // Success Summary State
  const [showSuccessSummary, setShowSuccessSummary] = useState(false);
  const [savedTestsData, setSavedTestsData] = useState<any[]>([]);

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.patient_id_no.trim()) newErrors.patient_id_no = 'Patient ID is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.age || parseInt(formData.age) < 1) newErrors.age = 'Valid age is required';
    if (!formData.birthdate) newErrors.birthdate = 'Birthdate is required';
    // Philippine mobile number validation
    let contact = formData.contact_no.replace(/\s|-/g, '').trim();
    // Acceptable formats: 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX
    let valid = false;
    let normalized = '';
    if (/^09\d{9}$/.test(contact)) {
      valid = true;
      normalized = '+63' + contact.slice(1);
    } else if (/^\+639\d{9}$/.test(contact)) {
      valid = true;
      normalized = contact;
    } else if (/^639\d{9}$/.test(contact)) {
      valid = true;
      normalized = '+63' + contact.slice(2);
    }
    // Reject landline, letters, special chars, wrong length, wrong prefix
    if (!contact) {
      newErrors.contact_no = 'Contact number is required';
    } else if (!valid) {
      newErrors.contact_no = 'Invalid Philippine mobile number.';
    }
    if (!formData.municipality.trim()) newErrors.municipality = 'Municipality is required';
    if (!formData.province.trim()) newErrors.province = 'Province is required';
    if (!formData.medical_history.trim()) newErrors.medical_history = 'Medical history is required';
    if (!formData.medications.trim()) newErrors.medications = 'Medications is required';
    if (!formData.allergy.trim()) newErrors.allergy = 'Allergy information is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      // Wait for setErrors to update, then check latest errors state
      setTimeout(() => {
        // Find the first error field and scroll to it smoothly
        const errorOrder = [
          'patient_id_no',
          'last_name',
          'first_name',
          'age',
          'birthdate',
          'contact_no',
          'municipality',
          'province',
          'medical_history',
          'medications',
          'allergy',
        ];
        for (const key of errorOrder) {
          if (errors[key]) {
            let selector = '';
            if (key === 'contact_no') selector = 'input[type="tel"]';
            else if (key === 'birthdate') selector = 'input[type="date"]';
            else if (key === 'age') selector = 'input[type="number"]';
            else selector = `input[name="${key}"]`;
            const el = document.querySelector(selector);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (el as HTMLInputElement).focus();
              break;
            }
          }
        }
      }, 0);
      return;
    }
    // Normalize and store contact_no
    let contact = formData.contact_no.replace(/\s|-/g, '').trim();
    let normalized = '';
    if (/^09\d{9}$/.test(contact)) {
      normalized = '+63' + contact.slice(1);
    } else if (/^\+639\d{9}$/.test(contact)) {
      normalized = contact;
    } else if (/^639\d{9}$/.test(contact)) {
      normalized = '+63' + contact.slice(2);
    }
    // ...existing code...

    // Check for duplicate Patient ID in memory
    const patientIdExists = patients.some(
      (patient) => patient.patient_id_no === formData.patient_id_no
    );
    if (patientIdExists) {
      setErrors((prev) => ({
        ...prev,
        patient_id_no: 'Patient ID already exists',
      }));
      return;
    }

    setSubmitting(true);
    try {
      await addPatient({
        patient_id_no: formData.patient_id_no,
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name || null,
        age: parseInt(formData.age),
        birthdate: formData.birthdate,
        sex: formData.sex,
        contact_no: normalized,
        address_house_no: formData.address_house_no || null,
        address_street: formData.address_street || null,
        address_barangay: formData.address_barangay,
        municipality: formData.municipality,
        province: formData.province,
        medical_history: formData.medical_history,
        medications: formData.medications,
        allergy: formData.allergy,
      }, user);
      await loadPatients();
      setFormData({
        patient_id_no: '',
        last_name: '',
        first_name: '',
        middle_name: '',
        age: '',
        birthdate: '',
        sex: 'Male',
        contact_no: '',
        address_house_no: '',
        address_street: '',
        address_barangay: '',
        municipality: '',
        province: '',
        medical_history: '',
        medications: '',
        allergy: '',
      });
      setErrors({});
      setShowForm(false);
      
      // Show test result form for the newly added patient
      setNewPatientName(`${formData.first_name} ${formData.last_name}`);
      setPatientSex(formData.sex as 'Male' | 'Female');
      setShowTestForm(true);
    } catch (error: any) {
      if (error?.message === 'Patient ID already exists') {
        setErrors((prev) => ({
          ...prev,
          patient_id_no: 'Patient ID already exists',
        }));
      } else {
        console.error('Error adding patient:', error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this patient?')) {
      await deletePatient(id);
      await loadPatients();
    }
  };

  // Filter tests based on patient sex - hide opposite sex variants
  const HEMATOLOGY_MAIN_TESTS = ['CBC', 'ESR', 'PT/INR, PTT'];
  const currentTests = selectedSection === 'HEMATOLOGY'
    ? (TESTS_BY_SECTION['HEMATOLOGY'] || []).filter(test => HEMATOLOGY_MAIN_TESTS.includes(test.name))
    : (selectedSection ? TESTS_BY_SECTION[selectedSection] || [] : []);

  const validateTestForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedSection) newErrors.section = 'Lab section is required';
    if (!selectedTest) newErrors.test = 'Test is required';
    
    if (selectedTest === 'CBC') {
      if (!cbcValues.neutrophils || !cbcValues.lymphocytes || !cbcValues.monocytes || !cbcValues.eosinophils || !cbcValues.basophils) {
        newErrors.cbc = 'All CBC components are required';
      }
      if (!rbcValues.mcv || !rbcValues.mch || !rbcValues.rdw) {
        newErrors.rbc = 'MCV, MCH, and RDW are required for CBC';
      }
      if (!hemoglobinValue) {
        newErrors.hemoglobin = 'Hemoglobin value is required for CBC';
      }
      if (!hematocritValue) {
        newErrors.hematocrit = 'Hematocrit value is required for CBC';
      }
      if (!plateletCountValue) {
        newErrors.platelet = 'Platelet count is required for CBC';
      }
    } else if (selectedTest === 'RBC Indices (MCV, MCH, RDW)') {
      if (!rbcValues.mcv || !rbcValues.mch || !rbcValues.rdw) {
        newErrors.rbc = 'All RBC indices are required';
      }
    } else if (selectedTest === 'Hemoglobin') {
      if (!hemoglobinValue) {
        newErrors.hemoglobin = 'Hemoglobin value is required';
      }
    } else if (selectedTest === 'PT/INR, PTT') {
      if (!coagulationValues.pt || !coagulationValues.inr || !coagulationValues.aptt) {
        newErrors.coagulation = 'All coagulation values (PT, INR, aPTT) are required';
      }
    } else if (selectedTest === 'Routine Urinalysis (UA)') {
      if (!urinalysisValues.color || !urinalysisValues.transparency || !urinalysisValues.pH || !urinalysisValues.proteinGlucose || !urinalysisValues.bilirubinKetone || !urinalysisValues.urobilinogen || !urinalysisValues.wbcMicroscopic || !urinalysisValues.rbcMicroscopic || !urinalysisValues.bacteriaCastsCrystals) {
        newErrors.urinalysis = 'All urinalysis components are required';
      }
    } else if (selectedTest === 'Culture and Sensitivity') {
      if (!cultureSensitivityValues.culture || !cultureSensitivityValues.preliminaryReport || !cultureSensitivityValues.finalReport || !cultureSensitivityValues.sensitivity) {
        newErrors.cultureSensitivity = 'Culture, Preliminary Report, Final Report, and Sensitivity are all required';
      }
    } else {
      if (!resultValue) newErrors.resultValue = 'Result value is required';
    }

    setTestErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateTestForm()) {
      return;
    }

    const testDetails = currentTests.find((t) => t.name === selectedTest);
    if (!testDetails) return;

    setTestSubmitting(true);
    const savedTests: any[] = [];
    
    try {
      if (selectedTest === 'CBC') {
        // Save CBC as ONE test result (not 5 separate rows)
        const cbcComponents = [
          { name: 'Neutrophils', value: cbcValues.neutrophils, range: '45 - 75', unit: '%' },
          { name: 'Lymphocytes', value: cbcValues.lymphocytes, range: '16 - 46', unit: '%' },
          { name: 'Monocytes', value: cbcValues.monocytes, range: '4 - 11', unit: '%' },
          { name: 'Eosinophils', value: cbcValues.eosinophils, range: '0 - 8', unit: '%' },
          { name: 'Basophils', value: cbcValues.basophils, range: '0 - 3', unit: '%' },
        ];

        const testDetailsCbc = currentTests.find((t) => t.name === 'CBC');
        const sexLabel = patientSex === 'Male' ? 'Male' : 'Female';
        const cbcLines = [
          ...cbcComponents.map((c) => `${c.name}: ${c.value}${c.unit}`),
          `MCV: ${rbcValues.mcv} fL`,
          `MCH: ${rbcValues.mch} pg`,
          `RDW: ${rbcValues.rdw} %`,
          `Hemoglobin (${sexLabel}): ${hemoglobinValue} g/dL`,
          `Hematocrit (${sexLabel}): ${hematocritValue} %`,
          `Platelet Count: ${plateletCountValue} x10^9/L`,
          ...(peripheralSmearValue ? [`Peripheral Blood Smear: ${peripheralSmearValue}`] : []),
        ];
        const cbcResultValue = cbcLines.join('\n');

        await addTestResult(
          {
            patient_name: newPatientName,
            section: selectedSection,
            test_name: 'CBC',
            result_value: cbcResultValue,
            reference_range: testDetailsCbc?.referenceRange || testDetails.referenceRange,
            unit: '',
          },
          user,
        );

        // Success summary can still list components
        for (const component of cbcComponents) savedTests.push(component);
        savedTests.push({ name: 'MCV', value: rbcValues.mcv, range: '80 - 100', unit: 'fL' });
        savedTests.push({ name: 'MCH', value: rbcValues.mch, range: '27 - 31', unit: 'pg' });
        savedTests.push({ name: 'RDW', value: rbcValues.rdw, range: '11.5 - 14.5', unit: '%' });
        savedTests.push({
          name: `Hemoglobin (${sexLabel})`,
          value: hemoglobinValue,
          range: sexLabel === 'Male' ? '14.0 - 17.0' : '12.0 - 15.0',
          unit: 'g/dL',
        });
        savedTests.push({
          name: `Hematocrit (${sexLabel})`,
          value: hematocritValue,
          range: sexLabel === 'Male' ? '40 - 54' : '37 - 47',
          unit: '%',
        });
        savedTests.push({ name: 'Platelet Count', value: plateletCountValue, range: '150 - 450', unit: 'x10^9/L' });
        if (peripheralSmearValue) {
          savedTests.push({ name: 'Peripheral Blood Smear', value: peripheralSmearValue, range: '', unit: '' });
        }
      } else if (selectedTest === 'RBC Indices (MCV, MCH, RDW)') {
        // Submit each RBC Indices component separately
        const rbcComponents = [
          { name: 'MCV', value: rbcValues.mcv, range: '80 - 100', unit: 'fL' },
          { name: 'MCH', value: rbcValues.mch, range: '27 - 31', unit: 'pg' },
          { name: 'RDW', value: rbcValues.rdw, range: '11.5 - 14.5', unit: '%' },
        ];

        for (const component of rbcComponents) {
          await addTestResult({
            patient_name: newPatientName,
            section: selectedSection,
            test_name: component.name,
            result_value: component.value,
            reference_range: component.range,
            unit: component.unit,
          }, user);
          
          savedTests.push(component);
        }
      } else if (selectedTest === 'Hemoglobin') {
        // Submit Hemoglobin based on patient sex
        const testName = patientSex === 'Male' ? 'Hemoglobin (Male)' : 'Hemoglobin (Female)';
        const referenceRange = patientSex === 'Male' ? '14.0 - 17.0' : '12.0 - 15.0';
        
        await addTestResult({
          patient_name: newPatientName,
          section: selectedSection,
          test_name: testName,
          result_value: hemoglobinValue,
          reference_range: referenceRange,
          unit: 'g/dL',
        }, user);
        
        savedTests.push({
          name: testName,
          value: hemoglobinValue,
          range: referenceRange,
          unit: 'g/dL',
        });
      } else if (selectedTest === 'PT/INR, PTT') {
        // Save coagulation as ONE test result row (not 3 separate rows)
        const testDetailsCoag = currentTests.find((t) => t.name === 'PT/INR, PTT') || testDetails;
        const coagLines = [
          `PT: ${coagulationValues.pt} seconds`,
          `INR: ${coagulationValues.inr}`,
          `aPTT: ${coagulationValues.aptt} seconds`,
        ];

        await addTestResult(
          {
            patient_name: newPatientName,
            section: selectedSection,
            test_name: 'PT/INR, PTT',
            result_value: coagLines.join('\n'),
            reference_range: testDetailsCoag.referenceRange,
            unit: '',
          },
          user,
        );

        savedTests.push({ name: 'PT', value: coagulationValues.pt, range: '11.0 - 13.5', unit: 'seconds' });
        savedTests.push({ name: 'INR', value: coagulationValues.inr, range: '0.8 - 1.2', unit: '' });
        savedTests.push({ name: 'aPTT', value: coagulationValues.aptt, range: '25.0 - 35.0', unit: 'seconds' });
      } else if (selectedTest === 'Routine Urinalysis (UA)') {
        // Submit each urinalysis component separately
        const urinalysisComponents = [
          { name: 'UA Color', value: urinalysisValues.color, range: 'Clear, Pale Yellow, Amber', unit: '' },
          { name: 'UA Transparency', value: urinalysisValues.transparency, range: 'Clear', unit: '' },
          { name: 'UA pH', value: urinalysisValues.pH, range: '4.5 - 8.0', unit: '' },
          { name: 'UA Protein/Glucose', value: urinalysisValues.proteinGlucose, range: 'Positive, Negative', unit: '' },
          { name: 'UA Bilirubin/Ketone', value: urinalysisValues.bilirubinKetone, range: 'Positive, Negative', unit: '' },
          { name: 'UA Urobilinogen', value: urinalysisValues.urobilinogen, range: '0.2 - 1.0', unit: 'IEU/dL' },
          { name: 'UA WBC (Microscopic)', value: urinalysisValues.wbcMicroscopic, range: '0 - 5', unit: 'hpf' },
          { name: 'UA RBC (Microscopic)', value: urinalysisValues.rbcMicroscopic, range: '0 - 2', unit: 'hpf' },
          { name: 'UA Bacteria/Casts/Crystals', value: urinalysisValues.bacteriaCastsCrystals, range: 'None, Rare, Few, Many', unit: '' },
        ];

        for (const component of urinalysisComponents) {
          await addTestResult({
            patient_name: newPatientName,
            section: selectedSection,
            test_name: component.name,
            result_value: component.value,
            reference_range: component.range,
            unit: component.unit,
          }, user);
          
          savedTests.push(component);
        }
      } else if (selectedTest === 'Culture and Sensitivity') {
        // Submit each culture and sensitivity component separately
        const cultureAndSensitivityComponents = [
          { name: 'Culture', value: cultureSensitivityValues.culture, range: 'Organism identification', unit: '' },
          { name: 'Preliminary Report', value: cultureSensitivityValues.preliminaryReport, range: 'Growth status after 24/48 hours', unit: '' },
          { name: 'Final Report', value: cultureSensitivityValues.finalReport, range: 'Final growth status after 5-7 days', unit: '' },
          { name: 'Sensitivity (Antibiogram)', value: cultureSensitivityValues.sensitivity, range: 'S (Susceptible), I (Intermediate), R (Resistant)', unit: '' },
        ];

        for (const component of cultureAndSensitivityComponents) {
          await addTestResult({
            patient_name: newPatientName,
            section: selectedSection,
            test_name: component.name,
            result_value: component.value,
            reference_range: component.range,
            unit: component.unit,
          }, user);
          
          savedTests.push(component);
        }
      } else {
        await addTestResult({
          patient_name: newPatientName,
          section: selectedSection,
          test_name: selectedTest,
          result_value: resultValue,
          reference_range: testDetails.referenceRange,
          unit: testDetails.unit,
        }, user);
        
        savedTests.push({
          name: selectedTest,
          value: resultValue,
          range: testDetails.referenceRange,
          unit: testDetails.unit,
        });
      }

      // Show success summary
      setSavedTestsData(savedTests);
      setShowSuccessSummary(true);
      
      // Auto redirect after 3 seconds
      setTimeout(() => {
        router.push('/dashboard/results');
      }, 3000);
    } catch (error) {
      console.error('Error saving test result:', error);
      setTestSubmitting(false);
    }
  };

  const closeTestForm = () => {
    setShowTestForm(false);
    setSelectedSection('');
    setSelectedTest('');
    setResultValue('');
    setCbcValues({ neutrophils: '', lymphocytes: '', monocytes: '', eosinophils: '', basophils: '' });
    setRbcValues({ mcv: '', mch: '', rdw: '' });
    setHemoglobinValue('');
    setHematocritValue('');
    setPeripheralSmearValue('');
    setPlateletCountValue('');
    setCoagulationValues({ pt: '', inr: '', aptt: '' });
    setUrinalysisValues({ color: '', transparency: '', pH: '', proteinGlucose: '', bilirubinKetone: '', urobilinogen: '', wbcMicroscopic: '', rbcMicroscopic: '', bacteriaCastsCrystals: '' });
    setCultureSensitivityValues({ culture: '', preliminaryReport: '', finalReport: '', sensitivity: '' });
    setTestErrors({});
    setNewPatientName('');
    setPatientSex('Male');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8" style={{
      animation: 'fadeIn 0.5s ease-out'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{
        animation: 'fadeInSlideUp 0.6s ease-out',
        animationDelay: '0.1s',
        animationFillMode: 'both'
      }}>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Patient Management</h1>
          <p className="text-gray-600 text-sm mt-1">Register and manage patient demographics and information</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
        >
          {showForm ? (
            <>
              ✕ Cancel
            </>
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
        <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]" style={{
          animation: 'fadeInSlideUp 0.6s ease-out 0.2s backwards'
        }}>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Patient Demographics Form</h2>
          <p className="text-gray-600 text-sm mb-6">Fields marked with <span className="text-red-500 font-bold">*</span> are required</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient ID Section */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Patient ID No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.patient_id_no}
                  onChange={(e) => setFormData({ ...formData, patient_id_no: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.patient_id_no ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., PAT001"
                />
                {errors.patient_id_no && <p className="text-red-500 text-sm mt-1">{errors.patient_id_no}</p>}
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
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.last_name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Surname"
                />
                {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.first_name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Given name"
                />
                {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.age ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter age"
                  min="1"
                />
                {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Birthdate (mm/dd/yyyy) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.birthdate}
                  onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                    errors.birthdate ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {errors.birthdate && <p className="text-red-500 text-sm mt-1">{errors.birthdate}</p>}
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
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
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
                  onChange={(val) => setFormData({ ...formData, contact_no: val })}
                  error={errors.contact_no}
                  className="mb-0"
                />
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
                    onChange={(e) => setFormData({ ...formData, address_house_no: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, address_barangay: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                      errors.municipality ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Makati"
                  />
                  {errors.municipality && <p className="text-red-500 text-sm mt-1">{errors.municipality}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                      errors.province ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="e.g., NCR"
                  />
                  {errors.province && <p className="text-red-500 text-sm mt-1">{errors.province}</p>}
                </div>
              </div>
            </div>

            {/* Medical Section */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-gray-800 mb-4">Medical Information</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medical History <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="medical_history"
                  value={formData.medical_history}
                  onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.medical_history ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Hypertension, Diabetes"
                  rows={3}
                />
                {errors.medical_history && <p className="text-red-500 text-sm mt-1">{errors.medical_history}</p>}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medications <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="medications"
                  value={formData.medications}
                  onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.medications ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Metoprolol 50mg daily, Atorvastatin 20mg"
                  rows={3}
                />
                {errors.medications && <p className="text-red-500 text-sm mt-1">{errors.medications}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Allergy <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="allergy"
                  value={formData.allergy}
                  onChange={(e) => setFormData({ ...formData, allergy: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                    errors.allergy ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Penicillin, None"
                  rows={2}
                />
                {errors.allergy && <p className="text-red-500 text-sm mt-1">{errors.allergy}</p>}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Registering...' : '✓ Register Patient'}
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
      <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{
        animation: 'fadeInSlideUp 0.6s ease-out 0.3s backwards'
      }}>
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
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
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
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Patient ID</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Age</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Sex</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Location</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Demographics</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Registered</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
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
                    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(search) ||
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
                  <td className="py-4 px-8 font-semibold text-gray-800">{patient.patient_id_no}</td>
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
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {patient.demographics_complete ? '✓ Complete' : 'Incomplete'}
                    </span>
                  </td>
                  <td className="py-4 px-8 text-gray-600">{new Date(patient.date_registered).toLocaleDateString()}</td>
                  <td className="py-4 px-8">
                    <button 
                      onClick={() => {
                        setSelectedPatient(patient);
                        setShowDetailsModal(true);
                      }}
                      className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1 hover:underline transition"
                    >
                      View Details <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Details Modal */}
      {showDetailsModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{
            animation: 'slideInFromTop 0.4s ease-out'
          }}>
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
                    <label className="text-xs font-semibold text-gray-600 uppercase">Patient ID</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.patient_id_no}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Full Name</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {selectedPatient.first_name} {selectedPatient.middle_name ? selectedPatient.middle_name + ' ' : ''}{selectedPatient.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Age</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.age} years old</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Sex</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.sex}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Birthdate</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {new Date(selectedPatient.birthdate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Contact No.</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">{selectedPatient.contact_no}</p>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Address</h4>
                <div className="space-y-2 text-gray-700">
                  {selectedPatient.address_house_no && (
                    <p><span className="font-semibold">House No.:</span> {selectedPatient.address_house_no}</p>
                  )}
                  {selectedPatient.address_street && (
                    <p><span className="font-semibold">Street:</span> {selectedPatient.address_street}</p>
                  )}
                  {selectedPatient.address_barangay && (
                    <p><span className="font-semibold">Barangay:</span> {selectedPatient.address_barangay}</p>
                  )}
                  <p><span className="font-semibold">Municipality:</span> {selectedPatient.municipality}</p>
                  <p><span className="font-semibold">Province:</span> {selectedPatient.province}</p>
                </div>
              </div>

              {/* Medical Information */}
              <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Medical Information</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Medical History</label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">{selectedPatient.medical_history}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Medications</label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">{selectedPatient.medications}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Allergies</label>
                    <p className="text-sm text-gray-700 mt-2 bg-white p-3 rounded border border-amber-100">{selectedPatient.allergy}</p>
                  </div>
                </div>
              </div>

              {/* Registration Info */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Registration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Registered On</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      {new Date(selectedPatient.date_registered).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase">Demographics Status</label>
                    <p className="text-base font-semibold text-gray-800 mt-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedPatient.demographics_complete
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedPatient.demographics_complete ? '✓ Complete' : 'Incomplete'}
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
                  setShowDetailsModal(false);
                  setSelectedPatient(null);
                }}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Summary Card */}
      {showSuccessSummary && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-6 flex items-center gap-3">
              <CheckCircle className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Test Results Saved Successfully!</h2>
            </div>

            {/* Summary Content */}
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-gray-600"><span className="font-semibold">Patient:</span> {newPatientName}</p>
                <p className="text-gray-600"><span className="font-semibold">Section:</span> {selectedSection}</p>
              </div>

              {/* Saved Tests List */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 mb-3">Test Results Added:</h3>
                {savedTestsData.map((test, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-gray-200">
                    <p className="font-semibold text-gray-800">{test.name}</p>
                    <p className="text-sm text-gray-600">Result: <span className="text-[#3B6255] font-semibold">{test.value} {test.unit}</span></p>
                    <p className="text-sm text-gray-600">Reference: {test.range} {test.unit}</p>
                  </div>
                ))}
              </div>

              {/* Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-gray-700">Redirecting to Results page in <span className="font-bold text-[#3B6255]">3 seconds</span>...</p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-8 py-4 flex justify-end gap-3">
              <button
                onClick={() => router.push('/dashboard/results')}
                className="px-6 py-2 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold"
              >
                Go to Results Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Result Form Modal */}
      {showTestForm && !showSuccessSummary && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#3B6255] to-green-900 text-white px-8 py-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Enter Test Result</h2>
              <button
                onClick={closeTestForm}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              <form onSubmit={handleTestSubmit} className="space-y-6">
                {/* Patient Name (Read-only) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Patient Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newPatientName}
                    readOnly
                    className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-800 cursor-not-allowed"
                  />
                </div>

                {/* Lab Section */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Lab Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => {
                      setSelectedSection(e.target.value);
                      setSelectedTest('');
                      setResultValue('');
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                      testErrors.section ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">--Select Section--</option>
                    {LAB_SECTIONS.map((section) => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                  {testErrors.section && <p className="text-red-500 text-sm mt-1">{testErrors.section}</p>}
                </div>

                {/* Test Name */}
                {selectedSection && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Test Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedTest}
                      onChange={(e) => {
                        setSelectedTest(e.target.value);
                        setResultValue('');
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                        testErrors.test ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">--Select Test--</option>
                      {[...currentTests].sort((a, b) => a.name.localeCompare(b.name)).map((test) => (
                        <option key={test.name} value={test.name}>
                          {test.name}
                        </option>
                      ))}
                    </select>
                    {testErrors.test && <p className="text-red-500 text-sm mt-1">{testErrors.test}</p>}
                  </div>
                )}

                {/* Result Value - CBC Special Case */}
                {selectedTest === 'CBC' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                    
                      CBC Components <span className="text-red-500">*</span>
                        
                    </label>
                             <span className="text-sm font-bold text-gray-700">WBC Count</span>   
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Neutrophils (%)</label>
                        <input
                          type="text"
                          value={cbcValues.neutrophils}
                          onChange={(e) => setCbcValues({...cbcValues, neutrophils: e.target.value})}
                          placeholder="45-75"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Lymphocytes (%)</label>
                        <input
                          type="text"
                          value={cbcValues.lymphocytes}
                          onChange={(e) => setCbcValues({...cbcValues, lymphocytes: e.target.value})}
                          placeholder="16-46"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Monocytes (%)</label>
                        <input
                          type="text"
                          value={cbcValues.monocytes}
                          onChange={(e) => setCbcValues({...cbcValues, monocytes: e.target.value})}
                          placeholder="4-11"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Eosinophils (%)</label>
                        <input
                          type="text"
                          value={cbcValues.eosinophils}
                          onChange={(e) => setCbcValues({...cbcValues, eosinophils: e.target.value})}
                          placeholder="0-8"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Basophils (%)</label>
                        <input
                          type="text"
                          value={cbcValues.basophils}
                          onChange={(e) => setCbcValues({...cbcValues, basophils: e.target.value})}
                          placeholder="0-3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Red Blood Cell Indices (MCV, MCH, RDW) <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Mean Corpuscular Volume (MCV) (fL)</label>
                          <input
                            type="text"
                            value={rbcValues.mcv}
                            onChange={(e) => setRbcValues({ ...rbcValues, mcv: e.target.value })}
                            placeholder="80 - 100"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">Reference Range: 80 - 100 fL</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Mean Corpuscular Hemoglobin (MCH) (pg)</label>
                          <input
                            type="text"
                            value={rbcValues.mch}
                            onChange={(e) => setRbcValues({ ...rbcValues, mch: e.target.value })}
                            placeholder="27 - 31"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">Reference Range: 27 - 31 pg</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Red Cell Distribution Width (RDW) (%)</label>
                          <input
                            type="text"
                            value={rbcValues.rdw}
                            onChange={(e) => setRbcValues({ ...rbcValues, rdw: e.target.value })}
                            placeholder="11.5 - 14.5"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">Reference Range: 11.5% - 14.5%</p>
                        </div>
                      </div>
                      {testErrors.rbc && <p className="text-red-500 text-sm">{testErrors.rbc}</p>}
                    </div>

                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Hemoglobin (Hb/Hgb) <span className="text-red-500">*</span>
                      </label>
                      <div>
                        <input
                          type="text"
                          value={hemoglobinValue}
                          onChange={(e) => setHemoglobinValue(e.target.value)}
                          placeholder={patientSex === 'Male' ? '14.0 - 17.0' : '12.0 - 15.0'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Reference Range: {patientSex === 'Male' ? '14.0 - 17.0 g/dL' : '12.0 - 15.0 g/dL'}
                        </p>
                        {testErrors.hemoglobin && <p className="text-red-500 text-sm mt-1">{testErrors.hemoglobin}</p>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Hematocrit (HCT) <span className="text-red-500">*</span>
                      </label>
                      <div>
                        <input
                          type="text"
                          value={hematocritValue}
                          onChange={(e) => setHematocritValue(e.target.value)}
                          placeholder={patientSex === 'Male' ? '40 - 54' : '37 - 47'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Reference Range: {patientSex === 'Male' ? '40% - 54%' : '37% - 47%'}
                        </p>
                        {testErrors.hematocrit && <p className="text-red-500 text-sm mt-1">{testErrors.hematocrit}</p>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Peripheral Blood Smear
                      </label>
                      <textarea
                        value={peripheralSmearValue}
                        onChange={(e) => setPeripheralSmearValue(e.target.value)}
                        placeholder="Enter findings (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white min-h-[80px]"
                      />
                    </div>

                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Platelet Count <span className="text-red-500">*</span>
                      </label>
                      <div>
                        <input
                          type="text"
                          value={plateletCountValue}
                          onChange={(e) => setPlateletCountValue(e.target.value)}
                          placeholder="150 - 450"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 150 - 450 x 10⁹/L</p>
                        {testErrors.platelet && <p className="text-red-500 text-sm mt-1">{testErrors.platelet}</p>}
                      </div>
                    </div>

                    {testErrors.cbc && <p className="text-red-500 text-sm">{testErrors.cbc}</p>}
                  </div>
                )}

                {/* Result Value - RBC Indices Special Case */}
                {selectedTest === 'RBC Indices (MCV, MCH, RDW)' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      RBC Indices Components <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">MCV (fL)</label>
                        <input
                          type="text"
                          value={rbcValues.mcv}
                          onChange={(e) => setRbcValues({...rbcValues, mcv: e.target.value})}
                          placeholder="80-100"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 80 - 100 fL</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-gray-600">MCH (pg)</label>
                        <input
                          type="text"
                          value={rbcValues.mch}
                          onChange={(e) => setRbcValues({...rbcValues, mch: e.target.value})}
                          placeholder="27-31"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 27 - 31 pg</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-gray-600">RDW (%)</label>
                        <input
                          type="text"
                          value={rbcValues.rdw}
                          onChange={(e) => setRbcValues({...rbcValues, rdw: e.target.value})}
                          placeholder="11.5-14.5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 11.5 - 14.5 %</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result Value - Hemoglobin Special Case */}
                {selectedTest === 'Hemoglobin' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      Hemoglobin Value ({patientSex}) <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Hemoglobin (g/dL)</label>
                        <input
                          type="text"
                          value={hemoglobinValue}
                          onChange={(e) => setHemoglobinValue(e.target.value)}
                          placeholder={patientSex === 'Male' ? '14.0-17.0' : '12.0-15.0'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Reference Range ({patientSex}): {patientSex === 'Male' ? '14.0 - 17.0' : '12.0 - 15.0'} g/dL
                        </p>
                      </div>
                    </div>
                    {testErrors.hemoglobin && <p className="text-red-500 text-sm mt-1">{testErrors.hemoglobin}</p>}
                  </div>
                )}

                {/* Result Value - PT/INR, PTT Special Case */}
                {selectedTest === 'PT/INR, PTT' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      Coagulation Values <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">PT (seconds)</label>
                        <input
                          type="text"
                          value={coagulationValues.pt}
                          onChange={(e) => setCoagulationValues({...coagulationValues, pt: e.target.value})}
                          placeholder="11.0-13.5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 11.0 - 13.5 seconds</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-gray-600">INR</label>
                        <input
                          type="text"
                          value={coagulationValues.inr}
                          onChange={(e) => setCoagulationValues({...coagulationValues, inr: e.target.value})}
                          placeholder="0.8-1.2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 0.8 - 1.2</p>
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-gray-600">aPTT (seconds)</label>
                        <input
                          type="text"
                          value={coagulationValues.aptt}
                          onChange={(e) => setCoagulationValues({...coagulationValues, aptt: e.target.value})}
                          placeholder="25.0-35.0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 25.0 - 35.0 seconds</p>
                      </div>
                    </div>
                    {testErrors.coagulation && <p className="text-red-500 text-sm">{testErrors.coagulation}</p>}
                  </div>
                )}

                {/* Result Value - Routine Urinalysis (UA) Special Case */}
                {selectedTest === 'Routine Urinalysis (UA)' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      Urinalysis Components <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Color (Dropdown) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Color</label>
                        <select
                          value={urinalysisValues.color}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, color: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                        >
                          <option value="">Select color</option>
                          <option value="Clear">Clear</option>
                          <option value="Pale Yellow">Pale Yellow</option>
                          <option value="Amber">Amber</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Choices: Clear, Pale Yellow, Amber</p>
                      </div>

                      {/* Transparency (Dropdown) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Transparency</label>
                        <select
                          value={urinalysisValues.transparency}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, transparency: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                        >
                          <option value="">Select transparency</option>
                          <option value="Clear">Clear</option>
                          <option value="Slightly Turbid">Slightly Turbid</option>
                          <option value="Turbid">Turbid</option>
                          <option value="Very Turbid">Very Turbid</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Choices: Clear, Slightly Turbid, Turbid, Very Turbid</p>
                      </div>

                      {/* pH (Text Input) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">pH</label>
                        <input
                          type="text"
                          value={urinalysisValues.pH}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, pH: e.target.value})}
                          placeholder="4.5-8.0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 4.5 - 8.0</p>
                      </div>

                      {/* Protein/Glucose (Dropdown) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Protein/Glucose</label>
                        <select
                          value={urinalysisValues.proteinGlucose}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, proteinGlucose: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                        >
                          <option value="">Select result</option>
                          <option value="Positive">Positive</option>
                          <option value="Negative">Negative</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Choices: Positive, Negative</p>
                      </div>

                      {/* Bilirubin/Ketone (Dropdown) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Bilirubin/Ketone</label>
                        <select
                          value={urinalysisValues.bilirubinKetone}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, bilirubinKetone: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                        >
                          <option value="">Select result</option>
                          <option value="Positive">Positive</option>
                          <option value="Negative">Negative</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Choices: Positive, Negative</p>
                      </div>

                      {/* Urobilinogen (Text Input) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Urobilinogen (IEU/dL)</label>
                        <input
                          type="text"
                          value={urinalysisValues.urobilinogen}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, urobilinogen: e.target.value})}
                          placeholder="0.2-1.0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 0.2 - 1.0 IEU/dL</p>
                      </div>

                      {/* WBC (Microscopic) (Text Input) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">WBC (Microscopic) (hpf)</label>
                        <input
                          type="text"
                          value={urinalysisValues.wbcMicroscopic}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, wbcMicroscopic: e.target.value})}
                          placeholder="0-5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 0 - 5 hpf</p>
                      </div>

                      {/* RBC (Microscopic) (Text Input) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">RBC (Microscopic) (hpf)</label>
                        <input
                          type="text"
                          value={urinalysisValues.rbcMicroscopic}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, rbcMicroscopic: e.target.value})}
                          placeholder="0-2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 0 - 2 hpf</p>
                      </div>

                      {/* Bacteria/Casts/Crystals (Dropdown) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Bacteria/Casts/Crystals</label>
                        <select
                          value={urinalysisValues.bacteriaCastsCrystals}
                          onChange={(e) => setUrinalysisValues({...urinalysisValues, bacteriaCastsCrystals: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                        >
                          <option value="">Select result</option>
                          <option value="None">None</option>
                          <option value="Rare">Rare</option>
                          <option value="Few">Few</option>
                          <option value="Many">Many</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Choices: None, Rare, Few, Many</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTest === 'Culture and Sensitivity' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      Culture and Sensitivity <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Culture (Text Input) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Culture</label>
                        <input
                          type="text"
                          value={cultureSensitivityValues.culture}
                          onChange={(e) => setCultureSensitivityValues({...cultureSensitivityValues, culture: e.target.value})}
                          placeholder="e.g. Staphylococcus aureus"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>

                      {/* Preliminary Report (Text Input) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Preliminary Report</label>
                        <input
                          type="text"
                          value={cultureSensitivityValues.preliminaryReport}
                          onChange={(e) => setCultureSensitivityValues({...cultureSensitivityValues, preliminaryReport: e.target.value})}
                          placeholder="e.g. No growth after 24/48 hours"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>

                      {/* Final Report (Text Input) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Final Report</label>
                        <input
                          type="text"
                          value={cultureSensitivityValues.finalReport}
                          onChange={(e) => setCultureSensitivityValues({...cultureSensitivityValues, finalReport: e.target.value})}
                          placeholder="e.g. No growth after 5-7 days"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white"
                        />
                      </div>

                      {/* Sensitivity (Antibiogram) (Dropdown) */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Sensitivity (Antibiogram)</label>
                        <select
                          value={cultureSensitivityValues.sensitivity}
                          onChange={(e) => setCultureSensitivityValues({...cultureSensitivityValues, sensitivity: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white"
                        >
                          <option value="">Select sensitivity</option>
                          <option value="S (Susceptible): The antibiotic is effective">S (Susceptible): The antibiotic is effective</option>
                          <option value="I (Intermediate): The antibiotic may work at higher doses">I (Intermediate): The antibiotic may work at higher doses</option>
                          <option value="R (Resistant): The antibiotic will not work">R (Resistant): The antibiotic will not work</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result Value - Regular Tests */}
                {selectedTest && selectedTest !== 'CBC' && selectedTest !== 'RBC Indices (MCV, MCH, RDW)' && selectedTest !== 'Hemoglobin' && selectedTest !== 'PT/INR, PTT' && selectedTest !== 'Routine Urinalysis (UA)' && selectedTest !== 'Culture and Sensitivity' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Result Value <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      {TEST_DROPDOWN_OPTIONS[selectedTest] ? (
                        <select
                          value={resultValue}
                          onChange={(e) => setResultValue(e.target.value)}
                          className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${
                            testErrors.resultValue ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select result</option>
                          {TEST_DROPDOWN_OPTIONS[selectedTest].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={resultValue}
                          onChange={(e) => setResultValue(e.target.value)}
                          placeholder={TEST_PLACEHOLDER_HINTS[selectedTest] || 'Enter result value'}
                          className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${
                            testErrors.resultValue ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                      {currentTests.find((t) => t.name === selectedTest)?.unit && (
                        <span className="px-4 py-2 bg-gray-100 rounded-lg flex items-center text-gray-700 font-semibold">
                          {currentTests.find((t) => t.name === selectedTest)?.unit}
                        </span>
                      )}
                    </div>
                    {testErrors.resultValue && <p className="text-red-500 text-sm mt-1">{testErrors.resultValue}</p>}
                  </div>
                )}

                {/* Reference Range - Show for tests without dropdown options */}
                {selectedTest && !TEST_DROPDOWN_OPTIONS[selectedTest] && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Reference Range
                    </label>
                    <p className="text-gray-700 text-sm">
                      {currentTests.find((t) => t.name === selectedTest)?.referenceRange} {currentTests.find((t) => t.name === selectedTest)?.unit && currentTests.find((t) => t.name === selectedTest)?.unit}
                    </p>
                  </div>
                )}
              </form>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-4 flex justify-end gap-3">
              <button
                onClick={closeTestForm}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleTestSubmit}
                disabled={testSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50"
              >
                {testSubmitting ? 'Saving...' : '✓ Save Test Result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
