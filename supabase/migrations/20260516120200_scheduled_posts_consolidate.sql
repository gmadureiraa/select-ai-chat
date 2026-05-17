-- 0043: Consolidate scheduled_posts schema (duas migrations criaram tabela com schemas distintos)
--
-- Bug: CREATE TABLE public.scheduled_posts apareceu DUAS vezes:
--   - 20251203122347 → user-based (user_id, content, platforms[], image_url)
--   - 20251224205833 → workspace+client-based (workspace_id, client_id, title, content_type, platform,
--                       external_post_id, retry_count, media_urls, metadata, ...)
--
-- Em ambientes onde rodou a 20251203122347 primeiro, a segunda foi
-- silenciosamente ignorada (IF NOT EXISTS na própria CREATE não existe — a CREATE
-- explode mas o framework dele às vezes engole). Resultado: cron de
-- process-scheduled-posts tenta `external_post_id`, `retry_count`,
-- `next_retry_at`, `media_urls`, `error_message`, `metadata` que NÃO
-- existem.
--
-- Fix idempotente: adicionar todas as colunas faltantes via ALTER TABLE.
-- Se o schema "novo" já estiver vigente, IF NOT EXISTS evita conflito.

-- Colunas faltantes pra equipar tabela legada com o que o cron espera
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS external_post_id TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Garantir status válidos (incluir 'publishing' que a segunda migration usa)
DO $$
BEGIN
  -- Drop a constraint legada e recriar com o set completo
  IF EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = 'scheduled_posts'
       AND constraint_name = 'scheduled_posts_status_check'
  ) THEN
    ALTER TABLE public.scheduled_posts DROP CONSTRAINT scheduled_posts_status_check;
  END IF;

  ALTER TABLE public.scheduled_posts
    ADD CONSTRAINT scheduled_posts_status_check
    CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed'));
EXCEPTION WHEN OTHERS THEN
  -- Se a tabela não tem coluna status (cenário absurdo), só ignora
  NULL;
END $$;

-- Index pra acelerar pickup do cron (status + scheduled_at)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pickup
  ON public.scheduled_posts(status, scheduled_at)
  WHERE status IN ('scheduled', 'publishing');

-- Index pra retry
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_retry
  ON public.scheduled_posts(status, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;
