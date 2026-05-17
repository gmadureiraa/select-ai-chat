-- Mirror de migrations/0043_approval_tokens.sql para o tracking Supabase CLI.
-- Ver migration canônica pra contexto/motivação completos.

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

CREATE INDEX IF NOT EXISTS idx_approval_tokens_expires
  ON public.approval_tokens (expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_tokens_action
  ON public.approval_tokens (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_tokens_created_by
  ON public.approval_tokens (created_by, created_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_tokens_owner_select ON public.approval_tokens;
CREATE POLICY approval_tokens_owner_select
  ON public.approval_tokens
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

NOTIFY pgrst, 'reload schema';
