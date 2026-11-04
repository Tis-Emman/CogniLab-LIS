-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 004
--   A. Link test results and billing to the patient and test request by ID
--      (instead of only by the patient's name), and backfill old rows.
--   B. Store MedTech license numbers, printed names and signature files in
--      the users table instead of hardcoding them in the report page.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A1. New link columns ─────────────────────────────────────────────────────
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS patient_id      UUID REFERENCES patients(id)      ON DELETE SET NULL;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS test_request_id UUID REFERENCES test_requests(id) ON DELETE SET NULL;
ALTER TABLE billing      ADD COLUMN IF NOT EXISTS patient_id      UUID REFERENCES patients(id)      ON DELETE SET NULL;
ALTER TABLE billing      ADD COLUMN IF NOT EXISTS test_request_id UUID REFERENCES test_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_test_results_patient_id      ON test_results (patient_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_request_id ON test_results (test_request_id);
CREATE INDEX IF NOT EXISTS idx_billing_patient_id           ON billing (patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_test_request_id      ON billing (test_request_id);
CREATE INDEX IF NOT EXISTS idx_test_requests_patient_id     ON test_requests (patient_id);

-- Name normaliser used only for the one-time backfill below
CREATE OR REPLACE FUNCTION cognilab_norm_name(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g'))
$$;

-- ── A2. Backfill patient_id by name (only when exactly one patient matches) ──
WITH candidates AS (
  SELECT r.id AS row_id, p.id AS patient_id,
         count(*) OVER (PARTITION BY r.id) AS n
  FROM test_results r
  JOIN patients p
    ON cognilab_norm_name(r.patient_name) IN (
         cognilab_norm_name(p.first_name || ' ' || p.last_name),
         cognilab_norm_name(p.first_name || ' ' || coalesce(p.middle_name, '') || ' ' || p.last_name))
  WHERE r.patient_id IS NULL
)
UPDATE test_results r SET patient_id = c.patient_id
FROM candidates c WHERE c.row_id = r.id AND c.n = 1;

WITH candidates AS (
  SELECT b.id AS row_id, p.id AS patient_id,
         count(*) OVER (PARTITION BY b.id) AS n
  FROM billing b
  JOIN patients p
    ON cognilab_norm_name(b.patient_name) IN (
         cognilab_norm_name(p.first_name || ' ' || p.last_name),
         cognilab_norm_name(p.first_name || ' ' || coalesce(p.middle_name, '') || ' ' || p.last_name))
  WHERE b.patient_id IS NULL
)
UPDATE billing b SET patient_id = c.patient_id
FROM candidates c WHERE c.row_id = b.id AND c.n = 1;

-- ── A3. Backfill test_request_id: the patient's newest request, made before the
--        row, that includes the same lab section ─────────────────────────────
UPDATE test_results r SET test_request_id = (
  SELECT tr.id FROM test_requests tr
  WHERE tr.patient_id = r.patient_id
    AND tr.created_at <= coalesce(r.created_at, now())
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(tr.requested_tests::jsonb) e
      WHERE upper(e->>'section') = upper(r.section))
  ORDER BY tr.created_at DESC LIMIT 1)
WHERE r.test_request_id IS NULL AND r.patient_id IS NOT NULL;

UPDATE billing b SET test_request_id = (
  SELECT tr.id FROM test_requests tr
  WHERE tr.patient_id = b.patient_id
    AND tr.created_at <= coalesce(b.created_at, now())
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(tr.requested_tests::jsonb) e
      WHERE upper(e->>'section') = upper(b.section))
  ORDER BY tr.created_at DESC LIMIT 1)
WHERE b.test_request_id IS NULL AND b.patient_id IS NOT NULL;

-- Rows still unlinked after this need a manual check:
--   SELECT id, patient_name, test_name FROM test_results WHERE patient_id IS NULL;
--   SELECT id, patient_name, test_name FROM billing      WHERE patient_id IS NULL;

-- ── B. Signatory details on users ────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS signatory_name VARCHAR(255);  -- printed on reports, e.g. "Ryza R. Alvaran, RMT, MLS(ASCP)"
ALTER TABLE users ADD COLUMN IF NOT EXISTS license_no     VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_file VARCHAR(255);  -- file in /public/signatures

-- Seed from the list that used to be hardcoded in the report page
UPDATE users SET signatory_name = 'Khrieana Rose C. Buenaventura, RMT', license_no = 'Lic. #0001', signature_file = 'khierana-signature.png'   WHERE full_name ILIKE '%buenaventura%' AND signatory_name IS NULL;
UPDATE users SET signatory_name = 'Mycah Charrise M. Hernandez, RMT',   license_no = 'Lic. #0002', signature_file = 'mycah-signature.png'      WHERE full_name ILIKE '%hernandez%'    AND signatory_name IS NULL;
UPDATE users SET signatory_name = 'Angel Winder A. Gautane, RMT',       license_no = 'Lic. #0003', signature_file = 'angel-signature.png'      WHERE full_name ILIKE '%gautane%'      AND signatory_name IS NULL;
UPDATE users SET signatory_name = 'Aaron Kelvin L. Imbien, RMT',        license_no = 'Lic. #0004', signature_file = 'aaron-signature.png'      WHERE full_name ILIKE '%imbien%'       AND signatory_name IS NULL;
UPDATE users SET signatory_name = 'Ram Jancel V. Suarez, RMT',          license_no = 'Lic. #0005', signature_file = 'ram-jancel-signature.png' WHERE full_name ILIKE '%suarez%'       AND signatory_name IS NULL;
UPDATE users SET signatory_name = 'Xavier Beirut L. Bangit, RMT, MLS(ASCP)', license_no = 'Lic. #0006', signature_file = 'xavier-signature.png' WHERE full_name ILIKE '%bangit%' AND signatory_name IS NULL;
UPDATE users SET signatory_name = 'Janna Lea Javon, RMT',               license_no = 'Lic. #0007', signature_file = 'janna-signature.png'      WHERE full_name ILIKE '%javon%'        AND signatory_name IS NULL;
UPDATE users SET signatory_name = 'Ryza R. Alvaran, RMT, MLS(ASCP)',    license_no = 'Lic. #0008', signature_file = 'ryza-signature.png'       WHERE full_name ILIKE '%alvaran%'      AND signatory_name IS NULL;
