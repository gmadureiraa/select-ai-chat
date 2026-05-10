-- 0038_viral_carousels_style_meta.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- BUG (audit 2026-05-10): O sub-app SV usa `style` como JSONB com várias
-- chaves (slideStyle, design_template, visual_template, tags, feedback,
-- caption, caption_hashtags, accent_override, display_font, text_scale, etc).
-- Mas a view `carousels` aliasa `vc.template AS style` — `template` é TEXT.
-- Frontend grava JSON, view stringifica dentro do TEXT, próxima leitura volta
-- como string corrompendo metadata e perdendo tags/feedback/visualTemplate.
--
-- FIX: Adiciona coluna `style_meta JSONB` em viral_carousels que guarda os
-- campos extras. View constrói `style` como JSON merge de:
--   - chave 'design_template' = vc.template (string)
--   - chave 'slideStyle' = 'white' (default)
--   - todas as chaves do vc.style_meta
--
-- Triggers INSERT/UPDATE fazem split:
--   - design_template → vc.template
--   - slideStyle, variation, tags, feedback, etc → vc.style_meta
--
-- Aplicado em 2026-05-10.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Adiciona coluna style_meta (idempotente)
ALTER TABLE public.viral_carousels
  ADD COLUMN IF NOT EXISTS style_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Recria view com style construído como JSON merge
DROP VIEW IF EXISTS public.carousels CASCADE;

CREATE VIEW public.carousels AS
SELECT
  vc.id,
  vc.client_id,
  vc.workspace_id,
  vc.user_id,
  vc.title,
  -- style: JSON merge de design_template + slideStyle (default) + style_meta.
  -- Quando style_meta tem chaves que conflitam, prevalecem (override de defaults).
  jsonb_build_object(
    'design_template', vc.template,
    'slideStyle', 'white'
  ) || COALESCE(vc.style_meta, '{}'::jsonb) AS style,
  vc.status,
  vc.profile,
  vc.slides,
  vc.briefing AS prompt_used,
  vc.last_publish_media_urls AS export_assets,
  CASE
    WHEN jsonb_typeof(vc.slides) = 'array' AND jsonb_array_length(vc.slides) > 0
    THEN COALESCE(
      vc.slides->0->'image'->>'url',
      vc.slides->0->>'thumbnail_url',
      NULL
    )
    ELSE NULL
  END AS thumbnail_url,
  vc.tone,
  vc.source,
  vc.planning_item_id,
  vc.scheduled_for,
  vc.published_at,
  vc.created_at,
  vc.updated_at
FROM public.viral_carousels vc;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO authenticated, anon;

