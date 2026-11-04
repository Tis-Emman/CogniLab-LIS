-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 006: only Senior MedTechs (and faculty) may move a
-- test result to APPROVED or RELEASED. Run after 005. Safe to re-run.
--
-- Approved = verified in Quality Checking; Released = report printed and
-- handed over. Junior MedTechs can still encode and correct results.
-- The service-role key (server only) is not affected.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_result_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND NEW.status IN ('approved', 'released')
     AND NEW.status IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END)
     AND NOT public.is_senior_staff() THEN
    RAISE EXCEPTION 'Only a Senior MedTech can approve or release test results';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_result_status ON test_results;
CREATE TRIGGER trg_guard_result_status
  BEFORE INSERT OR UPDATE ON test_results
  FOR EACH ROW EXECUTE FUNCTION public.guard_result_status();
