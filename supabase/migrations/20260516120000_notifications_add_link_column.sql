-- 0041: Fix notifications.link missing column
--
-- Bug: migration 20260504135451 inserts INTO notifications(user_id, workspace_id, type,
-- title, message, link, metadata) mas `link` nunca existiu na tabela
-- (criada em 20260104130731 sem essa coluna). Cada atribuição de tarefa
-- e cada comentário com menção quebra com:
--   ERROR: column "link" of relation "notifications" does not exist
--
-- Fix: adicionar coluna `link` como nullable text.
--
-- A migration 20260504144016 (canônica) usa entity_type+entity_id+metadata,
-- então a coluna `link` é só pra triggers legados da 0135451 não quebrarem
-- até serem removidos.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link TEXT;

COMMENT ON COLUMN public.notifications.link IS 'Deep link opcional pro item da notif. Preferir entity_type+entity_id pra renderizar a URL no client.';