-- 3. INSERT trigger: split style → template + style_meta
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
BEGIN
  -- Auth + tenancy resolve (igual 0037)
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

  -- Split style → template (text) + style_meta (jsonb)
  IF jsonb_typeof(NEW.style) = 'object' THEN
    v_template := COALESCE(NEW.style->>'design_template', 'manifesto');
    -- Remove chaves que vão pra colunas próprias (design_template) — resto fica em style_meta
    v_style_meta := NEW.style - 'design_template';
  ELSIF NEW.style IS NULL THEN
    v_template := 'manifesto';
    v_style_meta := '{}'::jsonb;
  ELSE
    -- Compat legado: style veio como string → trata como template
    v_template := COALESCE(NEW.style::text, 'manifesto');
    v_style_meta := '{}'::jsonb;
  END IF;

  INSERT INTO public.viral_carousels
    (id, client_id, workspace_id, user_id, title, template, status,
     profile, slides, briefing, last_publish_media_urls,
     tone, source, planning_item_id, scheduled_for, published_at,
     style_meta, created_at, updated_at)
  VALUES
    (COALESCE(NEW.id, gen_random_uuid()),
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

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.client_id := v_client_id;
  NEW.workspace_id := v_workspace_id;
  NEW.user_id := v_user_id;
  RETURN NEW;
END $function$;

ALTER FUNCTION public.carousels_view_insert() OWNER TO neondb_owner;

-- 4. UPDATE trigger: split + preserve membership check
CREATE OR REPLACE FUNCTION public.carousels_view_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_user_id UUID;
  v_existing_workspace UUID;
  v_template TEXT;
  v_style_meta JSONB;
  v_keep_template BOOLEAN;
  v_keep_style_meta BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT workspace_id INTO v_existing_workspace
    FROM public.viral_carousels
   WHERE id = OLD.id;

  IF v_existing_workspace IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE user_id = v_user_id AND workspace_id = v_existing_workspace
  ) THEN
    RAISE EXCEPTION 'carousels_view_update: user % não tem acesso ao workspace %', v_user_id, v_existing_workspace
      USING ERRCODE = '42501';
  END IF;

  -- Split NEW.style — quando JSONB object, separa design_template e resto
  v_keep_template := FALSE;
  v_keep_style_meta := FALSE;
  IF jsonb_typeof(NEW.style) = 'object' THEN
    IF NEW.style ? 'design_template' THEN
      v_template := NEW.style->>'design_template';
    ELSE
      v_keep_template := TRUE;
    END IF;
    v_style_meta := NEW.style - 'design_template';
  ELSIF NEW.style IS NULL THEN
    -- NULL = preserve both
    v_keep_template := TRUE;
    v_keep_style_meta := TRUE;
  ELSE
    -- string compat: trata como design_template
    v_template := NEW.style::text;
    v_keep_style_meta := TRUE;
  END IF;

  UPDATE public.viral_carousels
     SET title = NEW.title,
         template = CASE WHEN v_keep_template THEN template ELSE v_template END,
         style_meta = CASE WHEN v_keep_style_meta THEN style_meta ELSE v_style_meta END,
         status = COALESCE(NEW.status, status),
         profile = COALESCE(NEW.profile, profile),
         slides = COALESCE(NEW.slides, slides),
         briefing = COALESCE(NEW.prompt_used, briefing),
         last_publish_media_urls = NEW.export_assets,
         tone = COALESCE(NEW.tone, tone),
         source = COALESCE(NEW.source, source),
         planning_item_id = NEW.planning_item_id,
         scheduled_for = NEW.scheduled_for,
         published_at = NEW.published_at,
         updated_at = now()
   WHERE id = OLD.id;

  RETURN NEW;
END $function$;

ALTER FUNCTION public.carousels_view_update() OWNER TO neondb_owner;

-- 5. DELETE trigger (igual 0037, mantido por completude após DROP VIEW CASCADE)
CREATE OR REPLACE FUNCTION public.carousels_view_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_user_id UUID;
  v_existing_workspace UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT workspace_id INTO v_existing_workspace
    FROM public.viral_carousels
   WHERE id = OLD.id;

  IF v_existing_workspace IS NULL THEN
    RETURN OLD;
  END IF;

  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE user_id = v_user_id AND workspace_id = v_existing_workspace
  ) THEN
    RAISE EXCEPTION 'carousels_view_delete: user % não tem acesso ao workspace %', v_user_id, v_existing_workspace
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.viral_carousels WHERE id = OLD.id;
  RETURN OLD;
END $function$;

ALTER FUNCTION public.carousels_view_delete() OWNER TO neondb_owner;

-- 6. Recria triggers
DROP TRIGGER IF EXISTS carousels_view_insert ON public.carousels;
CREATE TRIGGER carousels_view_insert
  INSTEAD OF INSERT ON public.carousels
  FOR EACH ROW EXECUTE FUNCTION public.carousels_view_insert();

DROP TRIGGER IF EXISTS carousels_view_update ON public.carousels;
CREATE TRIGGER carousels_view_update
  INSTEAD OF UPDATE ON public.carousels
  FOR EACH ROW EXECUTE FUNCTION public.carousels_view_update();

DROP TRIGGER IF EXISTS carousels_view_delete ON public.carousels;
CREATE TRIGGER carousels_view_delete
  INSTEAD OF DELETE ON public.carousels
  FOR EACH ROW EXECUTE FUNCTION public.carousels_view_delete();

-- 7. Schema cache reload
NOTIFY pgrst, 'reload schema';
