DO $$ BEGIN
  CREATE TYPE referral_status AS ENUM ('pending','review','qualified','rewarded','rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE referral_reward_status AS ENUM ('pending','granted','blocked','reversed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE referral_reward_role AS ENUM ('inviter','invitee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE abuse_flag_status AS ENUM ('open','reviewing','confirmed','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CITEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  inviter_reward BIGINT NOT NULL DEFAULT 250 CHECK (inviter_reward >= 0),
  invitee_reward BIGINT NOT NULL DEFAULT 100 CHECK (invitee_reward >= 0),
  daily_inviter_reward_cap BIGINT CHECK (daily_inviter_reward_cap IS NULL OR daily_inviter_reward_cap >= 0),
  lifetime_inviter_reward_cap BIGINT CHECK (lifetime_inviter_reward_cap IS NULL OR lifetime_inviter_reward_cap >= 0),
  min_account_age_minutes INT NOT NULL DEFAULT 0 CHECK (min_account_age_minutes >= 0),
  max_invites_per_hour INT NOT NULL DEFAULT 10 CHECK (max_invites_per_hour > 0),
  same_device_risk INT NOT NULL DEFAULT 80 CHECK (same_device_risk BETWEEN 0 AND 100),
  same_ip_risk INT NOT NULL DEFAULT 20 CHECK (same_ip_risk BETWEEN 0 AND 100),
  ip_velocity_risk INT NOT NULL DEFAULT 35 CHECK (ip_velocity_risk BETWEEN 0 AND 100),
  device_multi_account_risk INT NOT NULL DEFAULT 60 CHECK (device_multi_account_risk BETWEEN 0 AND 100),
  inviter_velocity_risk INT NOT NULL DEFAULT 40 CHECK (inviter_velocity_risk BETWEEN 0 AND 100),
  review_threshold INT NOT NULL DEFAULT 40 CHECK (review_threshold BETWEEN 0 AND 100),
  block_threshold INT NOT NULL DEFAULT 70 CHECK (block_threshold BETWEEN 0 AND 100),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (review_threshold <= block_threshold)
);

CREATE TABLE IF NOT EXISTS user_referral_codes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  code CITEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, program_id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE RESTRICT,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  invitee_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  referral_code CITEXT NOT NULL,
  attribution_ip INET,
  status referral_status NOT NULL DEFAULT 'pending',
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (inviter_user_id <> invitee_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter_created ON referrals(inviter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status, created_at);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE RESTRICT,
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE RESTRICT,
  beneficiary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role referral_reward_role NOT NULL,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  wallet_transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  status referral_reward_status NOT NULL DEFAULT 'pending',
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_at TIMESTAMPTZ,
  UNIQUE(referral_id, role)
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_beneficiary ON referral_rewards(beneficiary_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_abuse_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  rule_code TEXT NOT NULL,
  risk_points INT NOT NULL CHECK (risk_points BETWEEN 0 AND 100),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status abuse_flag_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(referral_id, rule_code)
);
CREATE INDEX IF NOT EXISTS idx_referral_flags_status ON referral_abuse_flags(status, risk_points DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  request_ip INET,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);

INSERT INTO referral_programs (
  code,
  inviter_reward,
  invitee_reward,
  daily_inviter_reward_cap,
  lifetime_inviter_reward_cap,
  min_account_age_minutes,
  max_invites_per_hour,
  same_device_risk,
  same_ip_risk,
  ip_velocity_risk,
  device_multi_account_risk,
  inviter_velocity_risk,
  review_threshold,
  block_threshold
)
VALUES ('default', 250, 100, 2500, 25000, 0, 10, 80, 20, 35, 60, 40, 40, 70)
ON CONFLICT (code) DO NOTHING;
