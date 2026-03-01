'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, CheckCircle, Clock, AlertCircle, ArrowRight, Edit2, Loader, Printer, DollarSign, CreditCard, ChevronRight, Check } from 'lucide-react';
import { fetchTestResults, addTestResult, updateTestResult, deleteTestResult, fetchPatients, fetchBilling, getAbnormalStatus, getTestPrice } from '@/lib/database';
import { TEST_REFERENCE_RANGES } from '@/lib/mockData';
import { useAuth } from '@/lib/authContext';

// Status Stepper Component
const StatusStepper = ({ 
  currentStatus, 
  onAdvance, 
  isUpdating 
}: { 
  currentStatus: string; 
  onAdvance: () => void; 
  isUpdating: boolean;
}) => {
  const steps = [
    { key: 'pending', label: 'Pending', icon: Clock },
    { key: 'encoding', label: 'Encoding', icon: Edit2 },
    { key: 'for_verification', label: 'Verification', icon: AlertCircle },
    { key: 'approved', label: 'Approved', icon: CheckCircle },
    { key: 'released', label: 'Released', icon: Check },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStatus);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[320px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Status Pipeline</span>
        {currentStatus !== 'released' && (
          <button
            onClick={onAdvance}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-[#3B6255] text-white text-xs rounded-lg hover:bg-[#5A7669] transition font-semibold disabled:opacity-50 flex items-center gap-1"
          >
            {isUpdating ? 'Updating...' : 'Advance →'}
          </button>
        )}
      </div>
      
      <div className="relative">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0"></div>
        <div 
          className="absolute top-4 left-4 h-0.5 bg-[#3B6255] z-0 transition-all duration-300"
          style={{ width: `${(currentIndex / (steps.length - 1)) * (100 - 8)}%` }}
        ></div>
        
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const Icon = step.icon;
            
            return (
              <div key={step.key} className="flex flex-col items-center z-10">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-[#3B6255] text-white' 
                      : isCurrent 
                        ? 'bg-[#3B6255] text-white ring-4 ring-[#3B6255]/20 animate-pulse' 
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span 
                  className={`text-[10px] mt-1.5 font-medium text-center max-w-[60px] ${
                    isCompleted || isCurrent ? 'text-[#3B6255]' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="text-[8px] text-[#3B6255] font-bold mt-0.5">CURRENT</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface TestResult {
  id: string;
  patient_name: string;
  section: string;
  test_name: string;
  result_value: string;
  reference_range: string;
  unit: string;
  status: 'pending' | 'encoding' | 'for_verification' | 'approved' | 'released';
  date_created: string;
  price?: number;
  paymentStatus?: 'paid' | 'unpaid';
  abnormal?: 'normal' | 'high' | 'low';
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
  'HBsAg (Hepa B Surface Ag) - Qualitative': ['Positive/Reactive', 'Negative/Non-reactive'],
  'Dengue NS1Ag': ['Positive/Reactive', 'Negative/Non-reactive'],
  'Leptospirosis Test': ['Positive/Reactive', 'Negative/Non-reactive'],
  'Syphilis Test (Qualitative)': ['Positive/Reactive', 'Negative/Non-reactive'],
  'Typhidot Test (IgG, IgM)': ['Positive/Reactive', 'Negative/Non-reactive'],
  'Fecal Occult Blood Test': ['Negative', 'Positive'],
  'Fecalysis - Ova or Parasite': ['Negative', 'Positive - Ascaris', 'Positive - Hookworm', 'Positive - Trichuris'],
  'Kidney Biopsy': ['Normal/Unremarkable', 'Active disease', 'Scarring'],
  'Bone Biopsy': ['Normal', 'Anormal', 'Inconclusive'],
  'Liver Biopsy Fibrosis': ['F0: No fibrosis (Healthy)', 'F1: Portal fibrosis without septa (Mild fibrosis)', 'F2: Portal fibrosis with few septa (Moderate/Significant fibrosis)', 'F3: Numerous septa without cirrhosis (Severe fibrosis)', 'F4: Cirrhosis (Advanced scarring)'],
  'Liver Biopsy Activity': ['A0: No activity', 'A1: Minimal/mild activity', 'A2: Moderate activity', 'A3: Severe activity'],
  'Fecal Occult Blood Test (FOBT)': ['Positive', 'Negative', 'Invalid'],
  'Pregnancy Test (PT)': ['Positive', 'Negative', 'Invalid'],
  'Routine Fecalysis (FA)': ['No Ova or Parasite seen', 'Scant/Few Ova or Parasite seen', 'Moderate Ova or Parasite seen', 'Many/Numerous Ova or Parasite seen'],
  'UA_Color': ['Clear', 'Pale Yellow', 'Amber'],
  'UA_Transparency': ['Clear', 'Slightly Turbid', 'Turbid', 'Very Turbid'],
  'UA_Protein_Glucose': ['Positive', 'Negative'],
  'UA_Bilirubin_Ketone': ['Positive', 'Negative'],
  'UA_Bacteria_Casts_Crystals': ['None', 'Rare', 'Few', 'Many'],
};

const TEST_PLACEHOLDER_HINTS: Record<string, string> = {
  'Skin Biopsy': 'e.g., Unremarkable skin',
};

const MULTI_FIELD_TESTS = [
  'CBC', 'RBC Indices (MCV, MCH, RDW)', 'Hemoglobin', 'PT/INR, PTT',
  'Routine Urinalysis (UA)', 'Culture and Sensitivity',
  // Clinical Chemistry grouped tests
  'Lipid Profile', 'Liver Function Test', 'Renal Function Test',
  'Electrolytes', 'Glucose & Diabetes Monitoring', 'Arterial Blood Gas',
];

// ── Clinical Chemistry grouped test definitions ─────────────────────────────

const LIPID_PROFILE_TESTS = [
  { name: 'Total Cholesterol', referenceRange: '< 200 mg/dL', unit: 'mg/dL' },
  { name: 'Triglycerides',     referenceRange: '40 - 150 mg/dL', unit: 'mg/dL' },
  { name: 'HDL',               referenceRange: '> 60 mg/dL', unit: 'mg/dL' },
  { name: 'LDL',               referenceRange: '< 100 mg/dL', unit: 'mg/dL' },
];

const LIVER_FUNCTION_TESTS = [
  { name: 'Total Bilirubin',        referenceRange: '0.0 - 1.0 mg/dL', unit: 'mg/dL' },
  { name: 'Direct Bilirubin',       referenceRange: '0.0 - 0.4 mg/dL', unit: 'mg/dL' },
  { name: 'Indirect Bilirubin',     referenceRange: '0.2 - 0.8 mg/dL', unit: 'mg/dL' },
  { name: 'SGOT / AST (Female)',    referenceRange: '9 - 25 U/L', unit: 'U/L' },
  { name: 'SGOT / AST (Male)',      referenceRange: '10 - 40 U/L', unit: 'U/L' },
  { name: 'SGPT / ALT (Female)',    referenceRange: '7 - 30 U/L', unit: 'U/L' },
  { name: 'SGPT / ALT (Male)',      referenceRange: '10 - 55 U/L', unit: 'U/L' },
  { name: 'Total Protein',          referenceRange: '6.4 - 8.3 g/dL', unit: 'g/dL' },
  { name: 'Total Protein A/G Ratio (TPAG)', referenceRange: '', unit: '' },
  { name: 'Albumin (Adults)',       referenceRange: '3.5 - 5 g/dL', unit: 'g/dL' },
  { name: 'Albumin (Children)',     referenceRange: '3.4 - 4.2 g/dL', unit: 'g/dL' },
  { name: 'Alkaline Phosphatase ALP (Female)', referenceRange: '30 - 100 U/L', unit: 'U/L' },
  { name: 'Alkaline Phosphatase ALP (Male)',   referenceRange: '45 - 115 U/L', unit: 'U/L' },
];

const RENAL_FUNCTION_TESTS = [
  { name: 'Blood Urea Nitrogen (BUN)',             referenceRange: '8 - 23 mg/dL', unit: 'mg/dL' },
  { name: 'Blood Uric Acid (BUA)',                 referenceRange: '4 - 8 mg/dL', unit: 'mg/dL' },
  { name: 'Creatinine (Male)',                     referenceRange: '0.7 - 1.3 mg/dL', unit: 'mg/dL' },
  { name: 'Creatinine (Female)',                   referenceRange: '0.6 - 1.1 mg/dL', unit: 'mg/dL' },
  { name: 'eGFR',                                  referenceRange: '', unit: 'mL/min/1.73m²' },
  { name: 'Blood Urea Nitrogen/Creatinine Ratio',  referenceRange: '', unit: '' },
];

const ELECTROLYTES_TESTS = [
  { name: 'Sodium (Na+)',       referenceRange: '135 - 145 mmol/L', unit: 'mmol/L' },
  { name: 'Potassium (K+)',     referenceRange: '3.4 - 5.0 mmol/L', unit: 'mmol/L' },
  { name: 'Chloride (Cl-)',     referenceRange: '9 - 11 mmol/L', unit: 'mmol/L' },
  { name: 'Bicarbonate',        referenceRange: '22 - 28 mEq/L', unit: 'mEq/L' },
  { name: 'Calcium – Total (Ca++)', referenceRange: '8.5 - 10.5 mg/dL', unit: 'mg/dL' },
  { name: 'Phosphorus',         referenceRange: '3.0 - 4.5 mmol/L', unit: 'mmol/L' },
  { name: 'Magnesium (Mg++)',   referenceRange: '1.8 - 3 mmol/L', unit: 'mmol/L' },
];

const GLUCOSE_TESTS = [
  { name: 'Random Blood Sugar (RBS)',                   referenceRange: '< 140 mg/dL', unit: 'mg/dL' },
  { name: 'Fasting Blood Sugar (FBS)',                  referenceRange: '70 - 110 mg/dL', unit: 'mg/dL' },
  { name: 'Oral Glucose Tolerance Test (OGTT) 100g',    referenceRange: '< 140 mg/dL', unit: 'mg/dL' },
  { name: 'Oral Glucose Tolerance Test (OGTT) 75g',     referenceRange: '< 140 mg/dL', unit: 'mg/dL' },
  { name: 'Oral Glucose Challenge Test (OGCT) 50g',     referenceRange: '< 140 mg/dL', unit: 'mg/dL' },
  { name: 'Hemoglobin A1c (HBA1c)',                     referenceRange: '< 5.7%', unit: '%' },
];

const ABG_TESTS = [
  { name: 'ABG pH',    referenceRange: '7.35 - 7.45', unit: '' },
  { name: 'pCO2',      referenceRange: '35 - 45 mmHg', unit: 'mmHg' },
  { name: 'PO2',       referenceRange: '80 - 100 mmHg', unit: 'mmHg' },
  { name: 'SaO2',      referenceRange: '> 90%', unit: '%' },
  { name: 'HCO3-',     referenceRange: '22 - 26 mEq/L', unit: 'mEq/L' },
];

// Names of grouped CC tests shown in the dropdown
const CC_GROUPED_TEST_NAMES = [
  'Lipid Profile',
  'Liver Function Test',
  'Renal Function Test',
  'Electrolytes',
  'Glucose & Diabetes Monitoring',
  'Arterial Blood Gas',
];

// Helper: initial electrolytes state
const INITIAL_ELECTROLYTES = {
  sodium: '', potassium: '', chloride: '', bicarbonate: '',
  calcium: '', phosphorus: '', magnesium: '',
};

// Helper: initial ABG state
const INITIAL_ABG = { pH: '', pco2: '', po2: '', sao2: '', hco3: '' };

export default function TestResultsPage() {
  const { user } = useAuth();
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [patientName, setPatientName] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [printResult, setPrintResult] = useState<TestResult | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedStepperId, setExpandedStepperId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── CBC ───────────────────────────────────────────────────────────────────
  const [cbcValues, setCbcValues] = useState({ neutrophils: '', lymphocytes: '', monocytes: '', eosinophils: '', basophils: '' });
  const [cbcRbcValues, setCbcRbcValues] = useState({ mcv: '', mch: '', rdw: '' });
  const [cbcHemoglobinValue, setCbcHemoglobinValue] = useState('');
  const [cbcHematocritValue, setCbcHematocritValue] = useState('');
  const [cbcPeripheralSmearValue, setCbcPeripheralSmearValue] = useState('');
  const [cbcPlateletCountValue, setCbcPlateletCountValue] = useState('');

  // ── RBC Indices standalone ────────────────────────────────────────────────
  const [rbcValues, setRbcValues] = useState({ mcv: '', mch: '', rdw: '' });

  // ── Hemoglobin standalone ─────────────────────────────────────────────────
  const [hemoglobinValue, setHemoglobinValue] = useState('');

  // ── PT/INR, PTT ───────────────────────────────────────────────────────────
  const [coagulationValues, setCoagulationValues] = useState({ pt: '', inr: '', aptt: '' });

  // ── Routine Urinalysis ────────────────────────────────────────────────────
  const [urinalysisValues, setUrinalysisValues] = useState({
    color: '', transparency: '', pH: '', proteinGlucose: '',
    bilirubinKetone: '', urobilinogen: '', wbcMicroscopic: '',
    rbcMicroscopic: '', bacteriaCastsCrystals: '',
  });

  // ── Culture and Sensitivity ───────────────────────────────────────────────
  const [cultureSensitivityValues, setCultureSensitivityValues] = useState({
    culture: '', preliminaryReport: '', finalReport: '', sensitivity: '',
  });

  // ── Clinical Chemistry Grouped Tests ─────────────────────────────────────
  // Lipid Profile — pick ONE sub-test
  const [lipidSubTest, setLipidSubTest] = useState('');
  const [lipidValue, setLipidValue] = useState('');

  // Liver Function Test — pick ONE sub-test
  const [lftSubTest, setLftSubTest] = useState('');
  const [lftValue, setLftValue] = useState('');

  // Renal Function Test — pick ONE sub-test
  const [rftSubTest, setRftSubTest] = useState('');
  const [rftValue, setRftValue] = useState('');

  // Glucose & Diabetes Monitoring — pick ONE sub-test
  const [glucoseSubTest, setGlucoseSubTest] = useState('');
  const [glucoseValue, setGlucoseValue] = useState('');

  // Electrolytes — ALL fields required
  const [electrolytesValues, setElectrolytesValues] = useState(INITIAL_ELECTROLYTES);

  // Arterial Blood Gas — ALL fields required
  const [abgValues, setAbgValues] = useState(INITIAL_ABG);

  const statusFlow = ['pending', 'encoding', 'for_verification', 'approved', 'released'] as const;

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-800',
      'encoding': 'bg-blue-100 text-blue-800',
      'for_verification': 'bg-orange-100 text-orange-800',
      'approved': 'bg-purple-100 text-purple-800',
      'released': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'pending': 'PENDING', 'encoding': 'ENCODING',
      'for_verification': 'FOR VERIFICATION', 'approved': 'APPROVED', 'released': 'RELEASED',
    };
    return labels[status] || status;
  };

  const getAbnormalIndicator = (status: string | undefined) => {
    if (status === 'high') return { symbol: '↑', color: 'text-red-600', label: 'HIGH' };
    if (status === 'low') return { symbol: '↓', color: 'text-blue-600', label: 'LOW' };
    return { symbol: '✓', color: 'text-green-600', label: 'NORMAL' };
  };

  const handlePrint = (result: TestResult) => {
    setPrintResult(result);
    setTimeout(() => { if (printRef.current) window.print(); }, 100);
  };

  const moveToNextStatus = async (resultId: string, currentStatus: string) => {
    const currentIndex = statusFlow.indexOf(currentStatus as any);
    if (currentIndex < statusFlow.length - 1) {
      setUpdatingStatusId(resultId);
      const nextStatus = statusFlow[currentIndex + 1];
      await updateTestResult(resultId, { status: nextStatus }, user);
      setResults(results.map(r => r.id === resultId ? { ...r, status: nextStatus as TestResult['status'] } : r));
      setUpdatingStatusId(null);
    }
  };

  useEffect(() => { loadResults(); loadPatients(); loadBillings(); }, []);
  const loadPatients = async () => { const data = await fetchPatients(); setPatients(data); };
  const loadBillings = async () => { const data = await fetchBilling(); setBillings(data); };
  const loadResults = async () => {
    setLoading(true);
    const data = await fetchTestResults();
    setResults(data);
    setLoading(false);
  };

  const selectedPatient = patients.find((p) => `${p.first_name} ${p.last_name}` === patientName);
  const selectedPatientSex: 'Male' | 'Female' | null =
    selectedPatient?.sex === 'Male' || selectedPatient?.sex === 'Female' ? selectedPatient.sex : null;

  const HEMATOLOGY_HIDDEN = [
    'Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils',
    'PT', 'INR', 'aPTT', 'PT/INR/aPTT',
    'ESR (Male)', 'ESR (Female)',
    'Hematocrit', 'Hematocrit (Male)', 'Hematocrit (Female)',
    'Hemoglobin', 'Hemoglobin (Male)', 'Hemoglobin (Female)',
    'MCH', 'MCV', 'Platelet Count', 'RBC Indices (MCV, MCH, RDW)', 'RDW', 'WBC Count',
  ];

  // For Clinical Chemistry, hide individual tests that are now under grouped panels
  const CC_HIDDEN_INDIVIDUAL = [
    // Lipid Profile sub-tests
    'Total Cholesterol', 'Triglycerides', 'HDL', 'LDL',
    // LFT sub-tests
    'Total Bilirubin', 'Direct Bilirubin', 'Indirect Bilirubin',
    'SGOT / AST', 'SGPT / ALT', 'Total Protein', 'Total Protein A/G Ratio (TPAG)',
    'Albumin', 'Alkaline Phosphatase (ALP)',
    // RFT sub-tests
    'Blood Urea Nitrogen (BUN)', 'Blood Uric Acid (BUA)', 'Creatinine', 'eGFR',
    'Blood Urea Nitrogen/Creatinine Ratio',
    // Electrolytes sub-tests
    'Sodium (Na+)', 'Potassium (K+)', 'Chloride (Cl-)', 'Bicarbonate',
    'Calcium – Total (Ca++)', 'Phosphorus', 'Magnesium (Mg++)',
    // Glucose sub-tests
    'Random Blood Sugar (RBS)', 'Fasting Blood Sugar (FBS)',
    'Oral Glucose Tolerance Test (OGTT) 100g', 'Oral Glucose Tolerance Test (OGTT) 75g',
    'Oral Glucose Challenge Test (OGCT) 50g', 'Hemoglobin A1c (HBA1c)',
    // ABG sub-tests
    'ABG pH', 'pCO2', 'PO2', 'SaO2', 'HCO3-',
  ];

  const CC_GROUPED_ENTRIES = CC_GROUPED_TEST_NAMES.map(name => ({ name, referenceRange: '', unit: '' }));

  const currentTests = selectedSection
    ? (() => {
        let base = (TESTS_BY_SECTION[selectedSection] || []).filter(t => {
          if (selectedSection === 'HEMATOLOGY' && HEMATOLOGY_HIDDEN.includes(t.name)) return false;
          if (selectedSection === 'CLINICAL CHEMISTRY' && CC_HIDDEN_INDIVIDUAL.includes(t.name)) return false;
          return true;
        });
        if (selectedSection === 'CLINICAL CHEMISTRY') {
          base = [...CC_GROUPED_ENTRIES, ...base];
        }
        return base;
      })()
    : [];

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!patientName.trim()) newErrors.patientName = 'Patient name is required';
    if (!selectedSection) newErrors.section = 'Lab section is required';
    if (!selectedTest) newErrors.test = 'Test is required';

    if (selectedTest === 'CBC') {
      if (!cbcValues.neutrophils || !cbcValues.lymphocytes || !cbcValues.monocytes || !cbcValues.eosinophils || !cbcValues.basophils)
        newErrors.cbc = 'All CBC differential components are required';
      if (!cbcRbcValues.mcv || !cbcRbcValues.mch || !cbcRbcValues.rdw)
        newErrors.rbc = 'MCV, MCH, and RDW are required for CBC';
      if (!cbcHemoglobinValue) newErrors.hemoglobin = 'Hemoglobin value is required for CBC';
      if (!cbcHematocritValue) newErrors.hematocrit = 'Hematocrit value is required for CBC';
      if (!cbcPlateletCountValue) newErrors.platelet = 'Platelet count is required for CBC';
    } else if (selectedTest === 'RBC Indices (MCV, MCH, RDW)') {
      if (!rbcValues.mcv || !rbcValues.mch || !rbcValues.rdw) newErrors.rbc = 'All RBC indices are required';
    } else if (selectedTest === 'Hemoglobin') {
      if (!hemoglobinValue) newErrors.hemoglobin = 'Hemoglobin value is required';
    } else if (selectedTest === 'PT/INR, PTT') {
      if (!coagulationValues.pt || !coagulationValues.inr || !coagulationValues.aptt)
        newErrors.coagulation = 'All coagulation values (PT, INR, aPTT) are required';
    } else if (selectedTest === 'Routine Urinalysis (UA)') {
      if (!urinalysisValues.color || !urinalysisValues.transparency || !urinalysisValues.pH ||
          !urinalysisValues.proteinGlucose || !urinalysisValues.bilirubinKetone ||
          !urinalysisValues.urobilinogen || !urinalysisValues.wbcMicroscopic ||
          !urinalysisValues.rbcMicroscopic || !urinalysisValues.bacteriaCastsCrystals)
        newErrors.urinalysis = 'All urinalysis components are required';
    } else if (selectedTest === 'Culture and Sensitivity') {
      if (!cultureSensitivityValues.culture || !cultureSensitivityValues.preliminaryReport ||
          !cultureSensitivityValues.finalReport || !cultureSensitivityValues.sensitivity)
        newErrors.cultureSensitivity = 'All culture and sensitivity fields are required';
    } else if (selectedTest === 'Lipid Profile') {
      if (!lipidSubTest) newErrors.lipid = 'Please select a sub-test';
      else if (!lipidValue) newErrors.lipid = 'Result value is required';
    } else if (selectedTest === 'Liver Function Test') {
      if (!lftSubTest) newErrors.lft = 'Please select a sub-test';
      else if (!lftValue) newErrors.lft = 'Result value is required';
    } else if (selectedTest === 'Renal Function Test') {
      if (!rftSubTest) newErrors.rft = 'Please select a sub-test';
      else if (!rftValue) newErrors.rft = 'Result value is required';
    } else if (selectedTest === 'Glucose & Diabetes Monitoring') {
      if (!glucoseSubTest) newErrors.glucose = 'Please select a sub-test';
      else if (!glucoseValue) newErrors.glucose = 'Result value is required';
    } else if (selectedTest === 'Electrolytes') {
      const vals = Object.values(electrolytesValues);
      if (vals.some(v => !v)) newErrors.electrolytes = 'All electrolyte values are required';
    } else if (selectedTest === 'Arterial Blood Gas') {
      const vals = Object.values(abgValues);
      if (vals.some(v => !v)) newErrors.abg = 'All ABG values are required';
    } else {
      if (!resultValue) newErrors.resultValue = 'Result value is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const testDetails = currentTests.find((t) => t.name === selectedTest);
    setSubmitting(true);
    try {
      const sexLabel = selectedPatientSex || 'Male';

      if (selectedTest === 'CBC') {
        const cbcLines = [
          `Neutrophils: ${cbcValues.neutrophils}%`, `Lymphocytes: ${cbcValues.lymphocytes}%`,
          `Monocytes: ${cbcValues.monocytes}%`, `Eosinophils: ${cbcValues.eosinophils}%`,
          `Basophils: ${cbcValues.basophils}%`,
          `MCV: ${cbcRbcValues.mcv} fL`, `MCH: ${cbcRbcValues.mch} pg`, `RDW: ${cbcRbcValues.rdw} %`,
          `Hemoglobin (${sexLabel}): ${cbcHemoglobinValue} g/dL`,
          `Hematocrit (${sexLabel}): ${cbcHematocritValue} %`,
          `Platelet Count: ${cbcPlateletCountValue} x10^9/L`,
          ...(cbcPeripheralSmearValue ? [`Peripheral Blood Smear: ${cbcPeripheralSmearValue}`] : []),
        ];
        const payload = { patient_name: patientName, section: selectedSection, test_name: 'CBC', result_value: cbcLines.join('\n'), reference_range: testDetails?.referenceRange || '', unit: '' };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);

      } else if (selectedTest === 'RBC Indices (MCV, MCH, RDW)') {
        const components = [
          { name: 'MCV', value: rbcValues.mcv, range: '80 - 100', unit: 'fL' },
          { name: 'MCH', value: rbcValues.mch, range: '27 - 31', unit: 'pg' },
          { name: 'RDW', value: rbcValues.rdw, range: '11.5 - 14.5', unit: '%' },
        ];
        if (editingId) {
          await updateTestResult(editingId, { patient_name: patientName, section: selectedSection, test_name: 'MCV', result_value: rbcValues.mcv, reference_range: '80 - 100', unit: 'fL' }, user);
        } else {
          for (const c of components) await addTestResult({ patient_name: patientName, section: selectedSection, test_name: c.name, result_value: c.value, reference_range: c.range, unit: c.unit }, user);
        }

      } else if (selectedTest === 'Hemoglobin') {
        const testName = sexLabel === 'Male' ? 'Hemoglobin (Male)' : 'Hemoglobin (Female)';
        const referenceRange = sexLabel === 'Male' ? '14.0 - 17.0' : '12.0 - 15.0';
        const payload = { patient_name: patientName, section: selectedSection, test_name: testName, result_value: hemoglobinValue, reference_range: referenceRange, unit: 'g/dL' };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);

      } else if (selectedTest === 'PT/INR, PTT') {
        const coagLines = [`PT: ${coagulationValues.pt} seconds`, `INR: ${coagulationValues.inr}`, `aPTT: ${coagulationValues.aptt} seconds`];
        const payload = { patient_name: patientName, section: selectedSection, test_name: 'PT/INR, PTT', result_value: coagLines.join('\n'), reference_range: testDetails?.referenceRange || '', unit: '' };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);

      } else if (selectedTest === 'Routine Urinalysis (UA)') {
        const components = [
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
        if (editingId) {
          await updateTestResult(editingId, { patient_name: patientName, section: selectedSection, test_name: components[0].name, result_value: components[0].value, reference_range: components[0].range, unit: components[0].unit }, user);
        } else {
          for (const c of components) await addTestResult({ patient_name: patientName, section: selectedSection, test_name: c.name, result_value: c.value, reference_range: c.range, unit: c.unit }, user);
        }

      } else if (selectedTest === 'Culture and Sensitivity') {
        const components = [
          { name: 'Culture', value: cultureSensitivityValues.culture, range: 'Organism identification', unit: '' },
          { name: 'Preliminary Report', value: cultureSensitivityValues.preliminaryReport, range: 'Growth status after 24/48 hours', unit: '' },
          { name: 'Final Report', value: cultureSensitivityValues.finalReport, range: 'Final growth status after 5-7 days', unit: '' },
          { name: 'Sensitivity (Antibiogram)', value: cultureSensitivityValues.sensitivity, range: 'S (Susceptible), I (Intermediate), R (Resistant)', unit: '' },
        ];
        if (editingId) {
          await updateTestResult(editingId, { patient_name: patientName, section: selectedSection, test_name: components[0].name, result_value: components[0].value, reference_range: components[0].range, unit: components[0].unit }, user);
        } else {
          for (const c of components) await addTestResult({ patient_name: patientName, section: selectedSection, test_name: c.name, result_value: c.value, reference_range: c.range, unit: c.unit }, user);
        }

      // ── Clinical Chemistry grouped tests ───────────────────────────────
      } else if (selectedTest === 'Lipid Profile') {
        const sub = LIPID_PROFILE_TESTS.find(t => t.name === lipidSubTest)!;
        const payload = { patient_name: patientName, section: selectedSection, test_name: lipidSubTest, result_value: lipidValue, reference_range: sub.referenceRange, unit: sub.unit };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);

      } else if (selectedTest === 'Liver Function Test') {
        const sub = LIVER_FUNCTION_TESTS.find(t => t.name === lftSubTest)!;
        const payload = { patient_name: patientName, section: selectedSection, test_name: lftSubTest, result_value: lftValue, reference_range: sub.referenceRange, unit: sub.unit };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);

      } else if (selectedTest === 'Renal Function Test') {
        const sub = RENAL_FUNCTION_TESTS.find(t => t.name === rftSubTest)!;
        const payload = { patient_name: patientName, section: selectedSection, test_name: rftSubTest, result_value: rftValue, reference_range: sub.referenceRange, unit: sub.unit };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);

      } else if (selectedTest === 'Glucose & Diabetes Monitoring') {
        const sub = GLUCOSE_TESTS.find(t => t.name === glucoseSubTest)!;
        const payload = { patient_name: patientName, section: selectedSection, test_name: glucoseSubTest, result_value: glucoseValue, reference_range: sub.referenceRange, unit: sub.unit };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);

      } else if (selectedTest === 'Electrolytes') {
        const components = [
          { name: 'Sodium (Na+)',            value: electrolytesValues.sodium,     range: '135 - 145 mmol/L', unit: 'mmol/L' },
          { name: 'Potassium (K+)',           value: electrolytesValues.potassium,  range: '3.4 - 5.0 mmol/L', unit: 'mmol/L' },
          { name: 'Chloride (Cl-)',           value: electrolytesValues.chloride,   range: '9 - 11 mmol/L', unit: 'mmol/L' },
          { name: 'Bicarbonate',              value: electrolytesValues.bicarbonate,range: '22 - 28 mEq/L', unit: 'mEq/L' },
          { name: 'Calcium – Total (Ca++)',   value: electrolytesValues.calcium,    range: '8.5 - 10.5 mg/dL', unit: 'mg/dL' },
          { name: 'Phosphorus',               value: electrolytesValues.phosphorus, range: '3.0 - 4.5 mmol/L', unit: 'mmol/L' },
          { name: 'Magnesium (Mg++)',         value: electrolytesValues.magnesium,  range: '1.8 - 3 mmol/L', unit: 'mmol/L' },
        ];
        if (editingId) {
          await updateTestResult(editingId, { patient_name: patientName, section: selectedSection, test_name: components[0].name, result_value: components[0].value, reference_range: components[0].range, unit: components[0].unit }, user);
        } else {
          for (const c of components) await addTestResult({ patient_name: patientName, section: selectedSection, test_name: c.name, result_value: c.value, reference_range: c.range, unit: c.unit }, user);
        }

      } else if (selectedTest === 'Arterial Blood Gas') {
        const components = [
          { name: 'ABG pH',   value: abgValues.pH,   range: '7.35 - 7.45', unit: '' },
          { name: 'pCO2',     value: abgValues.pco2, range: '35 - 45 mmHg', unit: 'mmHg' },
          { name: 'PO2',      value: abgValues.po2,  range: '80 - 100 mmHg', unit: 'mmHg' },
          { name: 'SaO2',     value: abgValues.sao2, range: '> 90%', unit: '%' },
          { name: 'HCO3-',    value: abgValues.hco3, range: '22 - 26 mEq/L', unit: 'mEq/L' },
        ];
        if (editingId) {
          await updateTestResult(editingId, { patient_name: patientName, section: selectedSection, test_name: components[0].name, result_value: components[0].value, reference_range: components[0].range, unit: components[0].unit }, user);
        } else {
          for (const c of components) await addTestResult({ patient_name: patientName, section: selectedSection, test_name: c.name, result_value: c.value, reference_range: c.range, unit: c.unit }, user);
        }

      } else {
        const payload = { patient_name: patientName, section: selectedSection, test_name: selectedTest, result_value: resultValue, reference_range: testDetails!.referenceRange, unit: testDetails!.unit };
        editingId ? await updateTestResult(editingId, payload, user) : await addTestResult(payload, user);
      }

      await loadResults();
      resetForm();
    } catch (error) {
      console.error('Error saving test result:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPatientName(''); setSelectedSection(''); setSelectedTest(''); setResultValue(''); setErrors({});
    setShowForm(false); setEditingId(null);
    setCbcValues({ neutrophils: '', lymphocytes: '', monocytes: '', eosinophils: '', basophils: '' });
    setCbcRbcValues({ mcv: '', mch: '', rdw: '' });
    setCbcHemoglobinValue(''); setCbcHematocritValue(''); setCbcPeripheralSmearValue(''); setCbcPlateletCountValue('');
    setRbcValues({ mcv: '', mch: '', rdw: '' });
    setHemoglobinValue('');
    setCoagulationValues({ pt: '', inr: '', aptt: '' });
    setUrinalysisValues({ color: '', transparency: '', pH: '', proteinGlucose: '', bilirubinKetone: '', urobilinogen: '', wbcMicroscopic: '', rbcMicroscopic: '', bacteriaCastsCrystals: '' });
    setCultureSensitivityValues({ culture: '', preliminaryReport: '', finalReport: '', sensitivity: '' });
    // CC grouped
    setLipidSubTest(''); setLipidValue('');
    setLftSubTest(''); setLftValue('');
    setRftSubTest(''); setRftValue('');
    setGlucoseSubTest(''); setGlucoseValue('');
    setElectrolytesValues(INITIAL_ELECTROLYTES);
    setAbgValues(INITIAL_ABG);
  };

  const handleEdit = (result: TestResult) => {
    setPatientName(result.patient_name);
    setSelectedSection(result.section);
    setEditingId(result.id);
    setShowForm(true);

    const raw = result.result_value || '';
    const num = (s: string | undefined) => (s ? (s.match(/-?\d*\.?\d+/)?.[0] ?? '') : '');
    const parseKV = (text: string) => {
      const parts = text.includes('\n') ? text.split('\n') : text.split(',').map(p => p.trim());
      const kv: Record<string, string> = {};
      for (const p of parts) {
        const idx = p.indexOf(':'); if (idx === -1) continue;
        kv[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
      }
      return kv;
    };

    if (result.test_name === 'CBC') {
      setSelectedTest('CBC');
      const kv = parseKV(raw);
      setCbcValues({ neutrophils: num(kv['Neutrophils']), lymphocytes: num(kv['Lymphocytes']), monocytes: num(kv['Monocytes']), eosinophils: num(kv['Eosinophils']), basophils: num(kv['Basophils']) });
      setCbcRbcValues({ mcv: num(kv['MCV']), mch: num(kv['MCH']), rdw: num(kv['RDW']) });
      const hgbKey = Object.keys(kv).find(k => k.startsWith('Hemoglobin'));
      const hctKey = Object.keys(kv).find(k => k.startsWith('Hematocrit'));
      setCbcHemoglobinValue(num(hgbKey ? kv[hgbKey] : undefined));
      setCbcHematocritValue(num(hctKey ? kv[hctKey] : undefined));
      setCbcPlateletCountValue(num(kv['Platelet Count']));
      setCbcPeripheralSmearValue(kv['Peripheral Blood Smear'] || '');
    } else if (result.test_name === 'PT/INR, PTT') {
      setSelectedTest('PT/INR, PTT');
      const kv = parseKV(raw);
      setCoagulationValues({ pt: num(kv['PT']), inr: num(kv['INR']), aptt: num(kv['aPTT']) });
    } else if (['MCV', 'MCH', 'RDW'].includes(result.test_name)) {
      setSelectedTest('RBC Indices (MCV, MCH, RDW)');
      setRbcValues(prev => ({ ...prev, [result.test_name.toLowerCase()]: num(raw) }));
      setResultValue(raw);
    } else if (result.test_name === 'Hemoglobin (Male)' || result.test_name === 'Hemoglobin (Female)') {
      setSelectedTest('Hemoglobin'); setHemoglobinValue(num(raw));
    } else if (result.test_name.startsWith('UA ')) {
      setSelectedTest('Routine Urinalysis (UA)');
      const uaMap: Record<string, keyof typeof urinalysisValues> = {
        'UA Color': 'color', 'UA Transparency': 'transparency', 'UA pH': 'pH',
        'UA Protein/Glucose': 'proteinGlucose', 'UA Bilirubin/Ketone': 'bilirubinKetone',
        'UA Urobilinogen': 'urobilinogen', 'UA WBC (Microscopic)': 'wbcMicroscopic',
        'UA RBC (Microscopic)': 'rbcMicroscopic', 'UA Bacteria/Casts/Crystals': 'bacteriaCastsCrystals',
      };
      const field = uaMap[result.test_name];
      if (field) setUrinalysisValues(prev => ({ ...prev, [field]: raw }));
    } else if (['Culture', 'Preliminary Report', 'Final Report', 'Sensitivity (Antibiogram)'].includes(result.test_name)) {
      setSelectedTest('Culture and Sensitivity');
      const csMap: Record<string, keyof typeof cultureSensitivityValues> = {
        'Culture': 'culture', 'Preliminary Report': 'preliminaryReport',
        'Final Report': 'finalReport', 'Sensitivity (Antibiogram)': 'sensitivity',
      };
      const field = csMap[result.test_name];
      if (field) setCultureSensitivityValues(prev => ({ ...prev, [field]: raw }));
    } else {
      setSelectedTest(result.test_name);
      setResultValue(raw);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this test result?')) {
      await deleteTestResult(id); await loadResults();
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader className="w-8 h-8 text-[#3B6255] animate-spin" />
    </div>
  );

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 placeholder-gray-500 bg-white ${err ? 'border-red-500' : 'border-gray-300'}`;
  const selectCls = (err?: string) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-transparent outline-none transition text-gray-800 bg-white ${err ? 'border-red-500' : 'border-gray-300'}`;

  // ── Reusable: pick-one sub-test panel ─────────────────────────────────────
  const SubTestPicker = ({
    label, tests, selectedSub, onSelectSub, value, onChangeValue, error,
  }: {
    label: string;
    tests: { name: string; referenceRange: string; unit: string }[];
    selectedSub: string;
    onSelectSub: (v: string) => void;
    value: string;
    onChangeValue: (v: string) => void;
    error?: string;
  }) => {
    const sub = tests.find(t => t.name === selectedSub);
    return (
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-gray-700">
          {label} Sub-Test <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedSub}
          onChange={e => { onSelectSub(e.target.value); onChangeValue(''); }}
          className={selectCls(error)}
        >
          <option value="">-- Select Sub-Test --</option>
          {tests.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        {selectedSub && (
          <div className="space-y-2">
            <input
              type="text"
              value={value}
              onChange={e => onChangeValue(e.target.value)}
              placeholder="Enter result value"
              className={inputCls(error)}
            />
            {sub?.referenceRange && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Reference Range:</span> {sub.referenceRange}
                  {sub.unit ? ` (${sub.unit})` : ''}
                </p>
              </div>
            )}
          </div>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-8" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ animation: 'fadeInSlideUp 0.6s ease-out', animationDelay: '0.1s', animationFillMode: 'both' }}>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Test Results Management</h1>
          <p className="text-gray-600 text-sm mt-1">Enter and manage laboratory test results</p>
        </div>
        <button
          onClick={() => showForm ? resetForm() : setShowForm(true)}
          className="px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
        >
          {showForm ? <>✕ Cancel</> : <><Plus className="w-5 h-5" />New Test Result</>}
        </button>
      </div>

      {/* ── Test Entry Form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-[#3B6255]" style={{ animation: 'fadeInSlideUp 0.6s ease-out 0.2s backwards' }}>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {editingId ? 'Edit Test Result' : 'Enter Test Result'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient dropdown */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Patient <span className="text-red-500">*</span></label>
              <select value={patientName} onChange={e => setPatientName(e.target.value)} className={selectCls(errors.patientName)}>
                <option value="">--Select Patient--</option>
                {patients.map(p => (
                  <option key={p.id} value={`${p.first_name} ${p.last_name}`}>
                    {p.patient_id_no} - {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
              {errors.patientName && <p className="text-red-500 text-sm mt-1">{errors.patientName}</p>}
            </div>

            {/* Lab Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Laboratory Section <span className="text-red-500">*</span></label>
              <select
                value={selectedSection}
                onChange={(e) => { setSelectedSection(e.target.value); setSelectedTest(''); setResultValue(''); }}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 bg-white font-medium ${errors.section ? 'border-red-500' : 'border-gray-300 hover:border-[#8BA49A]'}`}
              >
                <option value="">-- Select Laboratory Section --</option>
                {LAB_SECTIONS.map(section => <option key={section} value={section}>{section}</option>)}
              </select>
              {errors.section && <p className="text-red-500 text-sm mt-1">{errors.section}</p>}
              {selectedSection && (
                <div className={`mt-3 p-3 rounded-lg text-sm border ${selectedSection === 'CLINICAL CHEMISTRY' ? 'bg-[#CBDED3] border-[#8BA49A] text-[#3B6255]' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                  <p>✓ Tests available in this section</p>
                </div>
              )}
            </div>

            {/* Test Name */}
            {selectedSection && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Test Name <span className="text-red-500">*</span></label>
                <select
                  value={selectedTest}
                  onChange={(e) => { setSelectedTest(e.target.value); setResultValue(''); }}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-[#3B6255] focus:border-[#3B6255] outline-none transition text-gray-800 bg-white font-medium ${errors.test ? 'border-red-500' : 'border-gray-300 hover:border-[#8BA49A]'}`}
                >
                  <option value="">-- Select Test --</option>
                  {/* Show grouped CC tests at top with separator */}
                  {selectedSection === 'CLINICAL CHEMISTRY' && (
                    <>
                      <optgroup label="── Panels / Groups ──">
                        {CC_GROUPED_TEST_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                      </optgroup>
                      <optgroup label="── Individual Tests ──">
                        {currentTests.filter(t => !CC_GROUPED_TEST_NAMES.includes(t.name)).map(test => <option key={test.name} value={test.name}>{test.name}</option>)}
                      </optgroup>
                    </>
                  )}
                  {selectedSection !== 'CLINICAL CHEMISTRY' && currentTests.map(test => <option key={test.name} value={test.name}>{test.name}</option>)}
                </select>
                {errors.test && <p className="text-red-500 text-sm mt-1">{errors.test}</p>}
              </div>
            )}

            {/* Reference Range (non-grouped CC tests) */}
            {selectedSection === 'CLINICAL CHEMISTRY' && selectedTest && !CC_GROUPED_TEST_NAMES.includes(selectedTest) && currentTests.find(t => t.name === selectedTest) && (
              <div className="bg-[#CBDED3] border-l-4 border-[#3B6255] p-4 rounded">
                <h3 className="font-semibold text-gray-800 mb-2">Reference Range</h3>
                <p className="text-2xl font-bold text-[#3B6255]">{currentTests.find(t => t.name === selectedTest)?.referenceRange}</p>
                <p className="text-sm text-gray-600 mt-1">Unit: {currentTests.find(t => t.name === selectedTest)?.unit}</p>
              </div>
            )}

            {/* ── Result inputs ────────────────────────────────────────────────── */}
            {selectedTest && (
              <div>

                {/* ── CBC ─────────────────────────────────────────────────── */}
                {selectedTest === 'CBC' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">CBC Components <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-700">WBC Count</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { label: 'Neutrophils (%)', key: 'neutrophils', ph: '45 - 75' },
                        { label: 'Lymphocytes (%)', key: 'lymphocytes', ph: '16 - 46' },
                        { label: 'Monocytes (%)', key: 'monocytes', ph: '4 - 11' },
                        { label: 'Eosinophils (%)', key: 'eosinophils', ph: '0 - 8' },
                        { label: 'Basophils (%)', key: 'basophils', ph: '0 - 3' },
                      ].map(({ label, key, ph }) => (
                        <div key={key}>
                          <label className="text-xs font-semibold text-gray-600">{label}</label>
                          <input type="text" value={(cbcValues as any)[key]} onChange={e => setCbcValues({ ...cbcValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                        </div>
                      ))}
                    </div>
                    {errors.cbc && <p className="text-red-500 text-sm">{errors.cbc}</p>}
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">RBC Indices (MCV, MCH, RDW) <span className="text-red-500">*</span></label>
                      {[
                        { label: 'MCV (fL)', key: 'mcv', ph: '80 - 100', ref: '80 - 100 fL' },
                        { label: 'MCH (pg)', key: 'mch', ph: '27 - 31', ref: '27 - 31 pg' },
                        { label: 'RDW (%)', key: 'rdw', ph: '11.5 - 14.5', ref: '11.5% - 14.5%' },
                      ].map(({ label, key, ph, ref }) => (
                        <div key={key}>
                          <label className="text-xs font-semibold text-gray-600">{label}</label>
                          <input type="text" value={(cbcRbcValues as any)[key]} onChange={e => setCbcRbcValues({ ...cbcRbcValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                          <p className="text-xs text-gray-500 mt-1">Reference Range: {ref}</p>
                        </div>
                      ))}
                      {errors.rbc && <p className="text-red-500 text-sm">{errors.rbc}</p>}
                    </div>
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Hemoglobin <span className="text-red-500">*</span></label>
                      <input type="text" value={cbcHemoglobinValue} onChange={e => setCbcHemoglobinValue(e.target.value)} placeholder={selectedPatientSex === 'Female' ? '12.0 - 15.0' : '14.0 - 17.0'} className={inputCls()} />
                      <p className="text-xs text-gray-500">Ref: {selectedPatientSex === 'Female' ? '12.0 - 15.0 g/dL' : '14.0 - 17.0 g/dL'}</p>
                      {errors.hemoglobin && <p className="text-red-500 text-sm">{errors.hemoglobin}</p>}
                    </div>
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Hematocrit <span className="text-red-500">*</span></label>
                      <input type="text" value={cbcHematocritValue} onChange={e => setCbcHematocritValue(e.target.value)} placeholder={selectedPatientSex === 'Female' ? '37 - 47' : '40 - 54'} className={inputCls()} />
                      <p className="text-xs text-gray-500">Ref: {selectedPatientSex === 'Female' ? '37% - 47%' : '40% - 54%'}</p>
                      {errors.hematocrit && <p className="text-red-500 text-sm">{errors.hematocrit}</p>}
                    </div>
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Peripheral Blood Smear</label>
                      <textarea value={cbcPeripheralSmearValue} onChange={e => setCbcPeripheralSmearValue(e.target.value)} placeholder="Enter findings (optional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] outline-none transition text-gray-800 placeholder-gray-500 bg-white min-h-[80px]" />
                    </div>
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Platelet Count <span className="text-red-500">*</span></label>
                      <input type="text" value={cbcPlateletCountValue} onChange={e => setCbcPlateletCountValue(e.target.value)} placeholder="150 - 450" className={inputCls()} />
                      <p className="text-xs text-gray-500">Reference Range: 150 - 450 x 10⁹/L</p>
                      {errors.platelet && <p className="text-red-500 text-sm">{errors.platelet}</p>}
                    </div>
                  </div>
                )}

                {/* ── RBC Indices standalone ──────────────────────────────── */}
                {selectedTest === 'RBC Indices (MCV, MCH, RDW)' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">RBC Indices <span className="text-red-500">*</span></label>
                    {[
                      { label: 'MCV (fL)', key: 'mcv', ph: '80 - 100', ref: '80 - 100 fL' },
                      { label: 'MCH (pg)', key: 'mch', ph: '27 - 31', ref: '27 - 31 pg' },
                      { label: 'RDW (%)', key: 'rdw', ph: '11.5 - 14.5', ref: '11.5% - 14.5%' },
                    ].map(({ label, key, ph, ref }) => (
                      <div key={key}>
                        <label className="text-xs font-semibold text-gray-600">{label}</label>
                        <input type="text" value={(rbcValues as any)[key]} onChange={e => setRbcValues({ ...rbcValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: {ref}</p>
                      </div>
                    ))}
                    {errors.rbc && <p className="text-red-500 text-sm">{errors.rbc}</p>}
                  </div>
                )}

                {/* ── Hemoglobin standalone ───────────────────────────────── */}
                {selectedTest === 'Hemoglobin' && (
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700">Hemoglobin ({selectedPatientSex || 'Male'}) <span className="text-red-500">*</span></label>
                    <input type="text" value={hemoglobinValue} onChange={e => setHemoglobinValue(e.target.value)} placeholder={selectedPatientSex === 'Female' ? '12.0 - 15.0' : '14.0 - 17.0'} className={inputCls(errors.hemoglobin)} />
                    <p className="text-xs text-gray-500">Ref: {selectedPatientSex === 'Female' ? '12.0 - 15.0 g/dL' : '14.0 - 17.0 g/dL'}</p>
                    {errors.hemoglobin && <p className="text-red-500 text-sm">{errors.hemoglobin}</p>}
                  </div>
                )}

                {/* ── PT/INR, PTT ─────────────────────────────────────────── */}
                {selectedTest === 'PT/INR, PTT' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">Coagulation Studies <span className="text-red-500">*</span></label>
                    {[
                      { label: 'Prothrombin Time (PT) (seconds)', key: 'pt', ph: '11.0 - 13.5', ref: '11.0 - 13.5 seconds' },
                      { label: 'International Normalized Ratio (INR)', key: 'inr', ph: '0.8 - 1.2', ref: '0.8 - 1.2' },
                      { label: 'Activated Partial Thromboplastin Time (aPTT) (seconds)', key: 'aptt', ph: '25.0 - 35.0', ref: '25.0 - 35.0 seconds' },
                    ].map(({ label, key, ph, ref }) => (
                      <div key={key}>
                        <label className="text-xs font-semibold text-gray-600">{label}</label>
                        <input type="text" value={(coagulationValues as any)[key]} onChange={e => setCoagulationValues({ ...coagulationValues, [key]: e.target.value })} placeholder={ph} className={inputCls()} />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: {ref}</p>
                      </div>
                    ))}
                    {errors.coagulation && <p className="text-red-500 text-sm">{errors.coagulation}</p>}
                  </div>
                )}

                {/* ── Routine Urinalysis (UA) ─────────────────────────────── */}
                {selectedTest === 'Routine Urinalysis (UA)' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">Routine Urinalysis Components <span className="text-red-500">*</span></label>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Physical Examination</p>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Color</label>
                        <select value={urinalysisValues.color} onChange={e => setUrinalysisValues({ ...urinalysisValues, color: e.target.value })} className={selectCls()}>
                          <option value="">Select color</option>
                          {['Clear', 'Pale Yellow', 'Amber'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Transparency</label>
                        <select value={urinalysisValues.transparency} onChange={e => setUrinalysisValues({ ...urinalysisValues, transparency: e.target.value })} className={selectCls()}>
                          <option value="">Select transparency</option>
                          {['Clear', 'Slightly Turbid', 'Turbid', 'Very Turbid'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                      <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Chemical Examination</p>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">pH</label>
                        <input type="text" value={urinalysisValues.pH} onChange={e => setUrinalysisValues({ ...urinalysisValues, pH: e.target.value })} placeholder="4.5 - 8.0" className={inputCls()} />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 4.5 - 8.0</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Protein / Glucose</label>
                        <select value={urinalysisValues.proteinGlucose} onChange={e => setUrinalysisValues({ ...urinalysisValues, proteinGlucose: e.target.value })} className={selectCls()}>
                          <option value="">Select result</option>
                          {['Positive', 'Negative'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Bilirubin / Ketone</label>
                        <select value={urinalysisValues.bilirubinKetone} onChange={e => setUrinalysisValues({ ...urinalysisValues, bilirubinKetone: e.target.value })} className={selectCls()}>
                          <option value="">Select result</option>
                          {['Positive', 'Negative'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Urobilinogen (IEU/dL)</label>
                        <input type="text" value={urinalysisValues.urobilinogen} onChange={e => setUrinalysisValues({ ...urinalysisValues, urobilinogen: e.target.value })} placeholder="0.2 - 1.0" className={inputCls()} />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 0.2 - 1.0 IEU/dL</p>
                      </div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Microscopic Examination</p>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">WBC / Pus Cells (hpf)</label>
                        <input type="text" value={urinalysisValues.wbcMicroscopic} onChange={e => setUrinalysisValues({ ...urinalysisValues, wbcMicroscopic: e.target.value })} placeholder="0 - 5" className={inputCls()} />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 0 - 5 hpf</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">RBC (hpf)</label>
                        <input type="text" value={urinalysisValues.rbcMicroscopic} onChange={e => setUrinalysisValues({ ...urinalysisValues, rbcMicroscopic: e.target.value })} placeholder="0 - 2" className={inputCls()} />
                        <p className="text-xs text-gray-500 mt-1">Reference Range: 0 - 2 hpf</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Bacteria / Casts / Crystals</label>
                        <select value={urinalysisValues.bacteriaCastsCrystals} onChange={e => setUrinalysisValues({ ...urinalysisValues, bacteriaCastsCrystals: e.target.value })} className={selectCls()}>
                          <option value="">Select result</option>
                          {['None', 'Rare', 'Few', 'Many'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    {errors.urinalysis && <p className="text-red-500 text-sm">{errors.urinalysis}</p>}
                  </div>
                )}

                {/* ── Culture and Sensitivity ─────────────────────────────── */}
                {selectedTest === 'Culture and Sensitivity' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">Culture and Sensitivity <span className="text-red-500">*</span></label>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Culture</label>
                      <input type="text" value={cultureSensitivityValues.culture} onChange={e => setCultureSensitivityValues({ ...cultureSensitivityValues, culture: e.target.value })} placeholder="e.g. Staphylococcus aureus" className={inputCls()} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Preliminary Report</label>
                      <input type="text" value={cultureSensitivityValues.preliminaryReport} onChange={e => setCultureSensitivityValues({ ...cultureSensitivityValues, preliminaryReport: e.target.value })} placeholder="e.g. No growth after 24/48 hours" className={inputCls()} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Final Report</label>
                      <input type="text" value={cultureSensitivityValues.finalReport} onChange={e => setCultureSensitivityValues({ ...cultureSensitivityValues, finalReport: e.target.value })} placeholder="e.g. No growth after 5-7 days" className={inputCls()} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Sensitivity (Antibiogram)</label>
                      <select value={cultureSensitivityValues.sensitivity} onChange={e => setCultureSensitivityValues({ ...cultureSensitivityValues, sensitivity: e.target.value })} className={selectCls()}>
                        <option value="">Select sensitivity</option>
                        <option value="S (Susceptible): The antibiotic is effective">S (Susceptible): The antibiotic is effective</option>
                        <option value="I (Intermediate): The antibiotic may work at higher doses">I (Intermediate): The antibiotic may work at higher doses</option>
                        <option value="R (Resistant): The antibiotic will not work">R (Resistant): The antibiotic will not work</option>
                      </select>
                    </div>
                    {errors.cultureSensitivity && <p className="text-red-500 text-sm">{errors.cultureSensitivity}</p>}
                  </div>
                )}

                {/* ── Lipid Profile ────────────────────────────────────────── */}
                {selectedTest === 'Lipid Profile' && (
                  <SubTestPicker
                    label="Lipid Profile"
                    tests={LIPID_PROFILE_TESTS}
                    selectedSub={lipidSubTest}
                    onSelectSub={setLipidSubTest}
                    value={lipidValue}
                    onChangeValue={setLipidValue}
                    error={errors.lipid}
                  />
                )}

                {/* ── Liver Function Test ──────────────────────────────────── */}
                {selectedTest === 'Liver Function Test' && (
                  <SubTestPicker
                    label="Liver Function Test"
                    tests={LIVER_FUNCTION_TESTS}
                    selectedSub={lftSubTest}
                    onSelectSub={setLftSubTest}
                    value={lftValue}
                    onChangeValue={setLftValue}
                    error={errors.lft}
                  />
                )}

                {/* ── Renal Function Test ──────────────────────────────────── */}
                {selectedTest === 'Renal Function Test' && (
                  <SubTestPicker
                    label="Renal Function Test"
                    tests={RENAL_FUNCTION_TESTS}
                    selectedSub={rftSubTest}
                    onSelectSub={setRftSubTest}
                    value={rftValue}
                    onChangeValue={setRftValue}
                    error={errors.rft}
                  />
                )}

                {/* ── Glucose & Diabetes Monitoring ───────────────────────── */}
                {selectedTest === 'Glucose & Diabetes Monitoring' && (
                  <SubTestPicker
                    label="Glucose & Diabetes Monitoring"
                    tests={GLUCOSE_TESTS}
                    selectedSub={glucoseSubTest}
                    onSelectSub={setGlucoseSubTest}
                    value={glucoseValue}
                    onChangeValue={setGlucoseValue}
                    error={errors.glucose}
                  />
                )}

                {/* ── Electrolytes (ALL required) ──────────────────────────── */}
                {selectedTest === 'Electrolytes' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      Electrolytes — All fields required <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-3">
                      {[
                        { label: 'Sodium (Na+)', key: 'sodium', ph: '135 - 145', ref: '135 - 145 mmol/L', unit: 'mmol/L' },
                        { label: 'Potassium (K+)', key: 'potassium', ph: '3.4 - 5.0', ref: '3.4 - 5.0 mmol/L', unit: 'mmol/L' },
                        { label: 'Chloride (Cl-)', key: 'chloride', ph: '9 - 11', ref: '9 - 11 mmol/L', unit: 'mmol/L' },
                        { label: 'Bicarbonate', key: 'bicarbonate', ph: '22 - 28', ref: '22 - 28 mEq/L', unit: 'mEq/L' },
                        { label: 'Calcium – Total (Ca++)', key: 'calcium', ph: '8.5 - 10.5', ref: '8.5 - 10.5 mg/dL', unit: 'mg/dL' },
                        { label: 'Phosphorus', key: 'phosphorus', ph: '3.0 - 4.5', ref: '3.0 - 4.5 mmol/L', unit: 'mmol/L' },
                        { label: 'Magnesium (Mg++)', key: 'magnesium', ph: '1.8 - 3', ref: '1.8 - 3 mmol/L', unit: 'mmol/L' },
                      ].map(({ label, key, ph, ref, unit }) => (
                        <div key={key}>
                          <label className="text-xs font-semibold text-gray-600">{label}</label>
                          <div className="flex gap-2 mt-1">
                            <input
                              type="text"
                              value={(electrolytesValues as any)[key]}
                              onChange={e => setElectrolytesValues({ ...electrolytesValues, [key]: e.target.value })}
                              placeholder={ph}
                              className={inputCls()}
                            />
                            <span className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm font-medium whitespace-nowrap">{unit}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Ref: {ref}</p>
                        </div>
                      ))}
                    </div>
                    {errors.electrolytes && <p className="text-red-500 text-sm">{errors.electrolytes}</p>}
                  </div>
                )}

                {/* ── Arterial Blood Gas (ALL required) ───────────────────── */}
                {selectedTest === 'Arterial Blood Gas' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      Arterial Blood Gas — All fields required <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                      {[
                        { label: 'pH', key: 'pH', ph: '7.35 - 7.45', ref: '7.35 - 7.45', unit: '' },
                        { label: 'pCO2', key: 'pco2', ph: '35 - 45', ref: '35 - 45 mmHg', unit: 'mmHg' },
                        { label: 'PO2', key: 'po2', ph: '80 - 100', ref: '80 - 100 mmHg', unit: 'mmHg' },
                        { label: 'SaO2', key: 'sao2', ph: '> 90', ref: '> 90%', unit: '%' },
                        { label: 'HCO3-', key: 'hco3', ph: '22 - 26', ref: '22 - 26 mEq/L', unit: 'mEq/L' },
                      ].map(({ label, key, ph, ref, unit }) => (
                        <div key={key}>
                          <label className="text-xs font-semibold text-gray-600">{label}</label>
                          <div className="flex gap-2 mt-1">
                            <input
                              type="text"
                              value={(abgValues as any)[key]}
                              onChange={e => setAbgValues({ ...abgValues, [key]: e.target.value })}
                              placeholder={ph}
                              className={inputCls()}
                            />
                            {unit && <span className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm font-medium whitespace-nowrap">{unit}</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Ref: {ref}</p>
                        </div>
                      ))}
                    </div>
                    {errors.abg && <p className="text-red-500 text-sm">{errors.abg}</p>}
                  </div>
                )}

                {/* ── Regular single-value tests ──────────────────────────── */}
                {selectedTest && !MULTI_FIELD_TESTS.includes(selectedTest) && (
                  <>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Result Value <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      {TEST_DROPDOWN_OPTIONS[selectedTest] ? (
                        <select value={resultValue} onChange={e => setResultValue(e.target.value)} className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] outline-none transition text-gray-800 bg-white ${errors.resultValue ? 'border-red-500' : 'border-gray-300'}`}>
                          <option value="">Select result</option>
                          {TEST_DROPDOWN_OPTIONS[selectedTest].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={resultValue} onChange={e => setResultValue(e.target.value)} placeholder={TEST_PLACEHOLDER_HINTS[selectedTest] || 'Enter result value'} className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#3B6255] outline-none transition text-gray-800 placeholder-gray-500 bg-white ${errors.resultValue ? 'border-red-500' : 'border-gray-300'}`} />
                      )}
                      <span className="px-4 py-2 bg-gray-100 rounded-lg flex items-center text-gray-700 font-semibold">
                        {currentTests.find(t => t.name === selectedTest)?.unit}
                      </span>
                    </div>
                    {errors.resultValue && <p className="text-red-500 text-sm mt-1">{errors.resultValue}</p>}
                  </>
                )}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button type="submit" disabled={submitting} className="flex-1 px-6 py-3 bg-gradient-to-r from-[#3B6255] to-green-900 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50">
                {submitting ? 'Saving...' : editingId ? '✓ Update Result' : '✓ Save Test Result'}
              </button>
              <button type="button" onClick={resetForm} className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lab Sections Overview */}
      <div className="bg-white rounded-lg shadow-lg p-8" style={{ animation: 'fadeInSlideUp 0.6s ease-out 0.3s backwards' }}>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Laboratory Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LAB_SECTIONS.map((section, index) => (
            <div key={section} className="p-4 rounded-lg border-2 transition bg-[#CBDED3] border-[#8BA49A] hover:border-[#3B6255]" style={{ animation: 'fadeInScale 0.5s ease-out', animationDelay: `${0.35 + index * 0.08}s`, animationFillMode: 'both' }}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-[#3B6255]" />
                <div>
                  <h3 className="font-semibold text-gray-800">{section}</h3>
                  <p className="text-xs text-gray-600">Active & Available</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results List */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ animation: 'fadeInSlideUp 0.6s ease-out 0.5s backwards' }}>
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Test Results ({results.length})</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by patient or test..." className="w-full sm:w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] outline-none transition text-gray-800 placeholder-gray-500 bg-white" />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>}
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3B6255] outline-none transition text-gray-800 bg-white">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="encoding">Encoding</option>
                <option value="for_verification">For Verification</option>
                <option value="approved">Approved</option>
                <option value="released">Released</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Patient Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Lab Section</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Test Name</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Result</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Price</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Payment</th>
                <th className="text-left py-4 px-8 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {results
                .filter(result => {
                  if (searchTerm) {
                    const s = searchTerm.toLowerCase();
                    if (!result.patient_name?.toLowerCase().includes(s) && !result.test_name?.toLowerCase().includes(s) && !result.section?.toLowerCase().includes(s)) return false;
                  }
                  if (statusFilter !== 'all' && result.status !== statusFilter) return false;
                  return true;
                })
                .map(result => {
                  const isCbcComponent = result.section === 'HEMATOLOGY' && ['Neutrophils', 'Lymphocytes', 'Monocytes', 'Eosinophils', 'Basophils'].includes(result.test_name);
                  const billingTestName = isCbcComponent ? 'CBC' : result.test_name;
                  const price = getTestPrice(billingTestName, result.section);
                  const billing = billings.find(b => b.test_name === billingTestName && b.patient_name === result.patient_name);
                  const abnormal = getAbnormalStatus(result.result_value, result.test_name, result.section);
                  const indicator = getAbnormalIndicator(abnormal);

                  return (
                    <tr key={result.id} className="border-b border-gray-100 hover:bg-[#F0F4F1] transition">
                      <td className="py-4 px-8 font-medium text-gray-800">{result.patient_name}</td>
                      <td className="py-4 px-8 text-gray-600">{result.section}</td>
                      <td className="py-4 px-8 text-gray-600">{result.test_name}</td>
                      <td className="py-4 px-8 font-bold text-[#3B6255]">
                        <div className="flex items-center gap-2">
                          <span className={['CBC', 'PT/INR, PTT'].includes(result.test_name) ? 'whitespace-pre-line' : ''}>
                            {result.result_value} {result.unit}
                          </span>
                          <span className={`${indicator.color} font-bold text-lg`}>{indicator.symbol}</span>
                        </div>
                      </td>
                      <td className="py-4 px-8 relative">
                        <button onClick={() => setExpandedStepperId(expandedStepperId === result.id ? null : result.id)} className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(result.status)} flex items-center gap-1 cursor-pointer hover:opacity-80 transition`} title="Click to view status pipeline">
                          {updatingStatusId === result.id ? 'Updating...' : getStatusLabel(result.status)}
                          <ChevronRight className={`w-3 h-3 transition-transform ${expandedStepperId === result.id ? 'rotate-90' : ''}`} />
                        </button>
                      </td>
                      <td className="py-4 px-8 font-semibold text-gray-800">{price ? `₱${price}` : ''}</td>
                      <td className="py-4 px-8">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${billing?.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {billing?.status === 'paid' ? <>✓ Paid</> : <>⏳ Unpaid</>}
                        </span>
                      </td>
                      <td className="py-4 px-8 flex gap-2">
                        <button onClick={() => handleEdit(result)} className="text-[#3B6255] hover:text-[#5A7669] font-semibold text-sm flex items-center gap-1" title="Edit Result">
                          <Edit2 className="w-4 h-4" />Edit
                        </button>
                        {result.status === 'released' && (
                          <button onClick={() => handlePrint(result)} className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center gap-1" title="Print Result">
                            <Printer className="w-4 h-4" />Print
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Stepper Modal */}
      {expandedStepperId && (() => {
        const result = results.find(r => r.id === expandedStepperId);
        if (!result) return null;
        return (
          <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setExpandedStepperId(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto">
                <StatusStepper currentStatus={result.status} onAdvance={() => { moveToNextStatus(result.id, result.status); setExpandedStepperId(null); }} isUpdating={updatingStatusId === result.id} />
              </div>
            </div>
          </>
        );
      })()}

      {/* Print Report */}
      {printResult && (() => {
        const billing = billings.find(b => b.test_name === printResult.test_name && b.patient_name === printResult.patient_name);
        const price = getTestPrice(printResult.test_name, printResult.section);
        const abnormalStatus = getAbnormalStatus(printResult.result_value, printResult.test_name, printResult.section);
        const statusDisplay = abnormalStatus === 'high' ? '↑ HIGH' : abnormalStatus === 'low' ? '↓ LOW' : '✓ NORMAL';
        return (
          <div ref={printRef} style={{ display: 'none' }}>
            <div style={{ fontFamily: 'Arial, sans-serif', padding: '40px', maxWidth: '800px', margin: '0 auto', color: '#000' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #3B6255', paddingBottom: '20px' }}>
                <h1 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: 'bold' }}>Laboratory Test Result</h1>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Professional Laboratory Information System</p>
              </div>
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>PATIENT INFORMATION</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '13px' }}>
                  <div>
                    <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>Patient Name:</p>
                    <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{printResult.patient_name}</p>
                  </div>
                  <div>
                    <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>Date of Test:</p>
                    <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>{new Date(printResult.date_created).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>TEST RESULT</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <tr><td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Laboratory Section:</td><td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{printResult.section}</td></tr>
                  <tr><td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Test Name:</td><td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{printResult.test_name}</td></tr>
                  <tr><td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Result Value:</td><td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold', color: '#3B6255' }}>{printResult.result_value} {printResult.unit}</td></tr>
                  <tr><td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Reference Range:</td><td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{printResult.reference_range}</td></tr>
                  <tr><td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Status:</td><td style={{ padding: '10px', borderBottom: '1px solid #ddd', backgroundColor: '#CBDED3', color: '#3B6255', fontWeight: 'bold' }}>{statusDisplay}</td></tr>
                </table>
              </div>
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>BILLING INFORMATION</h3>
                <div style={{ fontSize: '13px' }}>
                  <div style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 'bold' }}>Test Price:</span><span>{price ? `₱${price.toFixed(2)}` : ''}</span></div>
                  <div style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: billing?.status === 'paid' ? 'green' : 'orange' }}><span>Payment Status:</span><span>{billing?.status === 'paid' ? '✓ PAID' : '⏳ UNPAID'}</span></div>
                  {billing?.status === 'paid' && billing?.or_number && (
                    <div style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 'bold' }}>OR Number:</span><span style={{ fontFamily: 'monospace' }}>{billing.or_number}</span></div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #ccc', textAlign: 'center', fontSize: '11px', color: '#666' }}>
                <p style={{ margin: '5px 0' }}>This is an official test result from the Laboratory Information System</p>
                <p style={{ margin: '5px 0' }}>Report Generated: {new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}