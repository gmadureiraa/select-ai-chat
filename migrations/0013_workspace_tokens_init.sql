-- 0013_workspace_tokens_init.sql
-- Fase F (Permissões + Plan Enforcement) — Inicializa workspace_tokens pra todos
-- workspaces existentes baseado no plano vigente, e adiciona função `debit_tokens`
-- que padroniza débito mensal (usado pelos handlers viral).
--
-- Schema atual já tem:
--   workspace_tokens(balance, tokens_used_this_period, period_start, period_end)
--   token_transactions(type token_transaction_type, amount, balance_after, ...)
--
-- Esta migration:
--   1. Adiciona coluna `monthly_quota` (cache do plan tier pro hook UI)
--   2. Inicializa rows pra workspaces sem registro (default 100 ou conforme plano)
--   3. Cria função `debit_tokens(workspace_id, amount, reason)` que:
--        - reseta `tokens_used_this_period` quando passou do `period_end`
--        - debita `balance` e incrementa `tokens_used_this_period`
--        - registra em `token_transactions` com type='usage'
--        - retorna jsonb {ok, remaining}

-- 1) Adicionar coluna monthly_quota (cacheada do plano)
ALTER TABLE public.workspace_tokens
  ADD COLUMN IF NOT EXISTS monthly_quota integer NOT NULL DEFAULT 100;

-- 2) Backfill monthly_quota a partir do plano vigente (se existe)
UPDATE public.workspace_tokens wt
SET monthly_quota = COALESCE(sp.tokens_monthly, 100)
FROM public.workspace_subscriptions ws
LEFT JOIN public.subscription_plans sp ON sp.id = ws.plan_id
WHERE ws.workspace_id = wt.workspace_id
  AND ws.status = 'active'
  AND wt.monthly_quota = 100;

-- 3) Criar registros pra workspaces sem entrada em workspace_tokens
INSERT INTO public.workspace_tokens (workspace_id, balance, monthly_quota, tokens_used_this_period, period_start, period_end)
SELECT
  w.id,
  COALESCE(sp.tokens_monthly, 100),
  COALESCE(sp.tokens_monthly, 100),
  0,
  date_trunc('month', now()),
  date_trunc('month', now()) + interval '1 month'
FROM public.workspaces w
LEFT JOIN public.workspace_subscriptions ws ON ws.workspace_id = w.id AND ws.status = 'active'
LEFT JOIN public.subscription_plans sp ON sp.id = ws.plan_id
ON CONFLICT (workspace_id) DO NOTHING;

-- 4) Função `debit_tokens` — débito padronizado com reset mensal automático
CREATE OR REPLACE FUNCTION public.debit_tokens(
  p_workspace_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'usage'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_used integer;
  v_quota integer;
  v_remaining integer;
  v_new_balance integer;
BEGIN
  -- Reset se passou do period_end (rollover mensal)
  UPDATE public.workspace_tokens
  SET tokens_used_this_period = 0,
      period_start = date_trunc('month', now()),
      period_end = date_trunc('month', now()) + interval '1 month',
      balance = monthly_quota,
      updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND period_end < now();

  -- Lock e ler estado atual
  SELECT balance, tokens_used_this_period, monthly_quota
    INTO v_balance, v_used, v_quota
  FROM public.workspace_tokens
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'workspace_tokens not found', 'remaining', 0);
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_tokens', 'remaining', GREATEST(0, v_quota - v_used));
  END IF;

  v_new_balance := v_balance - p_amount;

  -- Debit
  UPDATE public.workspace_tokens
  SET balance = v_new_balance,
      tokens_used_this_period = v_used + p_amount,
      updated_at = now()
  WHERE workspace_id = p_workspace_id;

  v_remaining := GREATEST(0, v_quota - (v_used + p_amount));

  -- Log na tabela de transações (token_transaction_type aceita 'usage')
  INSERT INTO public.token_transactions (workspace_id, type, amount, balance_after, description)
  VALUES (p_workspace_id, 'usage', -p_amount, v_new_balance, p_reason);

  RETURN jsonb_build_object('ok', true, 'remaining', v_remaining, 'balance', v_new_balance);
END $$;

GRANT EXECUTE ON FUNCTION public.debit_tokens(uuid, integer, text) TO authenticated, service_role;

-- 5) Função leve de check (sem lock, retorna remaining mensal e balance)
CREATE OR REPLACE FUNCTION public.check_tokens(
  p_workspace_id uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'remaining', GREATEST(0, monthly_quota - tokens_used_this_period),
    'used', tokens_used_this_period,
    'quota', monthly_quota,
    'balance', balance
  )
  FROM public.workspace_tokens
  WHERE workspace_id = p_workspace_id;
$$;

GRANT EXECUTE ON FUNCTION public.check_tokens(uuid) TO authenticated, service_role;
