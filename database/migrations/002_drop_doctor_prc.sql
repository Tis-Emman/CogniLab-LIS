-- CogniLab LIS — Migration 002: remove PRC License No. from doctors.
-- PRC license verification is handled by HR, outside the LIS.
-- Run in the Supabase SQL Editor. Safe to re-run.
ALTER TABLE doctors DROP COLUMN IF EXISTS prc_license_no;
