# Supabase Setup Instructions

## 1. Create Tables in Supabase

Follow these steps to set up your database:

### Option A: Using SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project: `rjqtonewwktqwwrascuh`
3. Navigate to **SQL Editor** on the left sidebar
4. Click **+ New Query**
5. Copy the entire content from `database/schema.sql` file
6. Paste it into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for confirmation that all tables were created

### Option B: Using the Code Below

Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('member', 'faculty')),
  department VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  encryption_key VARCHAR(255) UNIQUE NOT NULL,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PATIENTS TABLE
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  age INT NOT NULL CHECK (age > 0),
  sex VARCHAR(50) NOT NULL,
  municipality VARCHAR(255) NOT NULL,
  province VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  physician_name VARCHAR(255) NOT NULL,
  date_registered DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TEST RESULTS TABLE
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name VARCHAR(255) NOT NULL,
  section VARCHAR(100) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  result_value VARCHAR(255) NOT NULL,
  reference_range VARCHAR(255) NOT NULL,
  unit VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released')),
  date_created DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AUDIT LOGS TABLE
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL,
  encryption_key VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('login', 'logout', 'view', 'edit', 'delete', 'download')),
  resource VARCHAR(500) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR BETTER QUERY PERFORMANCE
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_patients_full_name ON patients(full_name);
CREATE INDEX idx_test_results_patient_name ON test_results(patient_name);
CREATE INDEX idx_test_results_status ON test_results(status);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- INSERT SAMPLE DATA
INSERT INTO users (full_name, email, role, department, status, encryption_key, join_date, last_login)
VALUES
  ('Dr. Maria Santos', 'maria.santos@lis.com', 'faculty', 'Clinical Chemistry', 'active', 'ENC_KEY_001', '2020-03-15', NOW()),
  ('Juan dela Cruz', 'juan.delacruz@lis.com', 'member', 'Hematology', 'active', 'ENC_KEY_002', '2021-06-10', NOW()),
  ('Sarah Johnson', 'sarah.johnson@lis.com', 'member', 'Microbiology', 'active', 'ENC_KEY_003', '2022-01-20', NOW()),
  ('Dr. Robert Lee', 'robert.lee@lis.com', 'member', 'Immunology', 'active', 'ENC_KEY_004', '2021-11-05', NOW()),
  ('Anne Marie Cruz', 'anne.cruz@lis.com', 'member', 'Parasitology', 'active', 'ENC_KEY_005', '2020-09-15', NOW());

INSERT INTO patients (full_name, age, sex, municipality, province, address, physician_name, date_registered)
VALUES
  ('Juan dela Cruz', 45, 'Male', 'Manila', 'NCR', 'Lot 5, Block 2, Makati Ave', 'Dr. Santos', '2024-01-10'),
  ('Maria Santos', 38, 'Female', 'Quezon City', 'NCR', 'Lot 1, Block 1, EDSA', 'Dr. Reyes', '2024-01-12'),
  ('Pedro Gonzales', 52, 'Male', 'Caloocan', 'NCR', 'Blk 10, Lot 5, North Ave', 'Dr. Santos', '2024-01-08');

INSERT INTO test_results (patient_name, section, test_name, result_value, reference_range, unit, status, date_created)
VALUES
  ('Juan dela Cruz', 'CLINICAL CHEMISTRY', 'Random Blood Sugar (Glucose)', '110', '< 140 mg/dL', 'mg/dL', 'pending', '2024-01-15'),
  ('Maria Santos', 'CLINICAL CHEMISTRY', 'Blood Cholesterol', '185', '< 200 mg/dL', 'mg/dL', 'released', '2024-01-14');
```

## 2. Verify Tables Created

After running the SQL:
1. Go to **Table Editor** in Supabase
2. You should see 4 tables:
   - `users` (with sample data)
   - `patients` (with sample data)
   - `test_results` (with sample data)
   - `audit_logs` (empty, will populate with activity)

## 3. Next Steps

Once tables are created, reply with confirmation and I'll:
- Update your frontend pages to fetch from Supabase
- Integrate real-time audit logging
- Connect the User Management and other pages to live data
