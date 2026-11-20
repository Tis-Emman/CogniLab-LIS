"use client";

/**
 * The printed CogniLab laboratory report, shared by Report Generation (MedTech)
 * and the Doctor portal preview, so both always show the same layout.
 */

import React, { forwardRef, useEffect, useState } from "react";

const DROPDOWN_TESTS = [
  "ABO Blood Typing","Rh Typing","Crossmatching","Antibody Screening",
  "Infectious Disease Screening","Culture","Sensitivity","Sensitivity (Antibiogram)",
  "Gram Staining","India Ink","Wet Mount","KOH Mount","Pregnancy Test (hCG)",
  "Pregnancy Test (PT)","Fecal Occult Blood Test","Fecal Occult Blood Test (FOBT)",
  "Fecalysis - Ova or Parasite","Routine Fecalysis (FA)","UA Color","UA Transparency",
  "UA Protein/Glucose","UA Bilirubin/Ketone","UA Bacteria/Casts/Crystals",
  "Preliminary Report","Final Report",
];

const shouldShowReferenceRange = (testName: string): boolean =>
  !DROPDOWN_TESTS.includes(testName);

export function getAbnormalStatus(
  resultValue: string,
  referenceRange: string
): "high" | "low" | "normal" | null {
  const num = parseFloat(resultValue);
  if (isNaN(num) || !referenceRange) return null;
  const ltMatch = referenceRange.match(/^[<≤]\s*([\d.]+)/);
  const gtMatch = referenceRange.match(/^[>≥]\s*([\d.]+)/);
  const rangeMatch = referenceRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (ltMatch) { const max = parseFloat(ltMatch[1]); return num > max ? "high" : "normal"; }
  if (gtMatch) { const min = parseFloat(gtMatch[1]); return num < min ? "low" : "normal"; }
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (num < min) return "low";
    if (num > max) return "high";
    return "normal";
  }
  return null;
}

const TEST_REFERENCE_RANGES_FLAT: Record<string, { min?: number; max?: number; unit?: string }> = {
  // CBC differential
  "Neutrophils":          { min: 45,   max: 75,   unit: "%"        },
  "Lymphocytes":          { min: 16,   max: 46,   unit: "%"        },
  "Monocytes":            { min: 4,    max: 11,   unit: "%"        },
  "Eosinophils":          { min: 0,    max: 8,    unit: "%"        },
  "Basophils":            { min: 0,    max: 3,    unit: "%"        },
  // RBC Indices
  "MCV":                  { min: 80,   max: 100,  unit: "fL"       },
  "MCH":                  { min: 27,   max: 31,   unit: "pg"       },
  "RDW":                  { min: 11.5, max: 14.5, unit: "%"        },
  // CBC extras
  "Hemoglobin (Male)":    { min: 14.0, max: 17.0, unit: "g/dL"    },
  "Hemoglobin (Female)":  { min: 12.0, max: 15.0, unit: "g/dL"    },
  "Hematocrit (Male)":    { min: 40,   max: 54,   unit: "%"        },
  "Hematocrit (Female)":  { min: 37,   max: 47,   unit: "%"        },
  "Platelet Count":       { min: 150,  max: 450,  unit: "x10^9/L" },
  "Peripheral Blood Smear": {                     unit: ""         },
  // PT/INR/PTT
  "PT":                   { min: 11.0, max: 13.5, unit: "seconds"  },
  "INR":                  { min: 0.8,  max: 1.2,  unit: ""         },
  "aPTT":                 { min: 25.0, max: 35.0, unit: "seconds"  },
  // ESR
  "ESR (Male)":           { min: 0,    max: 15,   unit: "mm/hr"   },
  "ESR (Female)":         { min: 0,    max: 15,   unit: "mm/hr"   },
  "ESR":                  { min: 0,    max: 15,   unit: "mm/hr"   },
  // Urinalysis
  "pH":                   { min: 4.5,  max: 8.0,  unit: ""         },
  "Urobilinogen":         { min: 0.2,  max: 1.0,  unit: ""         },
  "WBC":                  { min: 0,    max: 5,    unit: "/hpf"     },
  "RBC":                  { min: 0,    max: 2,    unit: "/hpf"     },
  // ABG
  "pCO2":                 { min: 35,   max: 45,   unit: "mm Hg"   },
  "PO2":                  { min: 80,   max: 100,  unit: "mm Hg"   },
  "SaO2":                 { min: 90,              unit: "%"        },
  "HCO3":                 { min: 22,   max: 26,   unit: "mEq/L"   },
  // Electrolytes
  "Na+":                  { min: 135,  max: 145,  unit: "mmol/L"  },
  "K+":                   { min: 3.4,  max: 5.0,  unit: "mmol/L"  },
  "Cl-":                  { min: 95,   max: 108,  unit: "mmol/L"  },
  "Bicarbonate":          { min: 20,   max: 32,   unit: "mmol/L"  },
  "Ca++":                 { min: 8.5,  max: 10.5, unit: "mg/dL"   },
  "Phosphorus":           { min: 3.0,  max: 4.5,  unit: "mmol/L"  },
  "Mg++":                 { min: 1.8,  max: 3.0,  unit: "mg/dL"   },
};

