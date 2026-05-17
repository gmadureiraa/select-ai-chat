-- 0041_backfill_content_pillars_singular.sql
--
-- Fix do bug P0 (audit 2026-05-16): onboarding gravava pilares em
-- client_preferences com preference_type = 'content_pillars' (plural)
-- como uma unica row CSV. Decoder em useClientContext.ts e em
-- api/_lib/shared/client-context.ts sempre leu 'content_pillar' (singular)
-- multi-row, entao os pilares nunca chegavam ao contexto.
--
-- Esta migration:
--   1. Encontra todas as rows legacy com type='content_pillars'
--   2. Divide o CSV em pilares individuais
--   3. Cria uma row 'content_pillar' (singular) por pilar
--   4. Deleta a row legacy plural
--
-- E idempotente: roda sem efeito se nao existir nenhuma row plural.

BEGIN;

-- Insere uma row por pilar (split por ", " — mesmo separator usado no onboarding)
INSERT INTO client_preferences (client_id, preference_type, preference_value)
SELECT
  cp.client_id,
  'content_pillar' AS preference_type,
  TRIM(piece) AS preference_value
FROM client_preferences cp,
     LATERAL UNNEST(string_to_array(cp.preference_value, ', ')) AS piece
WHERE cp.preference_type = 'content_pillars'
  AND COALESCE(TRIM(piece), '') <> ''
  -- Evita reinserir se ja existe row singular pro mesmo (client_id, valor)
  AND NOT EXISTS (
    SELECT 1 FROM client_preferences cp2
    WHERE cp2.client_id = cp.client_id
      AND cp2.preference_type = 'content_pillar'
      AND cp2.preference_value = TRIM(piece)
  );

-- Remove as rows legacy plural
DELETE FROM client_preferences
WHERE preference_type = 'content_pillars';

COMMIT;
