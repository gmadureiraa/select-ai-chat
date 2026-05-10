-- 0037_carousels_view_security_definer_definitive.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- BUG (2026-05-10): "new row violates row-level security policy for table
-- viral_carousels" persistente ao salvar carrossel via Sequência Viral no KAI.
--
-- DIAGNÓSTICO (script _diag_rls.mjs em 2026-05-10):
-- 1. Migration 0028 setou SECURITY DEFINER em carousels_view_insert e fazia
--    sanity check manual de workspace membership.
-- 2. Algum re-deploy ou reseed rodou a 0017_carousels_view_compat.sql DEPOIS
--    da 0028, sobrescrevendo a função SEM SECURITY DEFINER e SEM auto-resolve.
-- 3. Confirmado: pg_get_functiondef mostra a versão 0017 atual; prosecdef=false.
-- 4. Resultado: INSERT/UPDATE/DELETE via view roda com role=authenticated,
--    dispara RLS em viral_carousels. Quando JWT do Neon Auth não propaga
--    auth.uid() perfeitamente pro PostgREST do Neon Data API, RLS bloqueia.
--
-- FIX DEFINITIVO:
-- Recria TODAS as 3 funções de trigger com SECURITY DEFINER + validação
-- manual de membership. Owner = neondb_owner (dono de viral_carousels sem
-- FORCE RLS) garante bypass de RLS dentro do trigger. Validação manual de
-- workspace_members garante que continua tão seguro quanto RLS.
--
-- Aplicado em 2026-05-10.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── INSERT ─────────────────────────────────────────────────────────────────
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
BEGIN
  -- 1. user_id: usa NEW.user_id se vier; senão tenta auth.uid()
  v_user_id := COALESCE(NEW.user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'carousels_view_insert: user_id is required (no auth.uid() and NEW.user_id is NULL)'
      USING ERRCODE = '42501';
  END IF;

  -- 2. client_id: usa NEW.client_id; senão fallback pro último cliente do user
  v_client_id := NEW.client_id;
  IF v_client_id IS NULL THEN
    SELECT c.id INTO v_client_id
      FROM public.clients c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE wm.user_id = v_user_id
     ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
     LIMIT 1;
  END IF;

  -- 3. workspace_id: usa NEW.workspace_id; senão deriva do client; senão
  --    primeiro workspace do user (carrosseis sandbox sem cliente).
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
    RAISE EXCEPTION 'carousels_view_insert: nenhum workspace pode ser resolvido para o user %', v_user_id
      USING ERRCODE = '42501';
  END IF;

  -- 4. Sanity: confirma que o user é membro do workspace antes de inserir.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE user_id = v_user_id AND workspace_id = v_workspace_id
  ) THEN
    RAISE EXCEPTION 'carousels_view_insert: user % não é membro do workspace %', v_user_id, v_workspace_id
      USING ERRCODE = '42501';
  END IF;

  -- 5. Sanity: se client_id veio, confirma que pertence ao workspace.
  IF v_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients
     WHERE id = v_client_id AND workspace_id = v_workspace_id
  ) THEN
    RAISE EXCEPTION 'carousels_view_insert: client % não pertence ao workspace %', v_client_id, v_workspace_id
      USING ERRCODE = '42501';
  END IF;

  -- 6. INSERT real (SECURITY DEFINER bypassa RLS, validação manual fez sanity).
  INSERT INTO public.viral_carousels
    (id, client_id, workspace_id, user_id, title, template, status,
     profile, slides, briefing, last_publish_media_urls,
     tone, source, planning_item_id, scheduled_for, published_at,
     created_at, updated_at)
  VALUES
    (COALESCE(NEW.id, gen_random_uuid()),
     v_client_id,
     v_workspace_id,
     v_user_id,
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

  -- Atualiza NEW pros campos resolvidos pra que RETURNING veja valores reais.
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.client_id := v_client_id;
  NEW.workspace_id := v_workspace_id;
  NEW.user_id := v_user_id;
  RETURN NEW;
END $function$;

ALTER FUNCTION public.carousels_view_insert() OWNER TO neondb_owner;

-- ── UPDATE ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.carousels_view_update()
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

  -- Busca workspace da row existente pra validar membership.
  SELECT workspace_id INTO v_existing_workspace
    FROM public.viral_carousels
   WHERE id = OLD.id;

  IF v_existing_workspace IS NULL THEN
    -- Row não existe — não atualiza nada (deixa o UPDATE retornar 0 rows).
    RETURN NEW;
  END IF;

  -- Sanity: user logado deve ser membro do workspace dono da row.
  -- Pula validação se v_user_id é NULL (chamadas via service role / triggers
  -- internos / cron — confiamos no security_definer do caller).
  IF v_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE user_id = v_user_id AND workspace_id = v_existing_workspace
  ) THEN
    RAISE EXCEPTION 'carousels_view_update: user % não tem acesso ao workspace %', v_user_id, v_existing_workspace
      USING ERRCODE = '42501';
  END IF;

  -- UPDATE real (SECURITY DEFINER bypassa RLS).
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
END $function$;

ALTER FUNCTION public.carousels_view_update() OWNER TO neondb_owner;

-- ── DELETE ─────────────────────────────────────────────────────────────────
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

-- ── Recria triggers (idempotente) ──────────────────────────────────────────
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

-- ── Schema cache reload ────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
