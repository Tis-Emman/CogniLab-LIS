-- ─────────────────────────────────────────────────────────────────────────────
-- CogniLab LIS — Migration 007: merge duplicate users rows + lowercase emails
--
-- Some people had two rows in `users` whose emails differed only by capital
-- letters (e.g. "...CogniLab@..." and "...cognilab@..."). Logins matched one or
-- the other at random, which caused failed logins, logouts after switching tabs,
-- and MedTechs showing as "2410584cognilab" instead of their real name.
--
-- For each duplicate group this keeps the row whose id is the actual login
-- (auth.users), copies the real name and signatory details onto it, moves
-- references over, deletes the extra row, and renames old records that were
-- saved under the placeholder name. Then every email is stored in lowercase.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TEMP TABLE user_merge ON COMMIT DROP AS
WITH grp AS (
  SELECT lower(trim(email)) AS e FROM users GROUP BY 1 HAVING count(*) > 1
),
ranked AS (
  SELECT u.*, lower(trim(u.email)) AS e,
         row_number() OVER (
           PARTITION BY lower(trim(u.email))
           ORDER BY (u.id IN (SELECT id FROM auth.users)) DESC,  -- the real login first
                    (u.signatory_name IS NOT NULL) DESC,
                    u.created_at
         ) AS rn
  FROM users u JOIN grp ON grp.e = lower(trim(u.email))
)
SELECT k.id AS keep_id, k.full_name AS keep_name,
       d.id AS drop_id, d.full_name AS drop_name,
       d.signatory_name, d.license_no, d.signature_file
FROM ranked k JOIN ranked d ON d.e = k.e AND k.rn = 1 AND d.rn > 1;

-- Real name: replace placeholder names (no space, e.g. "2410584cognilab")
UPDATE users u SET full_name = m.drop_name
FROM user_merge m
WHERE u.id = m.keep_id AND position(' ' IN u.full_name) = 0 AND position(' ' IN m.drop_name) > 0;

-- Signatory details the kept row is missing
UPDATE users u SET
  signatory_name = coalesce(u.signatory_name, m.signatory_name),
  license_no     = coalesce(u.license_no, m.license_no),
  signature_file = coalesce(u.signature_file, m.signature_file)
FROM user_merge m WHERE u.id = m.keep_id;

-- Records saved under the placeholder name now show the real name
UPDATE test_requests  t SET created_by = u.full_name
FROM user_merge m JOIN users u ON u.id = m.keep_id
WHERE t.created_by = m.keep_name AND m.keep_name <> u.full_name;
UPDATE quality_checks q SET checked_by = u.full_name
FROM user_merge m JOIN users u ON u.id = m.keep_id
WHERE q.checked_by = m.keep_name AND m.keep_name <> u.full_name;

-- Move references to the kept row, then remove the duplicates
UPDATE audit_logs a SET user_id = m.keep_id FROM user_merge m WHERE a.user_id = m.drop_id;
UPDATE doctors    d SET user_id = m.keep_id FROM user_merge m WHERE d.user_id = m.drop_id;
DELETE FROM users u USING user_merge m WHERE u.id = m.drop_id;

-- Store every email in lowercase and stop case-duplicates from coming back
UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

COMMIT;

-- Check: should return no rows
-- SELECT lower(email), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;
