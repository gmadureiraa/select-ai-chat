-- 0051_multi_assignees.sql
-- 2026-05-19: suporte a múltiplos responsáveis em planning_items e team_tasks.
-- Gabriel pediu poder marcar mais de uma pessoa por card (planejamento + tarefas).
--
-- Estratégia: nova coluna `assignees uuid[]`. A coluna legacy `assigned_to`
-- (uuid single) é mantida como "primary" (= assignees[1]) pra retrocompat com
-- filtros/queries existentes. Handlers gravam ambas em sync.

ALTER TABLE planning_items ADD COLUMN IF NOT EXISTS assignees uuid[] DEFAULT '{}';
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS assignees uuid[] DEFAULT '{}';

-- Backfill: assigned_to existente vira o primeiro (e único) assignee.
UPDATE planning_items SET assignees = ARRAY[assigned_to]
  WHERE assigned_to IS NOT NULL AND (assignees IS NULL OR cardinality(assignees) = 0);
UPDATE team_tasks SET assignees = ARRAY[assigned_to]
  WHERE assigned_to IS NOT NULL AND (assignees IS NULL OR cardinality(assignees) = 0);

-- GIN index pra filtro `assignees @> ARRAY[<uuid>]` (ex: "tarefas do membro X").
CREATE INDEX IF NOT EXISTS idx_planning_items_assignees ON planning_items USING gin (assignees);
CREATE INDEX IF NOT EXISTS idx_team_tasks_assignees ON team_tasks USING gin (assignees);
