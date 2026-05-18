-- ─── Planning Kanban v2 — gate "Aprovar" antes de iniciar produção ─────────
-- Fluxo antigo (6 colunas):
--   Ideias → Rascunho → Revisão → Aprovado → Agendado → Publicado
--
-- Fluxo novo (7 colunas):
--   Ideias → Aprovar → Iniciar → Revisar → Pronto → Agendado → Publicado
--
-- Semântica: ideia entra em "Ideias". Antes de alguém começar a produzir,
-- precisa passar pelo gate "Aprovar" (novo column_type='pending_approval').
-- Aprovou → vai pra "Iniciar" (draft em produção) → "Revisar" → "Pronto"
-- (revisado e ok pra agendar) → "Agendado" → "Publicado".
--
-- Esta migration:
--   1. Renomeia colunas existentes em TODOS workspaces (Rascunho→Iniciar,
--      Revisão→Revisar, Aprovado→Pronto). Color preservado.
--   2. Reposiciona pra abrir slot em position=1 pra coluna "Aprovar".
--   3. Insere coluna "Aprovar" (column_type='pending_approval', position=1)
--      em todo workspace que ainda não tem.
--   4. Atualiza a função initialize_kanban_columns pra novos workspaces
--      nascerem já com 7 colunas.
--   5. Estende constraint de planning_automations.status_after_generation
--      pra aceitar 'pending_approval'.

-- ─── 1+2. Renomear e reposicionar colunas existentes ───────────────────────
-- Cards mantêm column_id (FK), só os metadados da coluna mudam.

UPDATE public.kanban_columns
   SET name = 'Iniciar', position = 2
 WHERE column_type = 'draft' AND is_default = true;

UPDATE public.kanban_columns
   SET name = 'Revisar', position = 3
 WHERE column_type = 'review' AND is_default = true;

UPDATE public.kanban_columns
   SET name = 'Pronto', position = 4
 WHERE column_type = 'approved' AND is_default = true;

UPDATE public.kanban_columns
   SET position = 5
 WHERE column_type = 'scheduled' AND is_default = true;

UPDATE public.kanban_columns
   SET position = 6
 WHERE column_type = 'published' AND is_default = true;

-- ─── 3. Inserir coluna "Aprovar" em todos workspaces que ainda não têm ─────

INSERT INTO public.kanban_columns (workspace_id, name, position, color, is_default, column_type)
SELECT DISTINCT kc.workspace_id, 'Aprovar', 1, 'amber', true, 'pending_approval'
  FROM public.kanban_columns kc
 WHERE NOT EXISTS (
   SELECT 1 FROM public.kanban_columns kc2
    WHERE kc2.workspace_id = kc.workspace_id
      AND kc2.column_type = 'pending_approval'
 );

-- ─── 4. Atualiza initialize_kanban_columns pra novos workspaces ────────────

CREATE OR REPLACE FUNCTION public.initialize_kanban_columns(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM kanban_columns WHERE workspace_id = p_workspace_id) THEN
    INSERT INTO kanban_columns (workspace_id, name, position, color, is_default, column_type) VALUES
      (p_workspace_id, 'Ideias',    0, 'purple', true, 'idea'),
      (p_workspace_id, 'Aprovar',   1, 'amber',  true, 'pending_approval'),
      (p_workspace_id, 'Iniciar',   2, 'blue',   true, 'draft'),
      (p_workspace_id, 'Revisar',   3, 'yellow', true, 'review'),
      (p_workspace_id, 'Pronto',    4, 'green',  true, 'approved'),
      (p_workspace_id, 'Agendado',  5, 'orange', true, 'scheduled'),
      (p_workspace_id, 'Publicado', 6, 'gray',   true, 'published');
  END IF;
END;
$$;

-- ─── 5. Estende constraint de planning_automations.status_after_generation ─

ALTER TABLE public.planning_automations
  DROP CONSTRAINT IF EXISTS planning_automations_status_after_generation_check;

ALTER TABLE public.planning_automations
  ADD CONSTRAINT planning_automations_status_after_generation_check
  CHECK (status_after_generation IN ('idea', 'pending_approval', 'draft', 'approved'));

-- ─── Verificação inline ────────────────────────────────────────────────────

DO $$
DECLARE
  ws_count int;
  approval_count int;
BEGIN
  SELECT count(DISTINCT workspace_id) INTO ws_count FROM kanban_columns;
  SELECT count(*) INTO approval_count
    FROM kanban_columns
   WHERE column_type = 'pending_approval';
  RAISE NOTICE '[0045] workspaces com kanban: % | colunas Aprovar criadas: %', ws_count, approval_count;
END $$;
