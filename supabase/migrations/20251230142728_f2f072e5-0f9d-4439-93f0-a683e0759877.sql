-- Remover índice parcial existente que não funciona para ON CONFLICT
DROP INDEX IF EXISTS instagram_stories_story_id_client_id_unique;

-- Criar CONSTRAINT UNIQUE formal (necessária para ON CONFLICT funcionar)
ALTER TABLE instagram_stories 
ADD CONSTRAINT instagram_stories_story_id_client_id_key 
UNIQUE (story_id, client_id);