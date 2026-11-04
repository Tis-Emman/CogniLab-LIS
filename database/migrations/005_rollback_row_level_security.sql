-- CogniLab LIS — Undo migration 005 (turns Row Level Security off again).
-- Use only if the app stops working after 005, then tell the developer what broke.
DROP TRIGGER IF EXISTS trg_protect_user_columns ON users;
ALTER TABLE users             DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients          DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_requests     DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_results      DISABLE ROW LEVEL SECURITY;
ALTER TABLE billing           DISABLE ROW LEVEL SECURITY;
ALTER TABLE quality_checks    DISABLE ROW LEVEL SECURITY;
ALTER TABLE specimen_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctors           DISABLE ROW LEVEL SECURITY;
