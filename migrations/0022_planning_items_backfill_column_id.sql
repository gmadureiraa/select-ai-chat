-- ─── planning_items.column_id backfill ─────────────────────────────────────
-- Audit 2026-05-08: PlanningBoard (Kanban view) filtra cards por column_id.
-- O handler `run-madureira-workflows-daily.ts` antes só inseria status sem
-- column_id, então 8 cards do Madureira (workspace 11111111-...) ficavam
-- invisíveis no Kanban — apareciam só na lista.
--
-- Este migration:
--   1. Backfill: mapeia status -> column_type -> column_id por workspace e
--      preenche column_id onde está NULL.
--   2. Verificação inline. Não cria constraint NOT NULL pra ser tolerante
--      com novos workflows que ainda não inicializaram kanban_columns,
--      mas o ideal é todo INSERT já trazer column_id.

UPDATE public.planning_items pi
   SET column_id = kc.id
  FROM public.kanban_columns kc
 WHERE pi.column_id IS NULL
   AND kc.workspace_id = pi.workspace_id
   AND kc.column_type = CASE
     WHEN pi.status IN ('idea', 'pending-validation') THEN 'idea'
     WHEN pi.status = 'draft' THEN 'draft'
     WHEN pi.status = 'review' THEN 'review'
     WHEN pi.status = 'approved' THEN 'approved'
     WHEN pi.status IN ('scheduled', 'publishing', 'failed') THEN 'scheduled'
     WHEN pi.status = 'published' THEN 'published'
     ELSE 'idea'
   END;

-- Verificação inline
DO $$
DECLARE
  total_count int;
  null_count int;
BEGIN
  SELECT count(*) INTO total_count FROM planning_items;
  SELECT count(*) INTO null_count FROM planning_items WHERE column_id IS NULL;
  RAISE NOTICE '[0022] planning_items total: % | column_id NULL after backfill: %', total_count, null_count;
  IF null_count > 0 THEN
    RAISE NOTICE '[0022] WARN: % items still NULL — workspace pode não ter kanban_columns inicializadas. Rode initialize_kanban_columns(workspace_id) por workspace afetado.', null_count;
  END IF;
END $$;
