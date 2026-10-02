DO $$ BEGIN
  CREATE TYPE mission_repeat_type AS ENUM ('one_time','daily','weekly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  target_value BIGINT NOT NULL CHECK (target_value > 0),
  reward_coins BIGINT NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  repeat_type mission_repeat_type NOT NULL DEFAULT 'one_time',
  is_active BOOLEAN NOT NULL DEFAULT true,
  active_from TIMESTAMPTZ,
  active_to TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_missions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  progress BIGINT NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  reward_transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_user_missions_user_updated ON user_missions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  criteria JSONB NOT NULL,
  reward_coins BIGINT NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  reward_transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, unlocked_at DESC);

CREATE TABLE IF NOT EXISTS engagement_event_receipts (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  game_slug TEXT NOT NULL,
  metric TEXT NOT NULL DEFAULT 'best_score',
  period_type TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly','all_time')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  leaderboard_id UUID NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score BIGINT NOT NULL DEFAULT 0,
  games_played BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (leaderboard_id, period_key, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_entries(leaderboard_id, period_key, score DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  platform TEXT,
  app_version TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON analytics_events(user_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  campaign_id UUID REFERENCES push_campaigns(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON in_app_notifications(user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  token_ciphertext TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_tag TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  app_version TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id, enabled);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES push_campaigns(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES push_devices(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','skipped')),
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_campaign ON push_deliveries(campaign_id, status);

INSERT INTO missions (code,title,description,trigger_type,target_value,reward_coins,repeat_type,metadata)
VALUES
  ('first-pulse','First Pulse','Finish one validated Pulse Grid session.','pulse_grid_completed',1,25,'one_time','{"icon":"bolt"}'),
  ('daily-3-pulse','Daily Practice','Finish 3 validated Pulse Grid sessions today.','pulse_grid_completed',3,40,'daily','{"icon":"calendar"}'),
  ('daily-score-1000','Break 1,000','Reach at least 1,000 points in a validated Pulse Grid session today.','pulse_grid_score_1000',1,50,'daily','{"icon":"score"}')
ON CONFLICT (code) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, trigger_type=EXCLUDED.trigger_type,
  target_value=EXCLUDED.target_value, reward_coins=EXCLUDED.reward_coins, repeat_type=EXCLUDED.repeat_type,
  metadata=EXCLUDED.metadata, updated_at=now();

INSERT INTO achievements (code,title,description,criteria,reward_coins)
VALUES
  ('first-game','First Game','Complete your first validated Pulse Grid session.','{"event":"pulse_grid_completed","threshold":1}',20),
  ('score-1500','Signal Sharp','Score 1,500 or more in a validated Pulse Grid session.','{"event":"pulse_grid_score","threshold":1500}',50),
  ('combo-10','Combo Ten','Reach a combo of 10 or more in a validated Pulse Grid session.','{"event":"pulse_grid_max_combo","threshold":10}',30)
ON CONFLICT (code) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, criteria=EXCLUDED.criteria,
  reward_coins=EXCLUDED.reward_coins, updated_at=now();

INSERT INTO leaderboards (code,title,game_slug,metric,period_type)
VALUES
  ('pulse-daily','Pulse Grid — Today','pulse-grid','best_score','daily'),
  ('pulse-weekly','Pulse Grid — This Week','pulse-grid','best_score','weekly'),
  ('pulse-all-time','Pulse Grid — All Time','pulse-grid','best_score','all_time')
ON CONFLICT (code) DO UPDATE SET title=EXCLUDED.title, metric=EXCLUDED.metric, is_active=true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_in_app_campaign_user
ON in_app_notifications(campaign_id,user_id)
WHERE campaign_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_push_delivery_campaign_device
ON push_deliveries(campaign_id,device_id)
WHERE campaign_id IS NOT NULL AND device_id IS NOT NULL;
