-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 012: workflow consistency (QA group 4)
-- Run after 011. Safe to re-run. The service role (server / SQL editor) is not
-- affected by the guards.
--
--  F4  A result can be quality-checked once per verification cycle. The QC
--      itself moves the result to APPROVED (pass) or ENCODING (fail) in the
--      same transaction, so two seniors can't check the same result twice.
--  C4  A test request's status is computed from its results; app users can
--      only set it to that computed status, or cancel it (before any result).
--      The status is also recomputed automatically whenever results change.
--  B2  Renaming a patient updates the name on their linked records.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── F4: one QC per verification cycle ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_qc_insert() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st TEXT;
BEGIN
  -- Lock the result so a second, simultaneous QC waits and then sees the new status
  SELECT status INTO st FROM public.test_results WHERE id = NEW.test_result_id FOR UPDATE;
  IF auth.role() = 'authenticated' AND st IS NOT NULL AND st NOT IN ('for_verification', 'pending') THEN
    RAISE EXCEPTION 'This result was already quality-checked (now %). Refresh the page.', upper(st);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_qc_insert ON quality_checks;
CREATE TRIGGER trg_guard_qc_insert BEFORE INSERT ON quality_checks
  FOR EACH ROW EXECUTE FUNCTION public.guard_qc_insert();

CREATE OR REPLACE FUNCTION public.apply_qc_result() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.test_results
     SET status = CASE WHEN NEW.qc_result = 'pass' THEN 'approved' ELSE 'encoding' END
   WHERE id = NEW.test_result_id
     AND status IN ('for_verification', 'pending');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_apply_qc_result ON quality_checks;
CREATE TRIGGER trg_apply_qc_result AFTER INSERT ON quality_checks
  FOR EACH ROW EXECUTE FUNCTION public.apply_qc_result();

-- ── C4: request status is derived from its results ──────────────────────────
CREATE OR REPLACE FUNCTION public.computed_request_status(req_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT status, lower(trim(test_name)) AS tn, upper(section) AS sec
             FROM public.test_results WHERE test_request_id = req_id),
       q AS (SELECT lower(trim(e->>'test_name')) AS tn, upper(e->>'section') AS sec
             FROM public.test_requests tr, jsonb_array_elements(tr.requested_tests::jsonb) e
             WHERE tr.id = req_id)
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM r) THEN 'pending'
    WHEN NOT EXISTS (SELECT 1 FROM r WHERE status <> 'released')
     AND NOT EXISTS (SELECT 1 FROM q WHERE NOT EXISTS (
           SELECT 1 FROM r WHERE r.tn = q.tn OR r.sec = q.sec)) THEN 'completed'
    ELSE 'in_progress'
  END
$$;

CREATE OR REPLACE FUNCTION public.guard_request_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled request cannot be reopened';
  END IF;
  IF NEW.status = 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM public.test_results WHERE test_request_id = OLD.id) THEN
      RAISE EXCEPTION 'This request already has results and cannot be cancelled';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status <> public.computed_request_status(OLD.id) THEN
    RAISE EXCEPTION 'Request status follows its results (expected %)', upper(public.computed_request_status(OLD.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_request_status ON test_requests;
CREATE TRIGGER trg_guard_request_status BEFORE UPDATE OF status ON test_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_status();

CREATE OR REPLACE FUNCTION public.sync_request_from_results() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid UUID;
BEGIN
  FOREACH rid IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.test_request_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.test_request_id END]
  LOOP
    IF rid IS NOT NULL THEN
      UPDATE public.test_requests SET status = public.computed_request_status(rid)
       WHERE id = rid AND status <> 'cancelled' AND status <> public.computed_request_status(rid);
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_sync_request_from_results ON test_results;
CREATE TRIGGER trg_sync_request_from_results AFTER INSERT OR UPDATE OR DELETE ON test_results
  FOR EACH ROW EXECUTE FUNCTION public.sync_request_from_results();

-- ── B2: patient renames reach their linked records ──────────────────────────
CREATE OR REPLACE FUNCTION public.propagate_patient_name() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE full_name TEXT := trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
BEGIN
  IF NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
    UPDATE public.test_requests     SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE public.test_results      SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE public.billing           SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE public.specimen_tracking SET patient_name = full_name WHERE patient_id = NEW.id;
    UPDATE public.quality_checks    SET patient_name = full_name
     WHERE test_result_id IN (SELECT id FROM public.test_results WHERE patient_id = NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_propagate_patient_name ON patients;
CREATE TRIGGER trg_propagate_patient_name AFTER UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION public.propagate_patient_name();
