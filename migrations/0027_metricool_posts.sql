-- 0027_metricool_posts.sql
-- Tabela unificada de posts INDIVIDUAIS puxados da Metricool API por rede.
-- Snapshots agregados por dia ficam em metricool_daily_snapshots (0026).
-- Aqui guardamos o post a post (caption, mídia, métricas atuais).
--
-- Populado por:
--   * cron-metricool-backfill-posts (5h UTC) — refresh diário das últimas 90d
--     pra todas redes mapeadas, incluindo reels/stories IG/FB.
--   * Pode ser chamado manualmente após mapear cliente novo.
--
-- 1 row = (client_id, network, post_id Metricool). UPSERT atualiza métricas
-- a cada execução, com last_synced_at marcando última atualização.

CREATE TABLE IF NOT EXISTS metricool_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  blog_id text NOT NULL,
  network text NOT NULL,                  -- instagram | facebook | twitter | linkedin | tiktok | youtube | threads
  post_id text NOT NULL,                  -- id Metricool (canonical)
  post_type text,                         -- POST | REEL | STORY | CAROUSEL | VIDEO | TWEET
  url text,
  caption text,
  thumbnail_url text,
  media_urls jsonb DEFAULT '[]'::jsonb,   -- array URLs
  published_at timestamptz,

  -- métricas
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  reach integer DEFAULT 0,
  impressions integer DEFAULT 0,
  views integer DEFAULT 0,
  video_views integer DEFAULT 0,
  engagement_rate numeric(6,3),

  -- raw response
  raw_data jsonb,

  -- meta
  first_seen_at timestamptz DEFAULT now(),
  last_synced_at timestamptz DEFAULT now(),

  UNIQUE(client_id, network, post_id)
);

CREATE INDEX IF NOT EXISTS idx_metricool_posts_client_network
  ON metricool_posts(client_id, network, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_metricool_posts_published
  ON metricool_posts(published_at DESC)
  WHERE published_at IS NOT NULL;

COMMENT ON TABLE metricool_posts IS
  'Posts individuais puxados da Metricool API por rede (IG/FB/X/LI/TT/YT/Threads + reels/stories). 1 row por (client_id, network, post_id). Populado por cron-metricool-backfill-posts (5h UTC) com janela de 90d. UPSERT idempotente.';
