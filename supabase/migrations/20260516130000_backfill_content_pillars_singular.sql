-- 20260516130000_backfill_content_pillars_singular.sql
--
-- Espelho da migration Neon migrations/0041_backfill_content_pillars_singular.sql
-- (KAI 2.0 mantem 2 dirs de migrations: `migrations/` rodadas no Neon e
-- `supabase/migrations/` historico Lovable original).
--
-- Fix do bug P0 (audit 2026-05-16): onboarding gravava pilares em
-- client_preferences com preference_type = 'content_pillars' (plural)
-- como uma unica row CSV. Decoder em useClientContext.ts e em
-- api/_lib/shared/client-context.ts sempre leu 'content_pillar' (singular)
-- multi-row, entao os pilares nunca chegavam ao contexto dos geradores.

BEGIN;

INSERT INTO client_preferences (client_id, preference_type, preference_value)
SELECT
  cp.client_id,
  'content_pillar' AS preference_type,
  TRIM(piece) AS preference_value
FROM client_preferences cp,
     LATERAL UNNEST(string_to_array(cp.preference_value, ', ')) AS piece
WHERE cp.preference_type = 'content_pillars'
  AND COALESCE(TRIM(piece), '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM client_preferences cp2
    WHERE cp2.client_id = cp.client_id
      AND cp2.preference_type = 'content_pillar'
      AND cp2.preference_value = TRIM(piece)
  );

DELETE FROM client_preferences
WHERE preference_type = 'content_pillars';

COMMIT;
