
-- Fase 5: Remover tabelas legadas VAZIAS
-- Mantendo: kai_documentation, user_activities, research_* (têm dados)

-- 1. Remover tabela proactive_suggestions (0 registros)
DROP TABLE IF EXISTS public.proactive_suggestions CASCADE;

-- 2. Remover tabela prompt_templates (0 registros)
DROP TABLE IF EXISTS public.prompt_templates CASCADE;

-- 3. Remover tabela instagram_tokens (0 registros)
DROP TABLE IF EXISTS public.instagram_tokens CASCADE;

-- 4. Remover tabela youtube_tokens (0 registros)
DROP TABLE IF EXISTS public.youtube_tokens CASCADE;

-- 5. Remover tabela social_credentials_audit_log (se existir e estiver vazia)
DROP TABLE IF EXISTS public.social_credentials_audit_log CASCADE;

-- 6. Remover tabela rss_triggers (se existir e estiver vazia)
DROP TABLE IF EXISTS public.rss_triggers CASCADE;
