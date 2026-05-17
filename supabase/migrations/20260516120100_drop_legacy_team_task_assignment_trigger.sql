-- 0042: Drop legacy trg_notify_team_task_assignment trigger
--
-- Bug: migrations 20260504135451 e 20260504144016 criaram DOIS triggers
-- diferentes para o MESMO evento (assigned_to em team_tasks):
--   - 20260504135451 → trg_notify_team_task_assignment
--                       (chama notify_team_task_assignment(), insere link)
--   - 20260504144016 → trg_notify_task_assignment
--                       (chama notify_on_task_assignment(), versão canônica)
--
-- 20260504144016 NÃO fez DROP do trigger antigo, então ambos coexistem.
-- Cada atribuição dispara 2 INSERTs em notifications — o legado quebra
-- por `link` (corrigido em 0041) E gera notif duplicada pro user.
--
-- Fix: drop trigger legado + função correspondente.

DROP TRIGGER IF EXISTS trg_notify_team_task_assignment ON public.team_tasks;

-- Função pode ser dropada — só usada pelo trigger legado.
DROP FUNCTION IF EXISTS public.notify_team_task_assignment() CASCADE;

-- Idem para comment mentions (também duplicado na 0135451)
DROP TRIGGER IF EXISTS trg_notify_team_task_comment_mentions ON public.team_task_comments;
DROP FUNCTION IF EXISTS public.notify_team_task_comment_mentions() CASCADE;