export const PATHOLOGIST = {
  displayName: "Elizabeth E. Chua, MD, FPSP",
  license: "Lic. #00078301",
  signatureFile: "elizabeth-chua-signature.png",
};

/** A MedTech who signs the report. */
export interface Signatory {
  id: string;
  displayName: string;
  license: string;
  signatureFile: string;
}

export interface ReportData {
  patientId: string;
  patientName: string;
  age: number;
  sex: string;
  birthdate: string;
  municipality: string;
  province: string;
  address: string;
  physician: string;
  dateRequested: string;
  dateReceived: string;
  tests: Array<{ section: string; name: string; result: string; referenceRange: string; unit: string; }>;
  billingStatus: "paid" | "unpaid";
  dateReleased: string;
}

function groupTestsBySection(tests: ReportData["tests"]) {
  const map: Record<string, ReportData["tests"]> = {};
  for (const t of tests) {
    if (!map[t.section]) map[t.section] = [];
    map[t.section].push(t);
  }
  return map;
}

export const formatReportDate = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;

export const formatReportDateTime = (d: Date) => {
  const h = d.getHours();
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${formatReportDate(d)} ${String(h12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`;
};

interface LabReportDocumentProps {
  report: ReportData;
  encoder: Signatory | null;
  qualityChecker: Signatory | null;
}

export const LabReportDocument = forwardRef<HTMLDivElement, LabReportDocumentProps>(
  function LabReportDocument({ report, encoder, qualityChecker }, ref) {
    return (
      <div ref={ref} id="report-content" className="bg-white shadow-lg">
        <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt", color: "#000", padding: "24px 28px" }}>

          {/* ── HEADER ── */}
          <div style={{ borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <img src="/images/logo.png" alt="CogniLab Logo" style={{ height: "56px", width: "auto", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div>
                <div style={{ fontSize: "18pt", fontWeight: "900", letterSpacing: "0.5px", fontFamily: "Arial, sans-serif" }}>CogniLab</div>
                <div style={{ fontSize: "9pt", color: "#444", fontFamily: "Arial, sans-serif" }}>KRRAX-JAM Inc · Professional Medical Testing Services</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", fontSize: "8.5pt", fontFamily: "Arial, sans-serif" }}>
                <div style={{ fontWeight: "bold" }}>Lab. Number: {report.patientId}</div>
                <div>Birthdate: {report.birthdate}</div>
                <div>Dispatch: ONLINE/PICK-UP</div>
                <div>Page: 1 of 1</div>
              </div>
            </div>
          </div>

          {/* ── PATIENT INFO BLOCK ── */}
          <div style={{ borderBottom: "1px solid #aaa", paddingBottom: "8px", marginBottom: "10px", fontFamily: "Arial, sans-serif", fontSize: "9pt" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ width: "12%", color: "#555", paddingBottom: "3px" }}>Name</td>
                  <td style={{ width: "1%" }}>:</td>
                  <td style={{ width: "37%", fontWeight: "bold", paddingBottom: "3px" }}>{report.patientName}</td>
                  <td style={{ width: "12%", color: "#555", paddingBottom: "3px" }}>Lab. Number</td>
                  <td style={{ width: "1%" }}>:</td>
                  <td style={{ fontWeight: "bold", paddingBottom: "3px" }}>{report.patientId}</td>
                </tr>
                <tr>
                  <td style={{ color: "#555", paddingBottom: "3px" }}>Age</td>
                  <td>:</td>
                  <td style={{ paddingBottom: "3px" }}>
                    <span style={{ fontWeight: "bold" }}>{report.age}</span>
                    <span style={{ marginLeft: "16px", color: "#555" }}>Sex :</span>
                    <span style={{ fontWeight: "bold", marginLeft: "4px" }}>{report.sex}</span>
                  </td>
                  <td style={{ color: "#555", paddingBottom: "3px" }}>Birthdate</td>
                  <td>:</td>
                  <td style={{ paddingBottom: "3px" }}>{report.birthdate}</td>
                </tr>
                <tr>
                  <td style={{ color: "#555", paddingBottom: "3px" }}>Source</td>
                  <td>:</td>
                  <td style={{ paddingBottom: "3px", fontWeight: "bold" }}>{report.address || "N/A"}</td>
                  <td style={{ color: "#555", paddingBottom: "3px" }}>Dispatch</td>
                  <td>:</td>
                  <td style={{ paddingBottom: "3px" }}>ONLINE/PICK-UP</td>
                </tr>
                <tr>
                  <td style={{ color: "#555", paddingBottom: "3px" }}>Clinician</td>
                  <td>:</td>
                  <td style={{ paddingBottom: "3px" }}>{report.physician}</td>
                  <td></td><td></td><td></td>
                </tr>
                <tr>
                  <td style={{ color: "#555" }}>Date Requested</td>
                  <td>:</td>
                  <td>{report.dateRequested}</td>
                  <td style={{ color: "#555" }}>Received</td>
                  <td>:</td>
                  <td>{report.dateReceived}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── TEST RESULTS TABLE (4-column: Test Name | Result | Normal Range | Units) ── */}
          {(() => {
            const grouped = groupTestsBySection(report.tests);

            interface FlatRow {
              label: string;
              result: string;
              referenceRange: string;
              unit: string;
              isGroupHeader?: boolean;
              indent?: boolean;
            }

            const buildRows = (): { section: string; rows: FlatRow[] }[] => {
              return Object.entries(grouped).map(([section, tests]) => {
                const rows: FlatRow[] = [];
                for (const test of tests) {
                  const isMultiline = test.result.includes("\n");
                  if (isMultiline) {
                    rows.push({ label: test.name, result: "", referenceRange: "", unit: "", isGroupHeader: true });
                    const lines = test.result.split("\n");
                    for (const line of lines) {
                      const colonIdx = line.indexOf(":");
                      if (colonIdx === -1) { rows.push({ label: line, result: "", referenceRange: "", unit: "", indent: true }); continue; }
                      const subLabel = line.slice(0, colonIdx).trim();
                      const val = line.slice(colonIdx + 1).trim();
                      const subRef = (TEST_REFERENCE_RANGES_FLAT as any)[subLabel];
                      const subRangeStr = subRef
                        ? subRef.min !== undefined && subRef.max !== undefined
                          ? `${subRef.min} – ${subRef.max}`
                          : subRef.min !== undefined ? `> ${subRef.min}` : subRef.max !== undefined ? `< ${subRef.max}` : ""
                        : "";
                      const subUnit = subRef?.unit ?? test.unit ?? "";
                      rows.push({ label: subLabel, result: val, referenceRange: subRangeStr, unit: subUnit, indent: true });
                    }
                  } else {
                    rows.push({ label: test.name, result: test.result, referenceRange: test.referenceRange || "", unit: test.unit || "" });
                  }
                }
                return { section, rows };
              });
            };

            const allSections = buildRows();

            return (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif", fontSize: "9.5pt", marginBottom: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #000", borderTop: "1.5px solid #000" }}>
                    <th style={{ textAlign: "left",   padding: "5px 8px", fontWeight: "bold", width: "40%" }}>Test Name</th>
                    <th style={{ textAlign: "center", padding: "5px 8px", fontWeight: "bold", width: "15%" }}>Result</th>
                    <th style={{ textAlign: "center", padding: "5px 8px", fontWeight: "bold", width: "30%" }}>Normal Range</th>
                    <th style={{ textAlign: "center", padding: "5px 8px", fontWeight: "bold", width: "15%" }}>Units</th>
                  </tr>
                </thead>
                <tbody>
                  {allSections.map(({ section, rows }) => (
                    <React.Fragment key={`sec-${section}`}>
                      <tr>
                        <td colSpan={4} style={{ paddingTop: "10px", paddingBottom: "3px", paddingLeft: "6px", fontWeight: "bold", fontSize: "9.5pt", borderBottom: "1px solid #bbb", color: "#222" }}>
                          {section}
                        </td>
                      </tr>
                      {rows.map((row, ri) => {
                        if (row.isGroupHeader) {
                          return (
                            <tr key={`gh-${ri}`}>
                              <td colSpan={4} style={{ paddingLeft: "10px", paddingTop: "6px", paddingBottom: "2px", fontWeight: "bold", fontSize: "9pt", color: "#333" }}>
                                {row.label}
                              </td>
                            </tr>
                          );
                        }
                        const abnormal = row.result && row.referenceRange
                          ? getAbnormalStatus(row.result, row.referenceRange)
                          : null;
                        const isHigh = abnormal === "high";
                        const isLow  = abnormal === "low";
                        const resultColor = isHigh ? "#dc2626" : isLow ? "#2563eb" : "inherit";
                        const arrow = isHigh ? " ↑" : isLow ? " ↓" : "";
                        return (
                          <tr key={`row-${ri}`} style={{ borderBottom: "1px solid #e8e8e8" }}>
                            <td style={{ paddingLeft: row.indent ? "20px" : "10px", paddingTop: "4px", paddingBottom: "4px" }}>
                              {row.label}
                            </td>
                            <td style={{ textAlign: "center", paddingTop: "4px", paddingBottom: "4px", fontWeight: (isHigh || isLow) ? "700" : "normal", color: resultColor }}>
                              {row.result}{arrow}
                            </td>
                            <td style={{ textAlign: "center", paddingTop: "4px", paddingBottom: "4px", color: "#333" }}>
                              {row.referenceRange || ""}
                            </td>
                            <td style={{ textAlign: "center", paddingTop: "4px", paddingBottom: "4px", color: "#555" }}>
                              {row.unit || ""}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            );
          })()}

          {/* ── LEGEND ── */}
          {report.tests.some((t) => shouldShowReferenceRange(t.name)) && (
            <div style={{ borderTop: "1.5px solid #000", paddingTop: "6px", marginBottom: "12px", fontFamily: "Arial, sans-serif", fontSize: "8pt", display: "flex", gap: "24px" }}>
              <span><strong>LEGEND:</strong></span>
              <span>↑ - High</span>
              <span>↑↑ - Alert Value High</span>
              <span>↓ - Low</span>
              <span>↓↓ - Alert Value Low</span>
            </div>
          )}

          {/* ── SIGNATURE SECTION ── */}
          <div style={{ borderTop: "1.5px solid #000", paddingTop: "8px", fontFamily: "Arial, sans-serif" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
              <SignatureBlock name={encoder?.displayName ?? ""} license={encoder?.license ?? ""} role="REGISTERED MEDICAL TECHNOLOGIST" signatureFile={encoder?.signatureFile} placeholder={!encoder} />
              <SignatureBlock name={qualityChecker?.displayName ?? ""} license={qualityChecker?.license ?? ""} role="REGISTERED MEDICAL TECHNOLOGIST" signatureFile={qualityChecker?.signatureFile} placeholder={!qualityChecker} />
              <SignatureBlock name={PATHOLOGIST.displayName} license={PATHOLOGIST.license} role="PATHOLOGIST" signatureFile={PATHOLOGIST.signatureFile} />
            </div>
            <div style={{ borderTop: "1.5px solid #000", marginTop: "6px", paddingTop: "4px", display: "flex", justifyContent: "space-between", fontSize: "7.5pt", color: "#444" }}>
              <span>REGISTERED MEDICAL TECHNOLOGIST</span>
              <span style={{ fontStyle: "italic" }}>** Report Electronically Signed Out **</span>
              <span>PATHOLOGIST</span>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{ borderTop: "1px solid #ccc", marginTop: "10px", paddingTop: "6px", textAlign: "center", fontFamily: "Arial, sans-serif", fontSize: "7.5pt", color: "#666" }}>
            This report is confidential and intended solely for the use of the addressed recipient. Unauthorized access, distribution, or copying is strictly prohibited.
          </div>

        </div>
      </div>
    );
  },
);

interface SignatureBlockProps {
  name: string;
  license: string;
  role: string;
  signatureFile?: string;
  placeholder?: boolean;
}

function SignatureBlock({ name, license, role, signatureFile, placeholder = false }: SignatureBlockProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [signatureFile]);
  return (
    <div style={{ textAlign: "center", fontSize: "8.5pt", fontFamily: "Arial, sans-serif" }}>
      <div style={{ height: "52px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
        {placeholder ? (
          <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "8pt" }}>No selection</span>
        ) : signatureFile && !imgError ? (
          <img src={`/signatures/${signatureFile}`} alt={`Signature of ${name}`} style={{ maxHeight: "52px", maxWidth: "100%", objectFit: "contain" }} onError={() => setImgError(true)} />
        ) : (
          <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "8pt" }}>Signature pending</span>
        )}
      </div>
      <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}></div>
      <div style={{ fontWeight: "bold", fontSize: "8.5pt" }}>{name || "—"}</div>
      <div style={{ color: "#555", fontSize: "7.5pt" }}>{license}</div>
      <div style={{ fontWeight: "bold", fontSize: "7.5pt", marginTop: "2px", textTransform: "uppercase" }}>{role}</div>
    </div>
  );
}
