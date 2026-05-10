-- 0039_fix_carousels_view_insert_id_consistency.sql
-- BUG: o trigger `carousels_view_insert` (versões 0028, 0037, 0038) chama
-- `gen_random_uuid()` DUAS VEZES quando NEW.id é NULL:
--   1. dentro de INSERT VALUES (COALESCE(NEW.id, gen_random_uuid()))
--   2. depois em NEW.id := COALESCE(NEW.id, gen_random_uuid())
-- Resultado: row inserida com UUID A, mas RETURNING NEW.id devolve UUID B.
-- Frontend persiste id que não existe → SELECT subsequente vem vazio →
-- editor mostra "Rascunho não encontrado" mesmo após save.
--
-- Confirmado via smoke test em 2026-05-10: INSERT retorna id X, SELECT por X
-- não acha nada.
--
-- Fix: capturar UUID em variável local e reusar.

CREATE OR REPLACE FUNCTION public.carousels_view_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_user_id UUID;
  v_client_id UUID;
  v_workspace_id UUID;
  v_template TEXT;
  v_style_meta JSONB;
  v_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'carousels_view_insert: user_id is required'
      USING ERRCODE = '42501';
  END IF;

  v_client_id := NEW.client_id;
  IF v_client_id IS NULL THEN
    SELECT c.id INTO v_client_id
      FROM public.clients c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE wm.user_id = v_user_id
     ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
     LIMIT 1;
  END IF;

  v_workspace_id := NEW.workspace_id;
  IF v_workspace_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT workspace_id INTO v_workspace_id
      FROM public.clients
     WHERE id = v_client_id;
  END IF;
  IF v_workspace_id IS NULL THEN
    SELECT workspace_id INTO v_workspace_id
      FROM public.workspace_members
     WHERE user_id = v_user_id
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'carousels_view_insert: nenhum workspace pode ser resolvido'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE user_id = v_user_id AND workspace_id = v_workspace_id
  ) THEN
    RAISE EXCEPTION 'carousels_view_insert: user % não é membro do workspace %', v_user_id, v_workspace_id
      USING ERRCODE = '42501';
  END IF;

  IF v_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients
     WHERE id = v_client_id AND workspace_id = v_workspace_id
  ) THEN
    RAISE EXCEPTION 'carousels_view_insert: client % não pertence ao workspace %', v_client_id, v_workspace_id
      USING ERRCODE = '42501';
  END IF;

  -- Style split
  IF jsonb_typeof(NEW.style) = 'object' THEN
    v_template := COALESCE(NEW.style->>'design_template', 'manifesto');
    v_style_meta := NEW.style - 'design_template';
  ELSIF NEW.style IS NULL THEN
    v_template := 'manifesto';
    v_style_meta := '{}'::jsonb;
  ELSE
    v_template := COALESCE(NEW.style::text, 'manifesto');
    v_style_meta := '{}'::jsonb;
  END IF;

  -- Captura ID UMA VEZ pra reusar no INSERT e no NEW.id final.
  v_id := COALESCE(NEW.id, gen_random_uuid());

  INSERT INTO public.viral_carousels
    (id, client_id, workspace_id, user_id, title, template, status,
     profile, slides, briefing, last_publish_media_urls,
     tone, source, planning_item_id, scheduled_for, published_at,
     style_meta, created_at, updated_at)
  VALUES
    (v_id,
     v_client_id, v_workspace_id, v_user_id,
     NEW.title,
     v_template,
     COALESCE(NEW.status, 'draft'),
     COALESCE(NEW.profile, '{}'::jsonb),
     COALESCE(NEW.slides, '[]'::jsonb),
     COALESCE(NEW.prompt_used, NEW.title),
     NEW.export_assets,
     COALESCE(NEW.tone, 'direto'),
     COALESCE(NEW.source, 'manual'),
     NEW.planning_item_id,
     NEW.scheduled_for,
     NEW.published_at,
     v_style_meta,
     COALESCE(NEW.created_at, now()),
     COALESCE(NEW.updated_at, now()));

  NEW.id := v_id;
  NEW.client_id := v_client_id;
  NEW.workspace_id := v_workspace_id;
  NEW.user_id := v_user_id;
  RETURN NEW;
END $function$;

ALTER FUNCTION public.carousels_view_insert() OWNER TO neondb_owner;

NOTIFY pgrst, 'reload schema';
