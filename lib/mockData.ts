// Mock Data for Client Demonstration
// Set NEXT_PUBLIC_USE_MOCK_DATA=true in .env.local to enable

export const MOCK_USERS = [
  // Faculty - System Admin (kept for login)
  {
    id: 'user-009',
    full_name: 'BSMT Faculty Member',
    email: 'bsmtCogniLab2026@gmail.com',
    username: 'BSMT2026LIS',
    password: 'BSMT2026LIS', // Mock only - THIS IS THE ONLY ONE WHO CAN ENTER THE SYSTEM
    role: 'faculty',
    department: 'Laboratory Management',
    status: 'active',
    encryption_key: 'ENC_KEY_ADMIN',
    join_date: '2024-01-01',
    last_login: new Date().toISOString(),
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  },
];

export const MOCK_PATIENTS: any[] = [];

export const MOCK_TEST_RESULTS: any[] = [];

export const MOCK_BILLING: any[] = [];

// Test pricing reference
export const TEST_PRICING: Record<string, Record<string, number>> = {
  'CLINICAL CHEMISTRY': {
    'Blood Glucose': 250,
    'Cholesterol': 300,
    'Triglycerides': 300,
    'HDL Cholesterol': 300,
    'LDL Cholesterol': 300,
    'Blood Urea Nitrogen': 200,
    'Creatinine': 200,
    'Uric Acid': 200,
    'Sodium': 150,
    'Potassium': 150,
    'Chloride': 150,
    'Total Protein': 200,
    'Albumin': 200,
    'Globulin': 200,
    'Total Bilirubin': 200,
    'Direct Bilirubin': 200,
    'AST': 250,
    'ALT': 250,
    'ALP': 250,
    'Amylase': 300,
    'Lipase': 300,
  },
  'HEMATOLOGY': {
    'Complete Blood Count': 400,
    'Hemoglobin': 150,
    'Hematocrit': 150,
    'Red Blood Cell Count': 200,
    'White Blood Cell Count': 200,
    'Platelet Count': 200,
  },
  'MICROBIOLOGY': {
    'Bacterial Culture': 500,
    'Gram Stain': 200,
    'Sensitivity Test': 300,
  },
  'SEROLOGY': {
    'Typhoid Serology': 350,
    'Dengue Test': 400,
    'COVID-19 Test': 500,
  },
  'IMMUNOLOGY': {
    'Thyroid Function': 400,
    'HIV Test': 450,
    'Pregnancy Test': 300,
  },
  'BLOOD BANK': {
    'Blood Typing': 200,
    'Cross Matching': 300,
  },
  'PARASITOLOGY': {
    'Stool Examination': 250,
    'Urinalysis': 250,
  },
  'HISTOPATHOLOGY': {
    'Biopsy': 2000,
    'Pathology Report': 500,
  },
  'ISBB': {
    'ISBB Test': 300,
  },
};

// Test reference ranges
export const TEST_REFERENCE_RANGES: Record<string, Record<string, { min?: number; max?: number; normal?: string; unit: string }>> = {
  'CLINICAL CHEMISTRY': {
    'Blood Glucose': { min: 70, max: 100, unit: 'mg/dL' },
    'Cholesterol': { max: 200, unit: 'mg/dL' },
    'Triglycerides': { max: 150, unit: 'mg/dL' },
    'HDL Cholesterol': { min: 40, unit: 'mg/dL' },
    'LDL Cholesterol': { max: 130, unit: 'mg/dL' },
    'Blood Urea Nitrogen': { min: 7, max: 20, unit: 'mg/dL' },
    'Creatinine': { min: 0.7, max: 1.3, unit: 'mg/dL' },
    'Uric Acid': { min: 3.5, max: 7.2, unit: 'mg/dL' },
    'Sodium': { min: 136, max: 145, unit: 'mEq/L' },
    'Potassium': { min: 3.5, max: 5.0, unit: 'mEq/L' },
    'Chloride': { min: 98, max: 107, unit: 'mEq/L' },
    'Total Protein': { min: 6.0, max: 8.3, unit: 'g/dL' },
    'Albumin': { min: 3.5, max: 5.5, unit: 'g/dL' },
    'Globulin': { min: 2.3, max: 3.5, unit: 'g/dL' },
    'Total Bilirubin': { max: 1.2, unit: 'mg/dL' },
    'Direct Bilirubin': { max: 0.3, unit: 'mg/dL' },
    'AST': { max: 40, unit: 'U/L' },
    'ALT': { max: 44, unit: 'U/L' },
    'ALP': { min: 44, max: 147, unit: 'U/L' },
    'Amylase': { min: 30, max: 110, unit: 'U/L' },
    'Lipase': { max: 160, unit: 'U/L' },
  },
  'HEMATOLOGY': {
    'Complete Blood Count': { min: 4.5, max: 5.9, unit: 'million/µL' },
    'Hemoglobin': { min: 13.5, max: 17.5, unit: 'g/dL' },
    'Hematocrit': { min: 41, max: 53, unit: '%' },
    'Red Blood Cell Count': { min: 4.5, max: 5.9, unit: 'million/µL' },
    'White Blood Cell Count': { min: 4.5, max: 11.0, unit: 'thousand/µL' },
    'Platelet Count': { min: 150, max: 400, unit: 'thousand/µL' },
  },
  'MICROBIOLOGY': {
    'Bacterial Culture': { normal: 'No growth', unit: 'N/A' },
    'Gram Stain': { normal: 'Normal flora', unit: 'N/A' },
    'Sensitivity Test': { normal: 'See report', unit: 'N/A' },
  },
  'SEROLOGY': {
    'Typhoid Serology': { normal: 'Negative', unit: 'N/A' },
    'Dengue Test': { normal: 'Negative', unit: 'N/A' },
    'COVID-19 Test': { normal: 'Negative', unit: 'N/A' },
  },
  'IMMUNOLOGY': {
    'Thyroid Function': { min: 0.4, max: 4.0, unit: 'mIU/L' },
    'HIV Test': { normal: 'Negative', unit: 'N/A' },
    'Pregnancy Test': { normal: 'Negative', unit: 'N/A' },
  },
  'BLOOD BANK': {
    'Blood Typing': { normal: 'See report', unit: 'N/A' },
    'Cross Matching': { normal: 'Compatible', unit: 'N/A' },
  },
  'PARASITOLOGY': {
    'Stool Examination': { normal: 'Negative', unit: 'N/A' },
    'Urinalysis': { min: 4.5, max: 8.0, unit: 'pH' },
  },
  'HISTOPATHOLOGY': {
    'Biopsy': { normal: 'See report', unit: 'N/A' },
    'Pathology Report': { normal: 'See report', unit: 'N/A' },
  },
  'ISBB': {
    'ISBB Test': { normal: 'See report', unit: 'N/A' },
  },
};

export const MOCK_AUDIT_LOGS: any[] = [];

export const MOCK_AUTH_USER = {
  id: 'user-001',
  email: 'maria.santos@lis.com',
  full_name: 'Dr. Maria Santos',
  role: 'faculty',
  department: 'Clinical Chemistry',
  encryption_key: 'ENC_KEY_001',
};