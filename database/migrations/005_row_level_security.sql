-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 005: Row Level Security (who can read/write what)
--
-- Run AFTER 001–004. Run once in the Supabase SQL Editor. Safe to re-run.
-- If anything breaks, run 005_rollback_row_level_security.sql to turn it off.
--
-- Access model
--   Lab staff (member, senior_medtech, faculty): full access to lab data.
--     Quality checks can only be written by senior_medtech / faculty.
--   Admin: manages users, doctors and audit logs; can READ lab data for the
--     overview, but cannot create or change lab records (separation of duties).
--   Doctor: reads only their own doctor profile, their own test requests,
--     those patients, and RELEASED results for them. Nothing else.
--   Not signed in: nothing.
-- The server route that creates doctor logins uses the service-role key,
-- which bypasses RLS by design.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper functions (SECURITY DEFINER so they can read users/doctors safely) ─
CREATE OR REPLACE FUNCTION public.app_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users
  WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_lab_staff() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() IN ('member', 'senior_medtech', 'faculty'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_senior_staff() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() IN ('senior_medtech', 'faculty'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() = 'admin', false)
$$;

CREATE OR REPLACE FUNCTION public.my_doctor_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id FROM public.doctors d
  LEFT JOIN public.users u ON u.id = d.user_id
  WHERE public.app_role() = 'doctor'
    AND (lower(u.email) = lower(auth.jwt() ->> 'email')
         OR lower(d.email) = lower(auth.jwt() ->> 'email'))
  LIMIT 1
$$;

-- Test requests visible to the signed-in doctor (linked by doctor_id, or older
-- requests typed with exactly the doctor's name)
CREATE OR REPLACE FUNCTION public.doctor_request_ids() RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tr.id FROM public.test_requests tr
  JOIN public.doctors d ON d.id = public.my_doctor_id()
  WHERE tr.doctor_id = d.id
     OR (tr.doctor_id IS NULL AND lower(trim(tr.requesting_physician)) = lower(trim(d.full_name)))
$$;

CREATE OR REPLACE FUNCTION public.doctor_patient_ids() RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT patient_id FROM public.test_requests
  WHERE id IN (SELECT public.doctor_request_ids()) AND patient_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.doctor_patient_names() RETURNS SETOF TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT patient_name FROM public.test_requests
  WHERE id IN (SELECT public.doctor_request_ids())
$$;

-- ── Turn RLS on ──────────────────────────────────────────────────────────────
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE specimen_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors           ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy on these tables so re-running starts clean
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users','patients','test_requests','test_results','billing',
                        'quality_checks','specimen_tracking','audit_logs','doctors')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── users ────────────────────────────────────────────────────────────────────
CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING (public.is_lab_staff() OR public.is_admin()
         OR lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY users_update_own_or_admin ON users FOR UPDATE TO authenticated
  USING (public.is_admin() OR lower(email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (public.is_admin() OR lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY users_insert_admin ON users FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY users_delete_admin ON users FOR DELETE TO authenticated USING (public.is_admin());

-- Non-admins may edit their own profile, but not their role, email or signatory details
CREATE OR REPLACE FUNCTION public.protect_user_columns() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.signatory_name IS DISTINCT FROM OLD.signatory_name
       OR NEW.license_no IS DISTINCT FROM OLD.license_no
       OR NEW.signature_file IS DISTINCT FROM OLD.signature_file THEN
      RAISE EXCEPTION 'Only administrators can change role, email or signatory details';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_user_columns ON users;
CREATE TRIGGER trg_protect_user_columns BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_columns();

-- ── patients ─────────────────────────────────────────────────────────────────
CREATE POLICY patients_staff_all ON patients FOR ALL TO authenticated
  USING (public.is_lab_staff()) WITH CHECK (public.is_lab_staff());
CREATE POLICY patients_admin_read ON patients FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY patients_doctor_read ON patients FOR SELECT TO authenticated
  USING (id IN (SELECT public.doctor_patient_ids()));

-- ── test_requests ────────────────────────────────────────────────────────────
CREATE POLICY requests_staff_all ON test_requests FOR ALL TO authenticated
  USING (public.is_lab_staff()) WITH CHECK (public.is_lab_staff());
CREATE POLICY requests_admin_read ON test_requests FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY requests_doctor_read ON test_requests FOR SELECT TO authenticated
  USING (id IN (SELECT public.doctor_request_ids()));

-- ── test_results (doctors see RELEASED results only) ─────────────────────────
CREATE POLICY results_staff_all ON test_results FOR ALL TO authenticated
  USING (public.is_lab_staff()) WITH CHECK (public.is_lab_staff());
CREATE POLICY results_admin_read ON test_results FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY results_doctor_read ON test_results FOR SELECT TO authenticated
  USING (status = 'released' AND (
           test_request_id IN (SELECT public.doctor_request_ids())
        OR patient_id IN (SELECT public.doctor_patient_ids())
        OR (patient_id IS NULL AND patient_name IN (SELECT public.doctor_patient_names()))));

-- ── billing, specimen tracking: lab staff; admin read-only ───────────────────
CREATE POLICY billing_staff_all ON billing FOR ALL TO authenticated
  USING (public.is_lab_staff()) WITH CHECK (public.is_lab_staff());
CREATE POLICY billing_admin_read ON billing FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY specimen_staff_all ON specimen_tracking FOR ALL TO authenticated
  USING (public.is_lab_staff()) WITH CHECK (public.is_lab_staff());
CREATE POLICY specimen_admin_read ON specimen_tracking FOR SELECT TO authenticated USING (public.is_admin());

-- ── quality_checks: everyone on staff reads; only seniors write ──────────────
CREATE POLICY qc_staff_read ON quality_checks FOR SELECT TO authenticated
  USING (public.is_lab_staff() OR public.is_admin());
CREATE POLICY qc_senior_insert ON quality_checks FOR INSERT TO authenticated WITH CHECK (public.is_senior_staff());
CREATE POLICY qc_senior_update ON quality_checks FOR UPDATE TO authenticated
  USING (public.is_senior_staff()) WITH CHECK (public.is_senior_staff());
CREATE POLICY qc_senior_delete ON quality_checks FOR DELETE TO authenticated USING (public.is_senior_staff());

-- ── audit_logs: anyone signed in can add; staff/admin read; nobody edits ─────
CREATE POLICY audit_insert ON audit_logs FOR INSERT TO authenticated WITH CHECK (public.app_role() IS NOT NULL);
CREATE POLICY audit_read ON audit_logs FOR SELECT TO authenticated
  USING (public.is_lab_staff() OR public.is_admin());

-- ── doctors ──────────────────────────────────────────────────────────────────
CREATE POLICY doctors_admin_all ON doctors FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY doctors_staff_read ON doctors FOR SELECT TO authenticated USING (public.is_lab_staff());
CREATE POLICY doctors_self_read ON doctors FOR SELECT TO authenticated USING (id = public.my_doctor_id());
