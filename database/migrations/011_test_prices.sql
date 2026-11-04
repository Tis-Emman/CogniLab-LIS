-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 011: admin-managed test prices (QA group 3, D4)
-- Run after 010. Safe to re-run.
-- Prices are set in Admin → Test Prices. A test request uses the price here;
-- tests without a price can't be requested until the admin sets one.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS test_prices (
  section    VARCHAR(100) NOT NULL,
  test_name  VARCHAR(255) NOT NULL,
  price      NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  updated_by TEXT,
  updated_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (section, test_name)
);

ALTER TABLE test_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_prices_read ON test_prices;
DROP POLICY IF EXISTS test_prices_admin_write ON test_prices;
CREATE POLICY test_prices_read ON test_prices FOR SELECT TO authenticated
  USING (public.is_lab_staff() OR public.is_admin());
CREATE POLICY test_prices_admin_write ON test_prices FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Specimens created when a bill is paid can now be linked to the request
-- (columns already exist; nothing to add).

-- ── I1: default dates in Philippine time (the database server runs on UTC) ──
ALTER TABLE billing      ALTER COLUMN date_created    SET DEFAULT ((now() AT TIME ZONE 'Asia/Manila')::date);
ALTER TABLE test_results ALTER COLUMN date_created    SET DEFAULT ((now() AT TIME ZONE 'Asia/Manila')::date);
ALTER TABLE patients     ALTER COLUMN date_registered SET DEFAULT ((now() AT TIME ZONE 'Asia/Manila')::date);
