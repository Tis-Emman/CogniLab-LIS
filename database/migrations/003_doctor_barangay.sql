-- CogniLab LIS — Migration 003: doctors are assigned to a barangay of Baliwag City.
-- The service area is Baliwag City, Bulacan only; city and province are fixed.
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS area_barangay VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_doctors_barangay ON doctors (area_barangay);

-- Put every existing doctor in the fixed service area.
-- Their barangay stays empty until an admin edits them.
UPDATE doctors SET area_municipality = 'Baliwag City', area_province = 'Bulacan';
