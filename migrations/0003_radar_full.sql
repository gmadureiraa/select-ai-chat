-- Migration 0003: Radar Viral cron tables
-- Tables that store globally-scraped signals (news + tiktok) and tracked sources.
-- Briefs/IG already exist (viral_radar_briefs / instagram_posts).
--
-- Idempotente: usa IF NOT EXISTS em tudo.

-- ─── viral_tracked_sources ────────────────────────────────────────────
-- Lista de fontes a serem monitoradas pelos crons.
-- Pode ser global (workspace_id/client_id NULL) ou por client.
CREATE TABLE IF NOT EXISTS public.viral_tracked_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('rss','instagram','tiktok','youtube','twitter','newsletter')),
  source_url text NOT NULL,
  source_name text,
  category text,
  niche text,
  is_active boolean DEFAULT true,
  last_scraped_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viral_tracked_sources_type_active
  ON public.viral_tracked_sources(source_type, is_active);
CREATE INDEX IF NOT EXISTS idx_viral_tracked_sources_client
  ON public.viral_tracked_sources(client_id);
CREATE INDEX IF NOT EXISTS idx_viral_tracked_sources_workspace
  ON public.viral_tracked_sources(workspace_id);

-- ─── viral_news_articles ──────────────────────────────────────────────
-- Artigos RSS scrapeados (globais, lidos por qualquer client/workspace).
CREATE TABLE IF NOT EXISTS public.viral_news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.viral_tracked_sources(id) ON DELETE SET NULL,
  source_name text,
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  summary text,
  category text,
  niche text,
  thumbnail_url text,
  language text,
  published_at timestamp with time zone,
  scraped_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_news_published
  ON public.viral_news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category
  ON public.viral_news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_niche
  ON public.viral_news_articles(niche);

-- ─── viral_tiktok_posts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.viral_tiktok_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcode text UNIQUE,
  url text NOT NULL,
  author text,
  caption text,
  views bigint,
  likes integer,
  comments integer,
  shares integer,
  niche text,
  hashtags jsonb DEFAULT '[]'::jsonb,
  posted_at timestamp with time zone,
  scraped_at timestamp with time zone DEFAULT now(),
  thumbnail_url text,
  video_url text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tiktok_views
  ON public.viral_tiktok_posts(views DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_posted
  ON public.viral_tiktok_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_author
  ON public.viral_tiktok_posts(author);
CREATE INDEX IF NOT EXISTS idx_tiktok_niche
  ON public.viral_tiktok_posts(niche);

-- ─── RLS (read-all, write via service-role only) ──────────────────────
ALTER TABLE public.viral_tracked_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_tiktok_posts ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS pra rerodar migração sem erro
DROP POLICY IF EXISTS "viral_tracked_sources read all" ON public.viral_tracked_sources;
DROP POLICY IF EXISTS "viral_news_articles read all" ON public.viral_news_articles;
DROP POLICY IF EXISTS "viral_tiktok_posts read all" ON public.viral_tiktok_posts;

CREATE POLICY "viral_tracked_sources read all"
  ON public.viral_tracked_sources FOR SELECT USING (true);
CREATE POLICY "viral_news_articles read all"
  ON public.viral_news_articles FOR SELECT USING (true);
CREATE POLICY "viral_tiktok_posts read all"
  ON public.viral_tiktok_posts FOR SELECT USING (true);
