-- 0005_semantic_search.sql
-- Ativa pesquisa semântica real em global_knowledge usando pgvector.
-- Coluna embedding já é vector(1536) — usamos OpenAI text-embedding-3-small (1536 dims).
--
-- Estado prévio:
--   * global_knowledge.embedding existe (vector(1536))
--   * Index ivfflat global_knowledge_embedding_idx (lists=100) já existe
--   * Função search_knowledge_semantic já existe com assinatura
--     (query_embedding, workspace_id_filter, match_count, similarity_threshold)
--
-- Esta migration:
--   1. Recria a função idempotente, garantindo a assinatura final esperada
--      pelo handler search-knowledge.
--   2. Adiciona índice HNSW (mais eficiente que ivfflat pra working sets pequenos
--      e atualizações frequentes).

-- (Mantemos o ivfflat existente; o planner escolhe o melhor.)
CREATE INDEX IF NOT EXISTS idx_global_knowledge_embedding_hnsw
ON public.global_knowledge
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ─── Função search_knowledge_semantic ──────────────────────────────────
-- Drop pra evitar conflito de assinatura (default args).
DROP FUNCTION IF EXISTS public.search_knowledge_semantic(
  vector, uuid, integer, double precision
);

CREATE OR REPLACE FUNCTION public.search_knowledge_semantic(
  query_embedding vector(1536),
  workspace_id_filter uuid,
  match_count integer DEFAULT 10,
  similarity_threshold double precision DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  summary text,
  category text,
  source_url text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    gk.id,
    gk.title,
    gk.content,
    gk.summary,
    gk.category::text,
    gk.source_url,
    1 - (gk.embedding <=> query_embedding) AS similarity
  FROM public.global_knowledge gk
  WHERE
    gk.workspace_id = workspace_id_filter
    AND gk.embedding IS NOT NULL
    AND 1 - (gk.embedding <=> query_embedding) > similarity_threshold
  ORDER BY gk.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.search_knowledge_semantic IS
  'Cosine-similarity search over global_knowledge.embedding (vector(1536), OpenAI text-embedding-3-small). Returns rows with similarity score above threshold, ordered by closeness.';
