-- 0035_viral_carousels_nullable_client_col.sql
-- Aplica o que a migration 0032_viral_carousels_rls_nullable_client.sql
-- assumia mas não fez: a COLUNA client_id era NOT NULL no DB.
--
-- A 0032 só ajustou as RLS policies pra permitir client_id NULL,
-- mas o ALTER TABLE pra tornar a coluna efetivamente nullable não
-- foi rodado. Resultado: INSERTs com client_id NULL passavam pela RLS
-- mas batiam em 23502 'null value violates not-null constraint'.
--
-- Aplicado em 2026-05-10 + NOTIFY pgrst pra recarregar cache.

ALTER TABLE public.viral_carousels ALTER COLUMN client_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
