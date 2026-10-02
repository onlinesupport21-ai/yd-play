DO $$ BEGIN
  CREATE TYPE game_session_status AS ENUM ('active','completed','invalidated','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('single_player','multiplayer')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  version INT NOT NULL CHECK (version > 0),
  config JSONB NOT NULL,
  checksum TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_game_config
ON game_configs(game_id)
WHERE is_active = true;

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status game_session_status NOT NULL DEFAULT 'active',
  seed_secret TEXT NOT NULL,
  schedule_hash TEXT NOT NULL,
  config_snapshot JSONB NOT NULL,
  last_input_seq INT NOT NULL DEFAULT 0 CHECK (last_input_seq >= 0),
  server_score INT NOT NULL DEFAULT 0 CHECK (server_score >= 0),
  hits INT NOT NULL DEFAULT 0 CHECK (hits >= 0),
  misses INT NOT NULL DEFAULT 0 CHECK (misses >= 0),
  max_combo INT NOT NULL DEFAULT 0 CHECK (max_combo >= 0),
  anti_cheat JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_created
ON game_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_active
ON game_sessions(user_id, status)
WHERE status = 'active';

CREATE TABLE IF NOT EXISTS game_inputs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE RESTRICT,
  seq INT NOT NULL CHECK (seq > 0),
  elapsed_ms INT NOT NULL CHECK (elapsed_ms >= 0),
  lane INT NOT NULL CHECK (lane BETWEEN 0 AND 3),
  outcome TEXT NOT NULL CHECK (outcome IN ('hit','miss','rejected_speed')),
  target_index INT,
  score_after INT NOT NULL CHECK (score_after >= 0),
  combo_after INT NOT NULL CHECK (combo_after >= 0),
  replay_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_game_inputs_session
ON game_inputs(session_id, seq);

CREATE TABLE IF NOT EXISTS game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES game_sessions(id) ON DELETE RESTRICT,
  validated BOOLEAN NOT NULL,
  validation_version TEXT NOT NULL,
  server_score INT NOT NULL CHECK (server_score >= 0),
  claimed_score INT CHECK (claimed_score IS NULL OR claimed_score >= 0),
  hits INT NOT NULL DEFAULT 0 CHECK (hits >= 0),
  misses INT NOT NULL DEFAULT 0 CHECK (misses >= 0),
  max_combo INT NOT NULL DEFAULT 0 CHECK (max_combo >= 0),
  accuracy NUMERIC(8,6) NOT NULL DEFAULT 0 CHECK (accuracy BETWEEN 0 AND 1),
  reward_coins INT NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  reward_status TEXT NOT NULL CHECK (reward_status IN ('none','pending','granted')),
  reward_transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  replay_hash TEXT NOT NULL,
  anti_cheat JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO games (slug, name, game_type, is_active)
VALUES ('pulse-grid', 'Pulse Grid', 'single_player', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = true,
  updated_at = now();

INSERT INTO game_configs (game_id, version, config, checksum, is_active)
SELECT
  g.id,
  1,
  '{
    "durationMs": 45000,
    "lanes": 4,
    "firstTargetMs": 1000,
    "targetIntervalMs": 700,
    "hitWindowMs": 230,
    "minInputIntervalMs": 45,
    "maxFutureSkewMs": 350,
    "maxLateInputMs": 5000,
    "rewardScoreStep": 750,
    "rewardCoinsPerStep": 5,
    "rewardCapCoins": 100
  }'::jsonb,
  'pulse-grid-v1-2026-09-30',
  true
FROM games g
WHERE g.slug = 'pulse-grid'
ON CONFLICT (game_id, version) DO NOTHING;
