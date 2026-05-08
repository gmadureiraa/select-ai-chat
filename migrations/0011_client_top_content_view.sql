-- 0011_client_top_content_view.sql
-- FASE D — materialized view que pré-computa top conteúdos por cliente.
-- Usada pelos agentes virais (carousel, reels, KAI content) como referência
-- de "padrões de sucesso" do cliente.
--
-- Filtra:
--   * engagement_score > 0  (precisa ter pelo menos um like/comment/share)
--   * metadata.published_at nos últimos 6 meses (relevância temporal)
--     OU created_at nos últimos 6 meses se published_at não existir.
--
-- ROW_NUMBER() particiona por client_id e ranqueia por engagement DESC.
-- Refresh on-demand via public.refresh_client_top_content() — chamada por
-- cron ou após inserts grandes em client_content_library.
--
-- Depende de 0009_client_content_embeddings.sql (engagement_score column).

DROP MATERIALIZED VIEW IF EXISTS public.client_top_content;

CREATE MATERIALIZED VIEW public.client_top_content AS
SELECT
  client_id,
  id,
  title,
  content,
  content_type::text AS content_type,
  metadata,
  engagement_score,
  created_at,
  ROW_NUMBER() OVER (
    PARTITION BY client_id
    ORDER BY engagement_score DESC, created_at DESC
  ) AS rank
FROM public.client_content_library
WHERE
  engagement_score > 0
  AND COALESCE(
        NULLIF(metadata->>'published_at', '')::timestamptz,
        created_at
      ) > now() - interval '6 months'
WITH DATA;

-- Unique index obrigatório pra REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_top_content_pk
  ON public.client_top_content(id);

CREATE INDEX IF NOT EXISTS idx_client_top_content_lookup
  ON public.client_top_content(client_id, rank);

-- Função pra refresh on-demand (cron ou scripts manuais).
CREATE OR REPLACE FUNCTION public.refresh_client_top_content()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.client_top_content;
$$;

COMMENT ON MATERIALIZED VIEW public.client_top_content IS
  'Top conteúdos por cliente nos últimos 6 meses, ranqueados por engagement_score. Refresh via refresh_client_top_content().';
COMMENT ON FUNCTION public.refresh_client_top_content IS
  'REFRESH CONCURRENTLY do client_top_content. Chamar via cron ou após batch insert.';

GRANT SELECT ON public.client_top_content TO authenticated, anon;
-- "anonymous" não existe em todos schemas Neon; tentar sem falhar.
DO $$
BEGIN
  EXECUTE 'GRANT SELECT ON public.client_top_content TO anonymous';
EXCEPTION WHEN undefined_object THEN
  -- role anonymous inexistente, ignora
  NULL;
END $$;
