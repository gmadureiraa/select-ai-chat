-- 0049_backfill_automations_late.sql
-- Backfill: substitui provider='metricool' por provider='late' nas rows
-- relacionadas a automações (planning_automations + planning_items gerados
-- por elas) depois que cutamos Metricool em favor do Late/Zernio (2026-05-18).
--
-- IMPORTANTE: este migration NÃO foi aplicado ainda. É preparação. Roda manual
-- depois de validar que nenhum cron/handler escreve mais provider=metricool.
-- Idempotente — pode rodar n vezes sem efeito colateral.
--
-- Escopo:
--   1. planning_automations.trigger_config (defensivo — schema atual não tem
--      provider, mas se alguma row legada gravou, normaliza).
--   2. planning_items.metadata.provider — itens criados por process-automations
--      antes do cutover podem ter ficado com 'metricool'.
--
-- NÃO toca em:
--   - client_social_credentials.metadata (Wave de integrations)
--   - metricool_posts / metricool_daily_snapshots (analytics — outro plano)
--   - planning_items.metadata.metricool_post_id (mantém legado pra audit trail)

BEGIN;

-- ─── 1. planning_automations.trigger_config ──────────────────────────────
WITH affected AS (
  SELECT id, trigger_config
    FROM public.planning_automations
   WHERE trigger_config ? 'provider'
     AND trigger_config->>'provider' = 'metricool'
   FOR UPDATE
)
UPDATE public.planning_automations pa
   SET trigger_config = jsonb_set(pa.trigger_config, '{provider}', '"late"'::jsonb, true),
       updated_at = NOW()
  FROM affected a
 WHERE pa.id = a.id;

-- ─── 2. planning_items.metadata.provider ─────────────────────────────────
-- Mira só itens criados por automation (metadata->>'automation_id' IS NOT NULL)
-- pra não impactar planning_items criados manualmente / por outros fluxos.
WITH affected AS (
  SELECT id, metadata
    FROM public.planning_items
   WHERE metadata ? 'provider'
     AND metadata->>'provider' = 'metricool'
     AND metadata ? 'automation_id'
   FOR UPDATE
)
UPDATE public.planning_items pi
   SET metadata = jsonb_set(pi.metadata, '{provider}', '"late"'::jsonb, true),
       updated_at = NOW()
  FROM affected a
 WHERE pi.id = a.id;

-- ─── Verificação inline ──────────────────────────────────────────────────
DO $$
DECLARE
  pa_remaining int;
  pi_remaining int;
BEGIN
  SELECT count(*) INTO pa_remaining
    FROM public.planning_automations
   WHERE trigger_config->>'provider' = 'metricool';
  SELECT count(*) INTO pi_remaining
    FROM public.planning_items
   WHERE metadata->>'provider' = 'metricool' AND metadata ? 'automation_id';
  RAISE NOTICE '[0049] planning_automations c/ provider=metricool restantes: %', pa_remaining;
  RAISE NOTICE '[0049] planning_items (de automation) c/ provider=metricool restantes: %', pi_remaining;
  IF pa_remaining > 0 OR pi_remaining > 0 THEN
    RAISE WARNING '[0049] Backfill incompleto — investigar rows residuais';
  END IF;
END $$;

COMMIT;
