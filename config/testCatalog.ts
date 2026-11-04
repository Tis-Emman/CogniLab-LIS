/**
 * The ONE list of tests that can be requested, billed and encoded.
 * Used by Test Request, the Patients page popup, Test Results and Admin → Test Prices.
 * (Previously copied separately into each page, and the copies drifted apart.)
 */

export const REQUEST_SECTIONS = [
  "BLOOD BANK",
  "HEMATOLOGY",
  "CLINICAL MICROSCOPY",
  "CLINICAL CHEMISTRY",
  "MICROBIOLOGY",
  "IMMUNOLOGY/SEROLOGY",
  "HISTOPATHOLOGY",
];

export const REQUEST_TESTS: Record<string, string[]> = {
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

/** Every requestable test as { section, test_name }. */
export const ALL_REQUEST_TESTS = REQUEST_SECTIONS.flatMap((section) =>
  (REQUEST_TESTS[section] || []).map((test_name) => ({ section, test_name })),
);
