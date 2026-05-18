-- 0044_eval_runs_history.sql — Histórico de execução do KAI Chat eval suite.
--
-- Cada eval run (bun run eval) opcionalmente persiste resultado aqui via
-- --persist flag. Endpoint /api/eval-history lê últimos N pra dashboard
-- mostrar trend de pass rate ao longo do tempo + regression.
--
-- RLS: somente super_admin lê via Data API. Escrita/leitura operacional passa
-- pelo backend, que também valida super_admin no GET e EVAL_INGEST_TOKEN no POST.

CREATE TABLE IF NOT EXISTS public.eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Identidade
  model text NOT NULL,
  judge_model text,
  git_ref text, -- branch ou sha do código quando rodou (preenchido pelo CI)
  trigger text NOT NULL DEFAULT 'manual', -- manual | ci | scheduled
  -- Métricas agregadas
  total_cases int NOT NULL,
  passed_cases int NOT NULL,
  failed_cases int NOT NULL,
  total_duration_ms int NOT NULL,
  -- Detalhe completo dos cases (compacto, sem finalText long)
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Metadados livres (--tag filter, CLI args, etc)
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Lookup por tempo (dashboard mostra últimos 30 dias por default).
CREATE INDEX IF NOT EXISTS eval_runs_created_at_idx
  ON public.eval_runs (created_at DESC);

-- Lookup por trigger (separar CI runs de manual em queries).
CREATE INDEX IF NOT EXISTS eval_runs_trigger_idx
  ON public.eval_runs (trigger, created_at DESC);

ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eval_runs_super_admin_select ON public.eval_runs;
CREATE POLICY eval_runs_super_admin_select
  ON public.eval_runs
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));
