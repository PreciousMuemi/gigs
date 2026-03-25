CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(120),
  role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'freelancer', 'both')),
  region VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level VARCHAR(20) DEFAULT 'intermediate',
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(160) NOT NULL,
  description TEXT,
  budget NUMERIC(12,2) NOT NULL CHECK (budget > 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'KES',
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'accepted', 'awaiting_escrow', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'
  )),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_skills (
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES users(id),
  bid_amount NUMERIC(12,2) NOT NULL CHECK (bid_amount > 0),
  cover_note VARCHAR(320),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'accepted', 'rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, freelancer_id)
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID UNIQUE NOT NULL REFERENCES jobs(id),
  client_id UUID NOT NULL REFERENCES users(id),
  freelancer_id UUID NOT NULL REFERENCES users(id),
  agreed_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'KES',
  status VARCHAR(30) NOT NULL DEFAULT 'awaiting_escrow' CHECK (status IN (
    'awaiting_escrow', 'in_progress', 'work_submitted', 'completed', 'released', 'refunded', 'disputed'
  )),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL DEFAULT 'africastalking_mpesa',
  type VARCHAR(20) NOT NULL CHECK (type IN ('fund', 'release', 'refund')),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'KES',
  provider_reference VARCHAR(160),
  idempotency_key VARCHAR(100) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  raw_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment VARCHAR(320),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(contract_id, from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id VARCHAR(100) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  state VARCHAR(60) NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  provider_message_id VARCHAR(120),
  raw_payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(30) NOT NULL,
  actor_id VARCHAR(120),
  action VARCHAR(120) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_escrow_contract ON escrow_transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone ON ussd_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_ussd_sessions_expires_at ON ussd_sessions(expires_at);
