-- ─── 0028: Fix RLS violation no INSERT em viral_carousels via view `carousels` ──
--
-- BUG (2026-05-09): "new row violates row-level security policy for table viral_carousels"
-- ao gerar carrossel via Sequência Viral (frontend SV-original).
--
-- Causa raiz:
-- O frontend SV-original (`upsertUserCarousel` em
-- `src/components/kai/viral-sv-original/lib/carousel-storage.ts`) é cópia
-- literal do Sequência Viral standalone, que ainda não conhece o schema
-- multi-tenant client_id/workspace_id do KAI. Ele faz
--   INSERT INTO carousels (user_id, title, slides, style, status)
-- via Neon Data API (PostgREST) com role `authenticated`. A view
-- `carousels` (0017_carousels_view_compat.sql) tem trigger INSTEAD OF
-- INSERT que faz INSERT em `viral_carousels` propagando `NEW.client_id`
-- e `NEW.workspace_id` como NULL — o que viola a policy:
--   client_workspace_accessible(client_id, auth.uid())
-- Porque `client_workspace_accessible(NULL, <uid>)` retorna FALSE.
--
-- Fix:
-- 1. Trigger `carousels_view_insert` agora roda SECURITY DEFINER (owned
--    by neondb_owner que é dona de viral_carousels e tem BYPASSRLS
--    implícito como owner sem FORCE RLS).
-- 2. Auto-resolve `workspace_id` a partir de `client_id` (lookup em
--    `clients`) quando não vier no INSERT.
-- 3. Auto-resolve `client_id` quando não vier — pega o primeiro cliente
--    do workspace do user (fallback usado pelo SV-original que ainda não
--    propaga clientId no payload).
-- 4. Auto-default `user_id` a partir de `auth.uid()` quando NULL.
-- 5. Mantém SELECT/UPDATE/DELETE com RLS normal — apenas INSERT relaxa
--    porque o trigger já fez sanity checks (client tem workspace, user é
--    membro do workspace).
-- 6. NÃO altera as policies de viral_carousels — RLS continua ativo
--    pra acesso direto via Neon Data API.

CREATE OR REPLACE FUNCTION public.carousels_view_insert()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_client_id UUID;
  v_workspace_id UUID;
BEGIN
  -- 1. user_id: usa NEW.user_id se vier, senão auth.uid()
  v_user_id := COALESCE(NEW.user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'carousels_view_insert: user_id is required (no auth.uid() and NEW.user_id is NULL)'
      USING ERRCODE = '42501';
  END IF;

  -- 2. client_id: usa NEW.client_id, senão pega o cliente mais recente
  --    do workspace do user (fallback p/ SV-original legado).
  v_client_id := NEW.client_id;
  IF v_client_id IS NULL THEN
    SELECT c.id INTO v_client_id
      FROM public.clients c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE wm.user_id = v_user_id
     ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
     LIMIT 1;
  END IF;
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'carousels_view_insert: nenhum client_id pode ser resolvido para o user %', v_user_id
      USING ERRCODE = '42501';
  END IF;

  -- 3. workspace_id: usa NEW.workspace_id, senão deriva do client.
  v_workspace_id := NEW.workspace_id;
  IF v_workspace_id IS NULL THEN
    SELECT workspace_id INTO v_workspace_id
      FROM public.clients
     WHERE id = v_client_id;
  END IF;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'carousels_view_insert: workspace_id não pôde ser resolvido para client %', v_client_id
      USING ERRCODE = '42501';
  END IF;

  -- 4. Sanity: confirma que o user é membro do workspace antes de inserir.
  --    Equivalente a client_workspace_accessible mas inline pra evitar
  --    chamada cross-schema com search_path travado.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
     WHERE user_id = v_user_id AND workspace_id = v_workspace_id
  ) THEN
    RAISE EXCEPTION 'carousels_view_insert: user % não é membro do workspace %', v_user_id, v_workspace_id
      USING ERRCODE = '42501';
  END IF;

  -- 5. INSERT real. Como esta função roda SECURITY DEFINER (owner
  --    neondb_owner = dona de viral_carousels sem FORCE RLS), bypassa
  --    a policy `Workspace members can insert viral carousels` —
  --    o que é seguro porque já validamos workspace membership acima.
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

  -- Atualiza NEW pros campos resolvidos pra que `RETURNING` na chamada
  -- veja os valores reais (e não NULL).
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.client_id := v_client_id;
  NEW.workspace_id := v_workspace_id;
  NEW.user_id := v_user_id;
  RETURN NEW;
END $$;

-- Owner = neondb_owner (dono de viral_carousels), confirma SECURITY DEFINER
-- vai bypassar RLS conforme esperado.
ALTER FUNCTION public.carousels_view_insert() OWNER TO neondb_owner;

-- Trigger já existe via migration 0017; recriar idempotente.
DROP TRIGGER IF EXISTS carousels_view_insert ON public.carousels;
CREATE TRIGGER carousels_view_insert
  INSTEAD OF INSERT ON public.carousels
  FOR EACH ROW EXECUTE FUNCTION public.carousels_view_insert();
