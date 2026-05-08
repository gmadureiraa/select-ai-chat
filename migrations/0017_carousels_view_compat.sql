-- ─── carousels VIEW: compat layer pro viral-sv-original ──────────────────
-- O sub-app viral-sv-original (cópia literal do Sequência Viral standalone)
-- faz queries em `from("carousels")`. KAI tem `viral_carousels` com schema
-- próximo. VIEW alinha nomes pra UI funcionar sem refactor de 14 call-sites.
--
-- Mapping:
--   carousels.style          → viral_carousels.template
--   carousels.thumbnail_url  → derive de slides[0].image.url (jsonb)
--   carousels.export_assets  → viral_carousels.last_publish_media_urls
--   carousels.prompt_used    → viral_carousels.briefing
--
-- WRITE-back via INSTEAD OF rules permite UPDATE/INSERT/DELETE direto no VIEW.

CREATE OR REPLACE VIEW public.carousels AS
SELECT
  vc.id,
  vc.client_id,
  vc.workspace_id,
  vc.user_id,
  vc.title,
  vc.template AS style,
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

-- INSTEAD OF triggers pra suportar INSERT/UPDATE/DELETE via VIEW

CREATE OR REPLACE FUNCTION public.carousels_view_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.viral_carousels
    (id, client_id, workspace_id, user_id, title, template, status,
     profile, slides, briefing, last_publish_media_urls,
     tone, source, planning_item_id, scheduled_for, published_at,
     created_at, updated_at)
  VALUES
    (COALESCE(NEW.id, gen_random_uuid()),
     NEW.client_id,
     NEW.workspace_id,
     NEW.user_id,
     NEW.title,
     COALESCE(NEW.style, 'manifesto'),
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
     COALESCE(NEW.created_at, now()),
     COALESCE(NEW.updated_at, now()));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS carousels_view_insert ON public.carousels;
CREATE TRIGGER carousels_view_insert
  INSTEAD OF INSERT ON public.carousels
  FOR EACH ROW EXECUTE FUNCTION public.carousels_view_insert();

CREATE OR REPLACE FUNCTION public.carousels_view_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.viral_carousels
     SET title = NEW.title,
         template = COALESCE(NEW.style, template),
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
END $$;

DROP TRIGGER IF EXISTS carousels_view_update ON public.carousels;
CREATE TRIGGER carousels_view_update
  INSTEAD OF UPDATE ON public.carousels
  FOR EACH ROW EXECUTE FUNCTION public.carousels_view_update();

CREATE OR REPLACE FUNCTION public.carousels_view_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.viral_carousels WHERE id = OLD.id;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS carousels_view_delete ON public.carousels;
CREATE TRIGGER carousels_view_delete
  INSTEAD OF DELETE ON public.carousels
  FOR EACH ROW EXECUTE FUNCTION public.carousels_view_delete();

-- Permissões na view: herdam policies da tabela base. Habilita acesso
-- via PostgREST/Neon Data API.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO authenticated, anon;
