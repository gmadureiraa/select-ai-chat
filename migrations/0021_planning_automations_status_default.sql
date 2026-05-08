-- ─── planning_automations.status_after_generation ──────────────────────────
-- Audit F gap: "modo aprovação implícito, não explícito".
--
-- Hoje, quando uma automação roda com auto_publish=false, o card cai no
-- planning_items com status='idea' por padrão (hardcoded no handler), e
-- não dá pra escolher se quer mandar direto pra 'draft' (rascunho editável)
-- ou 'approved' (já aprovado, segue pra agendar).
--
-- Esta col fecha o gap: cada automação declara em qual status o card nasce.
-- Default 'idea' preserva o comportamento atual (precisa aprovação manual).
--
-- Valores válidos no PlanningBoard:
--   - 'idea'      → coluna "Ideias", precisa Gabriel aprovar
--   - 'draft'     → coluna "Rascunho", editável, ainda não aprovado
--   - 'approved'  → coluna "Aprovado", já vai pra agendamento
--
-- Quando auto_publish=true, esta col é ignorada (vai direto pra publishing).

ALTER TABLE public.planning_automations
  ADD COLUMN IF NOT EXISTS status_after_generation text DEFAULT 'idea';

-- Constraint pra evitar status inválidos. (planning_items aceita mais valores
-- mas pra automações só esses 3 fazem sentido — created via UI dropdown.)
ALTER TABLE public.planning_automations
  DROP CONSTRAINT IF EXISTS planning_automations_status_after_generation_check;

ALTER TABLE public.planning_automations
  ADD CONSTRAINT planning_automations_status_after_generation_check
  CHECK (status_after_generation IN ('idea', 'draft', 'approved'));

COMMENT ON COLUMN public.planning_automations.status_after_generation IS
  'Status inicial do planning_item criado quando auto_publish=false. Default idea (precisa aprovação manual).';

-- Backfill: tudo que existe hoje fica idea (comportamento atual).
UPDATE public.planning_automations
   SET status_after_generation = 'idea'
 WHERE status_after_generation IS NULL;

-- Verificação inline
DO $$
DECLARE
  total_count int;
  with_status int;
BEGIN
  SELECT count(*) INTO total_count FROM planning_automations;
  SELECT count(*) INTO with_status FROM planning_automations WHERE status_after_generation IS NOT NULL;
  RAISE NOTICE '[0021] planning_automations total: % | com status_after_generation: %', total_count, with_status;
END $$;
