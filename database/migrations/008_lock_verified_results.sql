-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 008: editing rules for test results
-- Run after 006. Safe to re-run. The service-role key is not affected.
--
--  • RELEASED results are locked. Only a Senior MedTech may re-open one
--    (Amend: released -> for_verification) and its values can't change in
--    the same step.
--  • Changing the values of an APPROVED result sends it back to
--    for_verification automatically (it must be re-verified).
--  • A result can't be moved to another patient once linked.
--  • APPROVED and RELEASED results can't be deleted.
--  • New column correction_note: the encoder's "what did you correct?" note.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE test_results ADD COLUMN IF NOT EXISTS correction_note TEXT;

CREATE OR REPLACE FUNCTION public.guard_result_edits() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  values_changed BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN COALESCE(NEW, OLD);  -- server / SQL editor
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('approved', 'released') THEN
      RAISE EXCEPTION 'Approved or released results cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  values_changed := NEW.result_value    IS DISTINCT FROM OLD.result_value
                 OR NEW.reference_range IS DISTINCT FROM OLD.reference_range
                 OR NEW.unit            IS DISTINCT FROM OLD.unit
                 OR NEW.test_name       IS DISTINCT FROM OLD.test_name;

  -- Never move a linked result to another patient
  IF OLD.patient_id IS NOT NULL AND NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
    RAISE EXCEPTION 'A result cannot be moved to another patient';
  END IF;

  IF OLD.status = 'released' THEN
    IF values_changed THEN
      RAISE EXCEPTION 'Released results are locked. A Senior MedTech must amend it first';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_senior_staff() THEN
      RAISE EXCEPTION 'Only a Senior MedTech can amend a released result';
    END IF;
  END IF;

  -- Edited after verification: needs to be verified again
  IF OLD.status = 'approved' AND values_changed AND NEW.status = 'approved' THEN
    NEW.status := 'for_verification';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_result_edits ON test_results;
CREATE TRIGGER trg_guard_result_edits
  BEFORE UPDATE OR DELETE ON test_results
  FOR EACH ROW EXECUTE FUNCTION public.guard_result_edits();
