-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 013: remove the Faculty role. Run after 012.
-- Safe to re-run.
--
-- Any existing faculty account becomes a Senior MedTech, which keeps exactly
-- the access it had (faculty and senior_medtech had the same permissions).
-- Then 'faculty' is no longer allowed on users.role, and the RLS helpers
-- stop checking for it.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.users SET role = 'senior_medtech' WHERE role = 'faculty';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('member', 'senior_medtech', 'admin', 'doctor'));

CREATE OR REPLACE FUNCTION public.is_lab_staff() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() IN ('member', 'senior_medtech'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_senior_staff() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.app_role() = 'senior_medtech', false)
$$;
