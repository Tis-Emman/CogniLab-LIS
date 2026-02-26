-- Update test_results table to support 5-stage workflow
ALTER TABLE test_results 
DROP CONSTRAINT IF EXISTS test_results_status_check;

ALTER TABLE test_results
ADD CONSTRAINT test_results_status_check 
CHECK (status IN ('pending', 'encoding', 'for_verification', 'approved', 'released'));

-- Update default status to pending
ALTER TABLE test_results 
ALTER COLUMN status SET DEFAULT 'pending';

-- Create billing table if it doesn't exist
CREATE TABLE IF NOT EXISTS billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name VARCHAR(255) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  section VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  description TEXT,
  date_created DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for billing table
CREATE INDEX IF NOT EXISTS idx_billing_patient_name ON billing(patient_name);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing(status);
CREATE INDEX IF NOT EXISTS idx_billing_date_created ON billing(date_created);

-- Update existing test_results records - change 'released' status to stay as is
UPDATE test_results SET status = 'pending' WHERE status IS NULL;

-- Ensure audit_logs table exists
CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
