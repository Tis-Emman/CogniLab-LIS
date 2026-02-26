/**
 * CogniLab - KRRAX-JAM Inc Laboratory Information System Configuration
 * Contains all static configurations for the CogniLab application
 */

export const LAB_SECTIONS = [
  'BLOOD BANK',
  'ISBB',
  'HEMATOLOGY',
  'CLINICAL CHEMISTRY',
  'MICROBIOLOGY',
  'IMMUNOLOGY',
  'HISTOPATHOLOGY',
  'PARASITOLOGY',
  'SEROLOGY',
] as const;

// All sections are now active
export const ACTIVE_SECTIONS = ['BLOOD BANK', 'ISBB', 'HEMATOLOGY', 'CLINICAL CHEMISTRY', 'MICROBIOLOGY', 'IMMUNOLOGY', 'HISTOPATHOLOGY', 'PARASITOLOGY', 'SEROLOGY'] as const;

export const TESTS_BY_SECTION: Record<string, { name: string; referenceRange: string; unit: string }[]> = {
  'BLOOD BANK': [
    { name: 'Blood Type', referenceRange: 'ABO/RH', unit: 'Type' },
    { name: 'Crossmatch', referenceRange: 'Compatible', unit: 'Result' },
  ],
  'ISBB': [
    { name: 'Antibody Screening', referenceRange: 'Negative', unit: 'Result' },
    { name: 'Direct Coombs Test', referenceRange: 'Negative', unit: 'Result' },
  ],
  'HEMATOLOGY': [
    { name: 'Complete Blood Count (CBC)', referenceRange: 'Normal Range', unit: 'K/uL' },
    { name: 'Hemoglobin', referenceRange: '12-16 g/dL', unit: 'g/dL' },
    { name: 'Hematocrit', referenceRange: '36-46%', unit: '%' },
    { name: 'White Blood Cells', referenceRange: '4.5-11 K/uL', unit: 'K/uL' },
    { name: 'Platelets', referenceRange: '150-400 K/uL', unit: 'K/uL' },
  ],
  'CLINICAL CHEMISTRY': [
    {
      name: 'Random Blood Sugar (Glucose)',
      referenceRange: '< 140 mg/dL',
      unit: 'mg/dL',
    },
    {
      name: 'Blood Cholesterol',
      referenceRange: '< 200 mg/dL',
      unit: 'mg/dL',
    },
    { name: 'Blood Urea Nitrogen (BUN)', referenceRange: '7-20 mg/dL', unit: 'mg/dL' },
    { name: 'Creatinine', referenceRange: '0.7-1.3 mg/dL', unit: 'mg/dL' },
  ],
  'MICROBIOLOGY': [
    { name: 'Bacterial Culture', referenceRange: 'No Growth', unit: 'Result' },
    { name: 'Sensitivity Testing', referenceRange: 'Various', unit: 'Result' },
    { name: 'Gram Stain', referenceRange: 'Normal', unit: 'Report' },
  ],
  'IMMUNOLOGY': [
    { name: 'Dengue NS1 Antigen', referenceRange: 'Negative', unit: 'Result' },
    { name: 'COVID-19 Antigen', referenceRange: 'Negative', unit: 'Result' },
    { name: 'HIV Test', referenceRange: 'Negative', unit: 'Result' },
  ],
  'HISTOPATHOLOGY': [
    { name: 'Tissue Examination', referenceRange: 'Normal', unit: 'Report' },
    { name: 'Biopsy Analysis', referenceRange: 'Benign', unit: 'Report' },
  ],
  'PARASITOLOGY': [
    { name: 'Stool Exam', referenceRange: 'Negative', unit: 'Result' },
    { name: 'Blood Smear', referenceRange: 'Negative', unit: 'Result' },
  ],
  'SEROLOGY': [
    { name: 'Hepatitis B Surface Antigen', referenceRange: 'Negative', unit: 'Result' },
    { name: 'Hepatitis C Antibody', referenceRange: 'Negative', unit: 'Result' },
    { name: 'Syphilis Test (RPR)', referenceRange: 'Negative', unit: 'Result' },
  ],
};

export const TEST_PRICES: Record<string, number> = {
  'Random Blood Sugar (Glucose)': 150,
  'Blood Cholesterol': 200,
};

export const USER_ROLES = ['Admin', 'MedTech'] as const;

export const DEMO_USERS = {
  admin: { email: 'admin@clinic.com', password: 'password', role: 'Admin', name: 'Administrator' },
  medtech: { email: 'medtech@clinic.com', password: 'password', role: 'MedTech', name: 'MedTech User' },
};

export const BILLING_STATUS = {
  PAID: 'paid',
  UNPAID: 'unpaid',
} as const;

export const RESULT_STATUS = {
  PENDING: 'pending',
  RELEASED: 'released',
} as const;
