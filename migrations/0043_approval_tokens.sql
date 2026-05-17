-- 0043_approval_tokens.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Approval Flow — migração do store in-memory (Map<string, ApprovalToken>) em
-- `api/_lib/approval-flow.ts` para tabela Postgres compartilhada por todas as
-- instâncias Vercel.
--
-- PROBLEMA HISTÓRICO (motivação):
-- ─────────────────────────────────
-- A 1ª versão (MVP) guardava tokens num `Map` em memória de processo Node.
-- Vercel Functions são multi-instância: a request que gera o token
-- (deleteContent sem approved=true) pode cair na lambda A, e a re-call que
-- consome o token (deleteContent com approved=true + callbackToken) pode
-- cair na lambda B. B não tem o token no Map → `consumeApprovalToken` devolve
-- false → usuário vê "Token inválido" mesmo tendo acabado de confirmar no
-- modal. Pior: tokens nunca vazam (single-use por design) mas viram dead
-- weight na lambda A até expirar (5min).
--
-- SOLUÇÃO: tabela Postgres com single-use consume atômico via UPDATE ... RETURNING.
-- TTL curto (5min) + cleanup cron diário evita inchaço.
--
-- SCHEMA:
--   id           uuid PK (vira o token devolvido pra UI, prefixado `appr_<uuid>`)
--   action       text (`delete_content`, `delete_task`, `delete_automation` etc)
--   payload      jsonb (args originais — pra debug/auditoria)
--   created_by   uuid → auth.users (RLS scope: user só vê próprios tokens)
--   workspace_id uuid (opcional — pra auditoria cross-workspace)
--   created_at   timestamptz
--   expires_at   timestamptz NOT NULL (default = NOW() + 5min, set pelo caller)
--   consumed_at  timestamptz (NULL = ainda válido; NOT NULL = já consumido)
--
-- INVARIANTES:
--   - Token é consumido AT MOST ONCE (UPDATE ... WHERE consumed_at IS NULL
--     RETURNING — atomic, race-free entre lambdas).
--   - Token é válido por exatamente o intervalo entre created_at e expires_at.
--   - Token só funciona se a 2ª chamada usar o mesmo `action` da 1ª (anti-injection).
--   - RLS bloqueia user A de ler tokens de user B via Data API.
--
-- CLEANUP:
--   Cron diário `cron-approval-tokens-cleanup` deleta rows com
--   expires_at < NOW() - INTERVAL '1 day'. Mantém histórico de 1 dia pós-expiry
--   pra debug forense (suspeita de tentativa de replay attack etc).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.approval_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action       text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz
);

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Hot path do cleanup cron — encontrar tokens ainda válidos perto do TTL.
CREATE INDEX IF NOT EXISTS idx_approval_tokens_expires
  ON public.approval_tokens (expires_at)
  WHERE consumed_at IS NULL;

-- Auditoria — quantos requireApproval('delete_content') foram emitidos
-- nas últimas 24h? Útil pra detectar abuse pattern.
CREATE INDEX IF NOT EXISTS idx_approval_tokens_action
  ON public.approval_tokens (action, created_at DESC);

-- Lookup por owner (caso UI no futuro mostre "approvals pendentes de você").
CREATE INDEX IF NOT EXISTS idx_approval_tokens_created_by
  ON public.approval_tokens (created_by, created_at DESC)
  WHERE consumed_at IS NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- O backend (pool admin) bypassa RLS via service-role, então requireApproval
-- e consumeApprovalToken funcionam direto. RLS só protege contra LEAKS via
-- Data API/PostgREST (caso a tabela seja exposta) — user A não enxerga
-- tokens de user B.
--
-- Não criamos policy INSERT/UPDATE/DELETE pra `authenticated` — só o backend
-- (admin role) escreve. Se algum dia precisar UI direta, abrir outra
-- migration explícita.

ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_tokens_owner_select ON public.approval_tokens;
CREATE POLICY approval_tokens_owner_select
  ON public.approval_tokens
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- ── Schema cache reload (PostgREST/Neon Data API) ──────────────────────────
NOTIFY pgrst, 'reload schema';
