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
  'IMMUNOLOGY/SEROLOGY',
  'HISTOPATHOLOGY',
  'PARASITOLOGY',

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

/**
 * Predefined specializations for requesting doctors, each mapped to the lab
 * sections whose tests that specialty most often orders. Used by the
 * Admin → Doctors form; "sections" is shown as a hint only.
 */
export const DOCTOR_SPECIALIZATIONS: { name: string; sections: string[] }[] = [
  { name: 'General Practice',          sections: ['HEMATOLOGY', 'CLINICAL MICROSCOPY', 'CLINICAL CHEMISTRY'] },
  { name: 'Family Medicine',           sections: ['HEMATOLOGY', 'CLINICAL MICROSCOPY', 'CLINICAL CHEMISTRY'] },
  { name: 'Internal Medicine',         sections: ['HEMATOLOGY', 'CLINICAL CHEMISTRY', 'CLINICAL MICROSCOPY', 'IMMUNOLOGY/SEROLOGY'] },
  { name: 'Pediatrics',                sections: ['HEMATOLOGY', 'CLINICAL MICROSCOPY', 'MICROBIOLOGY', 'IMMUNOLOGY/SEROLOGY'] },
  { name: 'Obstetrics & Gynecology',   sections: ['HEMATOLOGY', 'BLOOD BANK', 'CLINICAL MICROSCOPY', 'IMMUNOLOGY/SEROLOGY', 'HISTOPATHOLOGY'] },
  { name: 'General Surgery',           sections: ['HEMATOLOGY', 'BLOOD BANK', 'CLINICAL CHEMISTRY', 'HISTOPATHOLOGY'] },
  { name: 'Emergency Medicine',        sections: ['HEMATOLOGY', 'BLOOD BANK', 'CLINICAL CHEMISTRY'] },
  { name: 'Occupational Medicine',     sections: ['HEMATOLOGY', 'CLINICAL MICROSCOPY', 'IMMUNOLOGY/SEROLOGY'] },
  { name: 'Cardiology',                sections: ['CLINICAL CHEMISTRY', 'HEMATOLOGY'] },
  { name: 'Endocrinology',             sections: ['CLINICAL CHEMISTRY', 'IMMUNOLOGY/SEROLOGY'] },
  { name: 'Nephrology',                sections: ['CLINICAL CHEMISTRY', 'CLINICAL MICROSCOPY', 'HEMATOLOGY'] },
  { name: 'Gastroenterology',          sections: ['CLINICAL CHEMISTRY', 'CLINICAL MICROSCOPY', 'IMMUNOLOGY/SEROLOGY', 'HISTOPATHOLOGY'] },
  { name: 'Pulmonology',               sections: ['MICROBIOLOGY', 'HEMATOLOGY', 'CLINICAL CHEMISTRY'] },
  { name: 'Infectious Disease',        sections: ['MICROBIOLOGY', 'IMMUNOLOGY/SEROLOGY', 'HEMATOLOGY'] },
  { name: 'Hematology',                sections: ['HEMATOLOGY', 'BLOOD BANK'] },
  { name: 'Oncology',                  sections: ['HEMATOLOGY', 'CLINICAL CHEMISTRY', 'HISTOPATHOLOGY'] },
  { name: 'Rheumatology',              sections: ['IMMUNOLOGY/SEROLOGY', 'CLINICAL CHEMISTRY', 'HEMATOLOGY'] },
  { name: 'Urology',                   sections: ['CLINICAL MICROSCOPY', 'MICROBIOLOGY', 'CLINICAL CHEMISTRY', 'HISTOPATHOLOGY'] },
  { name: 'Dermatology',               sections: ['HISTOPATHOLOGY', 'MICROBIOLOGY', 'IMMUNOLOGY/SEROLOGY'] },
  { name: 'Pathology',                 sections: ['HISTOPATHOLOGY', 'HEMATOLOGY', 'CLINICAL CHEMISTRY', 'MICROBIOLOGY'] },
];

/**
 * Service area. CogniLab only serves Baliwag City, Bulacan, so city and
 * province are fixed and only the barangay is chosen.
 * "Baliwag" is the official spelling since the city conversion (RA 11929, 2022);
 * older sources spell it "Baliuag".
 */
export const SERVICE_AREA = {
  city: 'Baliwag City',
  province: 'Bulacan',
} as const;

/** The 27 barangays of Baliwag City, Bulacan (source: PhilAtlas / City of Baliwag). */
export const BALIWAG_BARANGAYS = [
  'Bagong Nayon',
  'Barangca',
  'Calantipay',
  'Catulinan',
  'Concepcion',
  'Hinukay',
  'Makinabang',
  'Matangtubig',
  'Pagala',
  'Paitan',
  'Piel',
  'Pinagbarilan',
  'Poblacion',
  'Sabang',
  'San Jose',
  'San Roque',
  'Santa Barbara',
  'Santo Cristo',
  'Santo Niño',
  'Subic',
  'Sulivan',
  'Tangos',
  'Tarcan',
  'Tiaong',
  'Tibag',
  'Tilapayong',
  'Virgen delas Flores',
] as const;
