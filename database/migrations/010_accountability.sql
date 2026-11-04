-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 010: accountability (QA group 2)
-- Run after 009. Safe to re-run. The service role (server / SQL editor) is
-- not affected by the guards.
--
--  F1  QC reviewer = the signed-in user (checked_by / checked_by_id are set by
--      the database; a typed name is ignored)
--  F2  A MedTech can't quality-check a result they encoded themselves
--  A3  The system always keeps at least one administrator
--  H1  Inactive doctors can't see any patient data
--  D3  Billing gets or_number and date_paid
-- ─────────────────────────────────────────────────────────────────────────────

-- ── F1 + F2: QC reviewer identity and no self-review ────────────────────────
ALTER TABLE quality_checks ADD COLUMN IF NOT EXISTS checked_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_qc_reviewer() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me RECORD;
  encoder TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;
  SELECT id, full_name INTO me FROM public.users
  WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) LIMIT 1;
  NEW.checked_by    := me.full_name;
  NEW.checked_by_id := me.id;

  SELECT created_by INTO encoder FROM public.test_results WHERE id = NEW.test_result_id;
  IF encoder IS NOT NULL AND lower(trim(encoder)) = lower(trim(me.full_name)) THEN
    RAISE EXCEPTION 'You encoded this result, so another Senior MedTech must quality-check it';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_qc_reviewer ON quality_checks;
CREATE TRIGGER trg_set_qc_reviewer BEFORE INSERT ON quality_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_qc_reviewer();

-- ── A3: never remove the last administrator ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.keep_one_admin() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin'
     AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin' AND id <> OLD.id) THEN
    RAISE EXCEPTION 'The system must keep at least one administrator';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_keep_one_admin ON users;
CREATE TRIGGER trg_keep_one_admin BEFORE UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION public.keep_one_admin();

-- ── H1: only ACTIVE doctors resolve to a doctor id (all doctor policies use it)
CREATE OR REPLACE FUNCTION public.my_doctor_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id FROM public.doctors d
  LEFT JOIN public.users u ON u.id = d.user_id
  WHERE public.app_role() = 'doctor'
    AND d.status = 'active'
    AND (lower(u.email) = lower(auth.jwt() ->> 'email')
         OR lower(d.email) = lower(auth.jwt() ->> 'email'))
  LIMIT 1
$$;

-- ── D3: official receipt details on bills ───────────────────────────────────
ALTER TABLE billing ADD COLUMN IF NOT EXISTS or_number VARCHAR(50);
ALTER TABLE billing ADD COLUMN IF NOT EXISTS date_paid TIMESTAMP;
