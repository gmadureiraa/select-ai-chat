-- Migration 0014: Per-client Radar performance indexes
-- Phase E (Radar per-client) — speeds up the per-client scraping loop
-- and brief generation pipeline.
--
-- Adds 4 partial/composite indexes:
--   1. Client-scoped active sources lookup (cron-scrape-* loop)
--   2. Global active sources lookup (default scrapers, no client)
--   3. News articles by source (per-client filter)
--   4. Briefs by client+date (idempotency check + recent fetch)
--
-- Idempotente: usa IF NOT EXISTS em tudo.

-- 1. Index pra lookup rápido de fontes do cliente (cron loop principal)
CREATE INDEX IF NOT EXISTS idx_viral_tracked_sources_client_active
  ON public.viral_tracked_sources (client_id, is_active)
  WHERE is_active = true;

-- 2. Index pra lookup de fontes globais (sem client_id setado)
CREATE INDEX IF NOT EXISTS idx_viral_tracked_sources_global_active
  ON public.viral_tracked_sources (is_active, source_type)
  WHERE client_id IS NULL AND is_active = true;

-- 3. News per-client lookup (já tem source_id mas confirma com ordering desc)
CREATE INDEX IF NOT EXISTS idx_viral_news_articles_client_lookup
  ON public.viral_news_articles (source_id, published_at DESC);

-- 4. Briefs per-client recent lookup
CREATE INDEX IF NOT EXISTS idx_viral_radar_briefs_client_recent
  ON public.viral_radar_briefs (client_id, created_at DESC);
