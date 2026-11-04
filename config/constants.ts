/**
 * CogniLab - KRRAX-JAM Inc Laboratory Information System Configuration
 * Contains all static configurations for the CogniLab application
 */

// Test sections and tests live in config/testCatalog.ts (single source of truth).
// Test prices are managed in Admin → Test Prices.

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
