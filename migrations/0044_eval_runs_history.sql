-- 0044_eval_runs_history.sql — Histórico de execução do KAI Chat eval suite.
--
-- Cada eval run (bun run eval) opcionalmente persiste resultado aqui via
-- --persist flag. Endpoint /api/eval-history lê últimos N pra dashboard
-- mostrar trend de pass rate ao longo do tempo + regression.
--
-- Sem RLS: workspace-wide, apenas admin acessa via Settings.

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
