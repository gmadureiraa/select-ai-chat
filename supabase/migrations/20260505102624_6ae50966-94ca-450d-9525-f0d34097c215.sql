
ALTER TABLE public.viral_search_cache
  ADD COLUMN IF NOT EXISTS query_normalized TEXT,
  ADD COLUMN IF NOT EXISTS filters JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill normalized
UPDATE public.viral_search_cache
SET query_normalized = lower(trim(query))
WHERE query_normalized IS NULL;

CREATE INDEX IF NOT EXISTS idx_viral_search_cache_norm
  ON public.viral_search_cache(client_id, source, query_normalized, created_at DESC);
