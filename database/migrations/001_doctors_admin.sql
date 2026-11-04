-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 001: Predefined doctors per area, Admin + Doctor roles
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow the new roles on users.role ---------------------------------------
--    Existing roles in use: member, faculty, senior_medtech.
--    Drops whatever CHECK constraint currently restricts users.role (its name may vary).
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('member', 'faculty', 'senior_medtech', 'admin', 'doctor'));

-- 2. Predefined doctors, each assigned to an area (municipality + province) ---
CREATE TABLE IF NOT EXISTS doctors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(255) NOT NULL,
  specialization   VARCHAR(255),
  contact_no       VARCHAR(50),
  email            VARCHAR(255) UNIQUE,
  clinic_name      VARCHAR(255),
  area_municipality VARCHAR(255) NOT NULL,
  area_province    VARCHAR(255) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL, -- linked login account (role = 'doctor')
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctors_area   ON doctors (area_province, area_municipality);
CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors (status);
CREATE INDEX IF NOT EXISTS idx_doctors_email  ON doctors (email);

-- 3. Link test requests to a predefined doctor --------------------------------
--    requesting_physician (text) is kept so old requests and reports still work.
ALTER TABLE test_requests ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_test_requests_doctor_id ON test_requests (doctor_id);

-- 4. Make yourself an admin (edit the email, then run) ------------------------
-- UPDATE users SET role = 'admin' WHERE email = 'your.admin@email.com';
