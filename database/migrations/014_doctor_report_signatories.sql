-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 014: signatories for the Doctor portal report preview.
-- Run after 013. Safe to re-run.
--
-- Doctors can't read the users or quality_checks tables (RLS, migration 005),
-- but the report preview needs the two MedTechs who signed it. This function
-- returns ONLY the signatory details (printed name, license no., signature file)
-- and ONLY for RELEASED results that belong to the signed-in, active doctor,
-- and whose test request is COMPLETED (every requested test released, i.e. the
-- MedTech process is finished). Anyone else gets no rows.
--
--   kind = 'encoder' : who encoded the results (test_results.created_by,
--                      falling back to the test request's created_by)
--   kind = 'qc'      : who verified them in Quality Checking (newest check)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.doctor_report_signatories(result_ids UUID[])
RETURNS TABLE (kind TEXT, display_name TEXT, license_no TEXT, signature_file TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH visible AS (
    SELECT r.id, r.created_by, r.created_at, r.test_request_id
    FROM test_results r
    WHERE r.id = ANY (result_ids)
      AND r.status = 'released'
      AND public.my_doctor_id() IS NOT NULL
      -- the whole request must be finished (older results without a request link: released is enough)
      AND (r.test_request_id IS NULL
           OR EXISTS (SELECT 1 FROM test_requests q WHERE q.id = r.test_request_id AND q.status = 'completed'))
      AND (   r.test_request_id IN (SELECT public.doctor_request_ids())
           OR r.patient_id      IN (SELECT public.doctor_patient_ids())
           OR (r.patient_id IS NULL AND r.patient_name IN (SELECT public.doctor_patient_names())))
  ),
  encoder AS (
    SELECT coalesce(nullif(trim(v.created_by), ''), nullif(trim(q.created_by), '')) AS who
    FROM visible v
    LEFT JOIN test_requests q ON q.id = v.test_request_id
    WHERE coalesce(nullif(trim(v.created_by), ''), nullif(trim(q.created_by), '')) IS NOT NULL
    ORDER BY v.created_at DESC NULLS LAST
    LIMIT 1
  ),
  checker AS (
    SELECT qc.checked_by_id, qc.checked_by
    FROM quality_checks qc
    WHERE qc.test_result_id IN (SELECT id FROM visible)
    ORDER BY qc.created_at DESC NULLS LAST
    LIMIT 1
  )
  SELECT 'encoder', coalesce(u.signatory_name, e.who), u.license_no, u.signature_file
  FROM encoder e
  LEFT JOIN LATERAL (
    SELECT x.signatory_name, x.license_no, x.signature_file FROM users x
    WHERE x.role IN ('member', 'senior_medtech')
      AND (lower(x.full_name) = lower(e.who) OR lower(x.email) = lower(e.who) OR x.id::text = e.who)
    LIMIT 1
  ) u ON true
  UNION ALL
  SELECT 'qc', coalesce(u.signatory_name, c.checked_by), u.license_no, u.signature_file
  FROM checker c
  LEFT JOIN LATERAL (
    SELECT x.signatory_name, x.license_no, x.signature_file FROM users x
    WHERE x.id = c.checked_by_id
       OR (c.checked_by_id IS NULL AND lower(x.full_name) = lower(c.checked_by))
    LIMIT 1
  ) u ON true
$$;

REVOKE ALL ON FUNCTION public.doctor_report_signatories(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.doctor_report_signatories(UUID[]) TO authenticated;
