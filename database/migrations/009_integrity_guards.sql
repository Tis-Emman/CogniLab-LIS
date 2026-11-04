-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 009: data-integrity guards (QA group 1)
-- Run after 008. Safe to re-run. Server / SQL editor (service role) bypasses
-- the guards; they apply to signed-in app users.
--
--  G1  test_results.created_by: who actually encoded the result (auto-filled)
--  H4  updated_at kept current on results, requests and billing
--  E1  one result per test per request (no duplicate encoding)
--  B1  a patient with requests, results or bills can't be deleted
--  D1  a paid bill can't be marked unpaid once its results are approved/released
--  D2  a paid bill can't be deleted
--  F3  QC of a released result can't be deleted; deleting the last PASS of an
--      approved result sends it back to for_verification
-- ─────────────────────────────────────────────────────────────────────────────

-- ── G1: encoder ──────────────────────────────────────────────────────────────
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE OR REPLACE FUNCTION public.set_result_encoder() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL OR NEW.created_by = '' THEN
    SELECT full_name INTO NEW.created_by FROM public.users
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_result_encoder ON test_results;
CREATE TRIGGER trg_set_result_encoder BEFORE INSERT ON test_results
  FOR EACH ROW EXECUTE FUNCTION public.set_result_encoder();

-- ── H4: updated_at ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_touch_results  ON test_results;
DROP TRIGGER IF EXISTS trg_touch_requests ON test_requests;
DROP TRIGGER IF EXISTS trg_touch_billing  ON billing;
CREATE TRIGGER trg_touch_results  BEFORE UPDATE ON test_results  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_requests BEFORE UPDATE ON test_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_billing  BEFORE UPDATE ON billing       FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── E1: no duplicate result for the same test on the same request ───────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_result_per_request_test
  ON test_results (test_request_id, lower(test_name))
  WHERE test_request_id IS NOT NULL;

-- ── B1: patients with records can't be deleted ──────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_patient_delete() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
       EXISTS (SELECT 1 FROM test_requests WHERE patient_id = OLD.id)
    OR EXISTS (SELECT 1 FROM test_results  WHERE patient_id = OLD.id)
    OR EXISTS (SELECT 1 FROM billing       WHERE patient_id = OLD.id)) THEN
    RAISE EXCEPTION 'This patient has test requests, results or bills and cannot be deleted';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_guard_patient_delete ON patients;
CREATE TRIGGER trg_guard_patient_delete BEFORE DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION public.guard_patient_delete();

-- ── D1 + D2: billing guards ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_billing() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'paid' THEN
      RAISE EXCEPTION 'Paid bills cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'paid' AND NEW.status = 'unpaid' AND EXISTS (
       SELECT 1 FROM test_results r
       WHERE r.status IN ('approved', 'released')
         AND upper(r.section) = upper(OLD.section)
         AND ((OLD.test_request_id IS NOT NULL AND r.test_request_id = OLD.test_request_id)
              OR (OLD.test_request_id IS NULL AND OLD.patient_id IS NOT NULL AND r.patient_id = OLD.patient_id))) THEN
    RAISE EXCEPTION 'This bill covers results that are already approved or released; it cannot be marked unpaid';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_billing ON billing;
CREATE TRIGGER trg_guard_billing BEFORE UPDATE OR DELETE ON billing
  FOR EACH ROW EXECUTE FUNCTION public.guard_billing();

-- ── F3: QC deletion ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_qc_delete() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated' AND EXISTS (
       SELECT 1 FROM test_results WHERE id = OLD.test_result_id AND status = 'released') THEN
    RAISE EXCEPTION 'The QC record of a released result cannot be deleted';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_guard_qc_delete ON quality_checks;
CREATE TRIGGER trg_guard_qc_delete BEFORE DELETE ON quality_checks
  FOR EACH ROW EXECUTE FUNCTION public.guard_qc_delete();

CREATE OR REPLACE FUNCTION public.requeue_after_qc_delete() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE test_results SET status = 'for_verification'
  WHERE id = OLD.test_result_id
    AND status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM quality_checks q
                    WHERE q.test_result_id = OLD.test_result_id AND q.qc_result = 'pass');
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_requeue_after_qc_delete ON quality_checks;
CREATE TRIGGER trg_requeue_after_qc_delete AFTER DELETE ON quality_checks
  FOR EACH ROW EXECUTE FUNCTION public.requeue_after_qc_delete();
