-- 0047_view_carousels_security_invoker.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- BUG (auditoria 2026-05-18 / Super Audit Codex):
--   public.carousels view foi criada SEM security_invoker (default no PG 15+
--   é security_definer pra views). Combined com GRANT SELECT TO anon (linha
--   183 da 0017_carousels_view_compat.sql), `anon` pode rodar SELECT na view
--   bypassando RLS de viral_carousels — equivalente a ler todos carrosseis
--   de todos workspaces sem JWT.
--
--   Mesma vulnerabilidade pra INSERT/UPDATE/DELETE via view: triggers
--   INSTEAD OF rodam SECURITY DEFINER (owner=neondb_owner), validam
--   workspace_members via auth.uid(). Quando role=anon sem JWT,
--   auth.uid()=NULL e validação manual passa (busca pelo primeiro workspace).
--
-- FIX:
--   1. ALTER VIEW SET (security_invoker = true) — SELECT respeita RLS do invoker.
--   2. REVOKE ALL ON public.carousels FROM anon — defesa em profundidade.
--   3. GRANT explícito mínimo pra authenticated + service_role.
--
-- TESTE PÓS-APPLY:
--   -- Como anon (sem JWT): deve dar permission denied
--   SET ROLE anon; SELECT * FROM public.carousels LIMIT 1; -- ERROR esperado
--   RESET ROLE;
--
--   -- Como authenticated com JWT válido: vê só os do workspace dele
--   SET ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<user_uuid>"}', true);
--   SELECT id, workspace_id FROM public.carousels;
--
-- Aplicado: 2026-05-18
-- ═══════════════════════════════════════════════════════════════════════════

ALTER VIEW public.carousels SET (security_invoker = true);

-- Defesa em profundidade: anon nunca deveria tocar essa view, mesmo com
-- security_invoker (RLS bloquearia, mas o privilégio acessar a view base
-- ainda existiria — REVOKE remove totalmente).
REVOKE ALL ON public.carousels FROM anon;

-- Restaura grants mínimos pra authenticated (RLS na tabela base decide o que vê)
-- e service_role (cron jobs internos com SUPABASE_SERVICE_ROLE_KEY).
-- neondb_owner já tem tudo como dono.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carousels TO service_role;

-- Schema cache reload pro PostgREST/Neon Data API
NOTIFY pgrst, 'reload schema';
