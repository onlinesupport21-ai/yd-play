DO $$ BEGIN
  CREATE TYPE multiplayer_room_status AS ENUM ('open','countdown','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS multiplayer_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_slug TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('public','private')),
  join_code TEXT UNIQUE,
  status multiplayer_room_status NOT NULL DEFAULT 'open',
  host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  max_players INT NOT NULL DEFAULT 2 CHECK (max_players = 2),
  seed_secret TEXT,
  config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((room_type = 'private' AND join_code IS NOT NULL) OR (room_type = 'public' AND join_code IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_status_time
ON multiplayer_rooms(status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS multiplayer_room_players (
  room_id UUID NOT NULL REFERENCES multiplayer_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_no INT NOT NULL CHECK (seat_no BETWEEN 1 AND 2),
  connected BOOLEAN NOT NULL DEFAULT false,
  score INT NOT NULL DEFAULT 0 CHECK (score >= 0),
  correct_count INT NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  wrong_count INT NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
  last_input_seq INT NOT NULL DEFAULT 0 CHECK (last_input_seq >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id),
  UNIQUE (room_id, seat_no)
);
CREATE INDEX IF NOT EXISTS idx_multiplayer_players_user
ON multiplayer_room_players(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS multiplayer_rounds (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES multiplayer_rooms(id) ON DELETE CASCADE,
  round_no INT NOT NULL CHECK (round_no > 0),
  target_lane INT NOT NULL CHECK (target_lane BETWEEN 0 AND 3),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  announced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_no),
  CHECK (closes_at > opens_at)
);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rounds_schedule
ON multiplayer_rounds(opens_at, closes_at) WHERE announced_at IS NULL;

CREATE TABLE IF NOT EXISTS multiplayer_inputs (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES multiplayer_rooms(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  round_no INT NOT NULL CHECK (round_no > 0),
  seq INT NOT NULL CHECK (seq > 0),
  lane INT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('correct','wrong','invalid_lane')),
  points_awarded INT NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  score_after INT NOT NULL CHECK (score_after >= 0),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id, round_no),
  UNIQUE (room_id, user_id, seq),
  FOREIGN KEY (room_id, round_no) REFERENCES multiplayer_rounds(room_id, round_no)
);
CREATE INDEX IF NOT EXISTS idx_multiplayer_inputs_room
ON multiplayer_inputs(room_id, received_at);

CREATE TABLE IF NOT EXISTS multiplayer_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL UNIQUE REFERENCES multiplayer_rooms(id) ON DELETE RESTRICT,
  result_kind TEXT NOT NULL CHECK (result_kind IN ('win','tie')),
  winner_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  results JSONB NOT NULL,
  validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((result_kind = 'tie' AND winner_user_id IS NULL) OR (result_kind = 'win' AND winner_user_id IS NOT NULL))
);

INSERT INTO games (slug, name, game_type, is_active)
VALUES ('signal-clash', 'Signal Clash', 'multiplayer', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  game_type = EXCLUDED.game_type,
  is_active = true,
  updated_at = now();
