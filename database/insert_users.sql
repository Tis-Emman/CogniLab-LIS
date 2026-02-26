-- Insert users into Supabase database
-- Run this in your Supabase SQL Editor

INSERT INTO users (full_name, email, role, department, status, encryption_key, join_date, last_login)
VALUES
  ('R. Alvaran', '2410685CogniLab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_ALV685', NOW()::date, NOW()),
  ('K. Buenaventura', '2410584CogniLab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_BUE584', NOW()::date, NOW()),
  ('M. Hernandez', '2410390CogniLab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_HER390', NOW()::date, NOW()),
  ('A. Gautane', '2410702CogniLab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_GAU702', NOW()::date, NOW()),
  ('Ron Ron', '2410436CogniLab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_RON436', NOW()::date, NOW()),
  ('R. Suarez', '2410937CogniLab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_SUA937', NOW()::date, NOW()),
  ('Bei Bi Boy', '2410577CogniLab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_BEI577', NOW()::date, NOW()),
  ('Javon', '2410236Cognilab@gmail.com', 'member', 'Laboratory', 'active', 'ENC_KEY_JAV236', NOW()::date, NOW()),
  ('BSMT Lab', 'bsmtCogniLab2026@gmail.com', 'faculty', 'Laboratory', 'active', 'ENC_KEY_BSMT2026', NOW()::date, NOW())
ON CONFLICT (email) 
DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  status = EXCLUDED.status,
  last_login = NOW();
