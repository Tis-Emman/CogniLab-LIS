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
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id_no VARCHAR(50) UNIQUE NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  age INT NOT NULL CHECK (age > 0),
  birthdate DATE NOT NULL,
  sex VARCHAR(50) NOT NULL,
  contact_no VARCHAR(20) NOT NULL,
  address_house_no VARCHAR(255),
  address_street VARCHAR(255),
  address_barangay VARCHAR(255) NOT NULL,
  municipality VARCHAR(255) NOT NULL,
  province VARCHAR(255) NOT NULL,
  medical_history TEXT NOT NULL,
  medications TEXT NOT NULL,
  allergy TEXT NOT NULL,
  demographics_complete BOOLEAN DEFAULT FALSE,
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
CREATE INDEX idx_patients_patient_id ON patients(patient_id_no);
CREATE INDEX idx_patients_last_name ON patients(last_name);
CREATE INDEX idx_patients_demographics_complete ON patients(demographics_complete);
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

INSERT INTO patients (patient_id_no, last_name, first_name, middle_name, age, birthdate, sex, contact_no, address_house_no, address_street, address_barangay, municipality, province, medical_history, medications, allergy, demographics_complete, date_registered)
VALUES
  ('PAT001', 'dela Cruz', 'Juan', 'Garcia', 45, '1979-03-15', 'Male', '09171234567', 'Lot 5', 'Makati Ave', 'Bel-Air', 'Makati', 'NCR', 'Hypertension', 'Metoprolol 50mg daily', 'Penicillin', TRUE, '2024-01-10'),
  ('PAT002', 'Santos', 'Maria', 'Lopez', 38, '1986-07-22', 'Female', '09187654321', 'Lot 1', 'EDSA', 'Diliman', 'Quezon City', 'NCR', 'Type 2 Diabetes', 'Metformin 1000mg daily', 'None', TRUE, '2024-01-12'),
  ('PAT003', 'Gonzales', 'Pedro', 'Martinez', 52, '1972-11-08', 'Male', '09169876543', 'Blk 10', 'North Ave', 'Bagong Barrio', 'Caloocan', 'NCR', 'COPD', 'Salbutamol inhaler as needed', 'Aspirin', TRUE, '2024-01-08');

INSERT INTO test_results (patient_name, section, test_name, result_value, reference_range, unit, status, date_created)
VALUES
  ('Juan dela Cruz', 'CLINICAL CHEMISTRY', 'Random Blood Sugar (Glucose)', '110', '< 140 mg/dL', 'mg/dL', 'pending', '2024-01-15'),
  ('Maria Santos', 'CLINICAL CHEMISTRY', 'Blood Cholesterol', '185', '< 200 mg/dL', 'mg/dL', 'released', '2024-01-14');