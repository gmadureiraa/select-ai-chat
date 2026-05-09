-- 0026_metricool_daily_snapshots.sql
-- Snapshots históricos diários de métricas Metricool — pra ter série temporal
-- DESDE HOJE em diante (Metricool API só retorna 30-90d).
--
-- 1 row = (cliente, rede, dia). Cron diário (`cron-metricool-snapshot`) às 6h
-- agrega posts/reels/stories do dia anterior + followers atual e UPSERT aqui.
-- Idempotente: pode rodar várias vezes ao dia sem duplicar.

CREATE TABLE IF NOT EXISTS metricool_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  blog_id text NOT NULL,
  network text NOT NULL,
  snapshot_date date NOT NULL,
  followers integer,
  posts_count integer DEFAULT 0,
  total_likes integer DEFAULT 0,
  total_comments integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  total_reach integer DEFAULT 0,
  total_impressions integer DEFAULT 0,
  total_views integer DEFAULT 0,
  total_saves integer DEFAULT 0,
  avg_engagement_rate numeric(6,3),
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, network, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_client_network_date
  ON metricool_daily_snapshots(client_id, network, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_blog_id_date
  ON metricool_daily_snapshots(blog_id, snapshot_date DESC);

COMMENT ON TABLE metricool_daily_snapshots IS
  'Snapshots históricos diários de métricas Metricool. 1 row por (client_id, network, snapshot_date). Populado por cron-metricool-snapshot 1x/dia (06:00 UTC). Override Metricool API (que só dá 30-90d).';
