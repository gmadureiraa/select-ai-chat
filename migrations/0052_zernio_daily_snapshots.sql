-- 0052_zernio_daily_snapshots
-- Snapshot diário de métricas vindas do Late/Zernio (analytics + follower-stats).
-- Substitui o legado metricool_daily_snapshots (congelado em 18/05 quando o
-- Metricool saiu). Alimentado pelo cron `cron-snapshot-zernio` e lido pelo
-- handler `historical-snapshots` (hook useHistoricalSnapshots).
--
-- 1 row por (client_id, network, snapshot_date) — UNIQUE garante upsert idempotente
-- mesmo se o cron rodar 2x no dia.

CREATE TABLE IF NOT EXISTS zernio_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  late_profile_id text,
  network text NOT NULL,
  snapshot_date date NOT NULL,
  followers integer,
  posts_count integer NOT NULL DEFAULT 0,
  total_likes integer NOT NULL DEFAULT 0,
  total_comments integer NOT NULL DEFAULT 0,
  total_shares integer NOT NULL DEFAULT 0,
  total_reach integer NOT NULL DEFAULT 0,
  total_impressions integer NOT NULL DEFAULT 0,
  total_views integer NOT NULL DEFAULT 0,
  total_saves integer NOT NULL DEFAULT 0,
  avg_engagement_rate numeric NOT NULL DEFAULT 0,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zernio_daily_snapshots_unique UNIQUE (client_id, network, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_zernio_snap_client_net_date
  ON zernio_daily_snapshots (client_id, network, snapshot_date DESC);
