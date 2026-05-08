-- 0009_client_content_embeddings.sql
-- Knowledge feedback loop FASE D — adiciona embeddings + engagement_score
-- em public.client_content_library para alimentar similarity search dos
-- agentes virais (sequência viral, reels, KAI content agent).
--
-- Coluna embedding usa vector(1536) pra ficar compatível com
-- text-embedding-3-small (mesmo modelo do global_knowledge / SEMANTIC-SEARCH).
--
-- engagement_score é calculado a partir de metadata.likes / comments / shares
-- via trigger BEFORE INSERT/UPDATE. Score pondera: likes×1 + comments×2 + shares×5.
--
-- Idempotente: usa IF NOT EXISTS em colunas, function CREATE OR REPLACE,
-- DROP TRIGGER IF EXISTS antes de criar.

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Colunas novas ────────────────────────────────────────────────────────
ALTER TABLE public.client_content_library
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS engagement_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedded_at timestamp with time zone;

-- ─── Função pura: calc_engagement_score ──────────────────────────────────
-- Recebe contadores nullable e retorna score numérico.
-- IMMUTABLE pra permitir uso em GENERATED columns / index expressions futuros.
CREATE OR REPLACE FUNCTION public.calc_engagement_score(
  p_likes int,
  p_comments int,
  p_shares int
) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_likes, 0)::numeric
       + COALESCE(p_comments, 0) * 2
       + COALESCE(p_shares, 0) * 5;
$$;

COMMENT ON FUNCTION public.calc_engagement_score IS
  'Pondera engajamento: likes×1 + comments×2 + shares×5. IMMUTABLE para uso em índices.';

-- ─── Trigger function: atualiza engagement_score automaticamente ─────────
CREATE OR REPLACE FUNCTION public.update_engagement_score()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.engagement_score = public.calc_engagement_score(
    NULLIF(NEW.metadata->>'likes', '')::int,
    NULLIF(NEW.metadata->>'comments', '')::int,
    NULLIF(NEW.metadata->>'shares', '')::int
  );
  RETURN NEW;
END $$;

-- ─── Trigger: dispara em INSERT ou UPDATE de metadata ────────────────────
DROP TRIGGER IF EXISTS client_content_engagement_score
  ON public.client_content_library;

CREATE TRIGGER client_content_engagement_score
BEFORE INSERT OR UPDATE OF metadata
ON public.client_content_library
FOR EACH ROW
EXECUTE FUNCTION public.update_engagement_score();

-- Backfill engagement_score em rows existentes (vai disparar trigger UPDATE
-- mas ele só recalcula com mesmo input → idempotente).
UPDATE public.client_content_library
   SET metadata = metadata
 WHERE engagement_score = 0
   AND metadata ? 'likes';

-- ─── Indexes ──────────────────────────────────────────────────────────────
-- HNSW pra similarity search (cosine distance).
CREATE INDEX IF NOT EXISTS idx_client_content_embedding
  ON public.client_content_library
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- B-tree pra "top performing" queries (client + score desc).
CREATE INDEX IF NOT EXISTS idx_client_content_engagement
  ON public.client_content_library (client_id, engagement_score DESC);

-- B-tree filtrado pra encontrar rows que ainda precisam de embedding.
CREATE INDEX IF NOT EXISTS idx_client_content_embedding_pending
  ON public.client_content_library (created_at DESC)
  WHERE embedding IS NULL;

COMMENT ON COLUMN public.client_content_library.embedding IS
  'Embedding (1536 dims, OpenAI text-embedding-3-small) do title + content. Populado pelo handler embed-client-content.';
COMMENT ON COLUMN public.client_content_library.engagement_score IS
  'Score derivado: likes + 2×comments + 5×shares. Atualizado pelo trigger client_content_engagement_score.';
COMMENT ON COLUMN public.client_content_library.embedded_at IS
  'Última vez que embedding foi recalculado. NULL = pendente.';
