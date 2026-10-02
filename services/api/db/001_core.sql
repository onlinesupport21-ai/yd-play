CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active','suspended','banned','deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('user','system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ledger_reason AS ENUM (
    'signup_bonus',
    'referral_reward',
    'mission_reward',
    'achievement_reward',
    'game_entry',
    'game_reward',
    'ad_reward',
    'admin_adjustment',
    'reversal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE,
  phone_e164 TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  age_gate_version TEXT,
  age_gate_accepted_at TIMESTAMPTZ,
  country_code CHAR(2),
  locale TEXT NOT NULL DEFAULT 'en-IN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username CITEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_key TEXT,
  bio TEXT,
  theme TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  app_version TEXT,
  first_seen_ip INET,
  last_seen_ip INET,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_hash)
);
CREATE INDEX IF NOT EXISTS idx_devices_hash ON devices(device_hash);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
ON sessions(user_id, expires_at)
WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  account_code TEXT UNIQUE NOT NULL,
  account_type account_type NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'COIN',
  cached_balance BIGINT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (account_type = 'user' AND user_id IS NOT NULL)
    OR
    (account_type = 'system' AND user_id IS NULL)
  ),
  CHECK (account_type = 'system' OR cached_balance >= 0)
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  reason ledger_reason NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reference_type TEXT,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  delta BIGINT NOT NULL CHECK (delta <> 0),
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account
ON ledger_entries(account_id, created_at DESC);

INSERT INTO wallet_accounts (account_code, account_type, cached_balance)
VALUES
  ('SYSTEM:PROMO', 'system', 0),
  ('SYSTEM:GAME_REWARDS', 'system', 0),
  ('SYSTEM:GAME_SINK', 'system', 0),
  ('SYSTEM:MISSIONS', 'system', 0),
  ('SYSTEM:ADS', 'system', 0)
ON CONFLICT (account_code) DO NOTHING;


-- Ledger rows are append-only. Reversals must be new compensating transactions.
CREATE OR REPLACE FUNCTION deny_ledger_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries are append-only; create a reversal transaction instead';
END;
$$;

DROP TRIGGER IF EXISTS trg_deny_ledger_entry_mutation ON ledger_entries;
CREATE TRIGGER trg_deny_ledger_entry_mutation
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION deny_ledger_entry_mutation();

-- Defense-in-depth: each ledger transaction must balance to zero by commit.
CREATE OR REPLACE FUNCTION enforce_ledger_transaction_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_tx UUID;
  total_delta NUMERIC;
BEGIN
  target_tx := COALESCE(NEW.transaction_id, OLD.transaction_id);
  SELECT COALESCE(SUM(delta), 0)
  INTO total_delta
  FROM ledger_entries
  WHERE transaction_id = target_tx;

  IF total_delta <> 0 THEN
    RAISE EXCEPTION 'Unbalanced ledger transaction %; delta=%', target_tx, total_delta;
  END IF;

  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_ledger_balanced'
  ) THEN
    CREATE CONSTRAINT TRIGGER trg_ledger_balanced
    AFTER INSERT ON ledger_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION enforce_ledger_transaction_balanced();
  END IF;
END $$;
