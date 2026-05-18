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
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ HISTÓRICO DO BUG (2026-05-10): essa migration definia
-- carousels_view_insert SEM SECURITY DEFINER. As migrations 0028 e 0037
-- corrigiram. MAS se algum dev rodar `psql -f 0017_*.sql` standalone
-- (reseed parcial, debugging, etc), regrediria pro estado quebrado e
-- quebraria insert de carrosseis em produção com
-- "new row violates row-level security policy for table viral_carousels".
--
-- FIX (2026-05-16): cada `CREATE OR REPLACE FUNCTION` agora é wrapped
-- num DO block que CHECA `prosecdef` antes. Se a versão SECURITY DEFINER
-- já existe (0028/0037 aplicada), pula a recriação.
--
-- FIX (2026-05-18): a VIEW em si TAMBÉM precisa de blindagem. A 0047
-- aplicou `SET (security_invoker = true)` pra fechar bypass de RLS via
-- anon. Se 0017 re-rodar (reseed) sem `WITH (security_invoker = true)`,
-- o atributo volta pro default (false / security_definer mode), abrindo
-- o bug de novo. Agora a CREATE OR REPLACE VIEW já vem com o flag certo.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.carousels
WITH (security_invoker = true) AS
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
-- ── GUARD ──────────────────────────────────────────────────────────────
-- Só re-cria as funções se a versão SECURITY DEFINER da 0028/0037 NÃO existe.

DO $guard_insert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'carousels_view_insert'
       AND pronamespace = 'public'::regnamespace
       AND prosecdef = true
  ) THEN
    RAISE NOTICE '[0017] carousels_view_insert já é SECURITY DEFINER — pulando recriação';
    RETURN;
  END IF;

  -- Versão original (NÃO SECURITY DEFINER). Só usada se 0028/0037 ainda
  -- não rodou. Reseed depois de 0028/0037 NÃO derruba o fix.
  CREATE OR REPLACE FUNCTION public.carousels_view_insert()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
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
  END $fn$;
END $guard_insert$;

DO $guard_update$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'carousels_view_update'
       AND pronamespace = 'public'::regnamespace
       AND prosecdef = true
  ) THEN
    RAISE NOTICE '[0017] carousels_view_update já é SECURITY DEFINER — pulando recriação';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.carousels_view_update()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
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
  END $fn$;
END $guard_update$;

DO $guard_delete$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'carousels_view_delete'
       AND pronamespace = 'public'::regnamespace
       AND prosecdef = true
  ) THEN
    RAISE NOTICE '[0017] carousels_view_delete já é SECURITY DEFINER — pulando recriação';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.carousels_view_delete()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  BEGIN
    DELETE FROM public.viral_carousels WHERE id = OLD.id;
    RETURN OLD;
  END $fn$;
END $guard_delete$;

-- Triggers são idempotentes em CREATE TRIGGER porque DROP IF EXISTS prevê.
-- E não importa qual versão da função existe — o trigger só aponta pro nome,
-- e a função (já guardada acima) preserva sua versão correta.

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

-- Permissões na view: herdam policies da tabela base. Habilita acesso
-- via PostgREST/Neon Data API.
--
-- ⚠️ HARDENING (0047, 2026-05-18): anon NUNCA deve ter acesso. View deve ser
-- security_invoker. Se essa migration rodar standalone depois da 0047,
-- regrediria. Guard abaixo só re-grant se 0047 NÃO foi aplicada.
DO $guard_grants$
BEGIN
  IF EXISTS (
    SELECT 1 FROM __migrations_applied WHERE id = '0047_view_carousels_security_invoker'
  ) THEN
    RAISE NOTICE '[0017] 0047 já hardened — pulando grants antigos (anon = deny)';
    -- Re-aplica o estado hardened pra garantir
    ALTER VIEW public.carousels SET (security_invoker = true);
    BEGIN
      REVOKE ALL ON public.carousels FROM anon;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO service_role;
  ELSE
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO authenticated, anon;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- __migrations_applied não existe ainda (primeira aplicação) — segue grant original.
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO authenticated, anon;
END $guard_grants$;
