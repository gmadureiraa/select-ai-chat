-- =============================================
-- FASE 1: Adicionar slug e campos ao workspaces
-- =============================================

-- Adicionar colunas ao workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Criar índice para busca rápida por slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- Atualizar workspace Kaleidos com slug
UPDATE workspaces 
SET slug = 'kaleidos' 
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- =============================================
-- FASE 2: Criar tipos ENUM
-- =============================================

-- Tipo de plano
DO $$ BEGIN
    CREATE TYPE plan_type AS ENUM ('free', 'starter', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status da assinatura
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipo de transação de token
DO $$ BEGIN
    CREATE TYPE token_transaction_type AS ENUM (
        'subscription_credit',
        'purchase',
        'usage',
        'refund',
        'bonus',
        'adjustment'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- FASE 3: Tabela de Planos
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type plan_type NOT NULL UNIQUE,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
    tokens_monthly INTEGER NOT NULL DEFAULT 0,
    max_clients INTEGER NOT NULL DEFAULT 1,
    max_members INTEGER NOT NULL DEFAULT 1,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para subscription_plans (leitura pública para authenticated)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON subscription_plans FOR SELECT
TO authenticated
USING (is_active = true);

-- Inserir planos padrão
INSERT INTO subscription_plans (name, type, price_monthly, price_yearly, tokens_monthly, max_clients, max_members, features) VALUES
('Gratuito', 'free', 0, 0, 1000, 2, 1, '["chat_basico", "1_cliente"]'),
('Starter', 'starter', 97, 970, 10000, 5, 3, '["chat_avancado", "automacoes_basicas", "5_clientes"]'),
('Pro', 'pro', 297, 2970, 50000, 20, 10, '["tudo_starter", "automacoes_avancadas", "api_access", "20_clientes"]'),
('Enterprise', 'enterprise', 0, 0, 0, 0, 0, '["ilimitado", "suporte_dedicado", "white_label"]')
ON CONFLICT (type) DO NOTHING;

-- =============================================
-- FASE 4: Tabela de Assinaturas
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status subscription_status NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    cancel_at_period_end BOOLEAN DEFAULT false,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id)
);

ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace subscription"
ON workspace_subscriptions FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Only owners can update subscription"
ON workspace_subscriptions FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
));

CREATE POLICY "System can insert subscriptions"
ON workspace_subscriptions FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
));

-- =============================================
-- FASE 5: Tabela de Tokens
-- =============================================

CREATE TABLE IF NOT EXISTS workspace_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    tokens_used_this_period INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id)
);

ALTER TABLE workspace_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace tokens"
ON workspace_tokens FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "System can insert tokens"
ON workspace_tokens FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
));

CREATE POLICY "System can update tokens"
ON workspace_tokens FOR UPDATE
USING (is_workspace_member(auth.uid(), workspace_id));

-- =============================================
-- FASE 6: Tabela de Transações de Token
-- =============================================

CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    type token_transaction_type NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace transactions"
ON token_transactions FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "System can insert transactions"
ON token_transactions FOR INSERT
TO authenticated
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX IF NOT EXISTS idx_token_transactions_workspace ON token_transactions(workspace_id, created_at DESC);

-- =============================================
-- FASE 7: Funções de Banco
-- =============================================

-- Função para debitar tokens
CREATE OR REPLACE FUNCTION debit_workspace_tokens(
    p_workspace_id UUID,
    p_amount INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT 'AI usage',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    SELECT balance INTO v_current_balance
    FROM workspace_tokens
    WHERE workspace_id = p_workspace_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN QUERY SELECT false, 0, 'Workspace tokens not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT false, v_current_balance, 'Insufficient tokens'::TEXT;
        RETURN;
    END IF;
    
    v_new_balance := v_current_balance - p_amount;
    
    UPDATE workspace_tokens
    SET balance = v_new_balance,
        tokens_used_this_period = tokens_used_this_period + p_amount,
        updated_at = now()
    WHERE workspace_id = p_workspace_id;
    
    INSERT INTO token_transactions (workspace_id, user_id, type, amount, balance_after, description, metadata)
    VALUES (p_workspace_id, p_user_id, 'usage', -p_amount, v_new_balance, p_description, p_metadata);
    
    RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- Função para obter slug do workspace do usuário
CREATE OR REPLACE FUNCTION get_user_workspace_slug(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT w.slug 
    FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = p_user_id
    LIMIT 1;
$$;

-- Função para validar slug único
CREATE OR REPLACE FUNCTION is_slug_available(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM workspaces WHERE slug = lower(p_slug)
    );
$$;

-- Função para criar workspace completo com subscription e tokens
CREATE OR REPLACE FUNCTION create_workspace_with_subscription(
    p_name TEXT,
    p_slug TEXT,
    p_owner_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id UUID;
    v_plan_id UUID;
    v_tokens INTEGER;
BEGIN
    -- Criar workspace
    INSERT INTO workspaces (name, slug, owner_id)
    VALUES (p_name, lower(p_slug), p_owner_id)
    RETURNING id INTO v_workspace_id;
    
    -- Adicionar owner como membro
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_owner_id, 'owner');
    
    -- Buscar plano free
    SELECT id, tokens_monthly INTO v_plan_id, v_tokens
    FROM subscription_plans
    WHERE type = 'free'
    LIMIT 1;
    
    -- Criar assinatura
    INSERT INTO workspace_subscriptions (workspace_id, plan_id, current_period_end)
    VALUES (v_workspace_id, v_plan_id, now() + interval '30 days');
    
    -- Criar tokens iniciais
    INSERT INTO workspace_tokens (workspace_id, balance, period_end)
    VALUES (v_workspace_id, v_tokens, now() + interval '30 days');
    
    -- Registrar transação de crédito inicial
    INSERT INTO token_transactions (workspace_id, user_id, type, amount, balance_after, description)
    VALUES (v_workspace_id, p_owner_id, 'subscription_credit', v_tokens, v_tokens, 'Crédito inicial do plano');
    
    RETURN v_workspace_id;
END;
$$;

-- =============================================
-- FASE 8: Permitir criação de workspace
-- =============================================

CREATE POLICY "Users can create their own workspace"
ON workspaces FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- =============================================
-- FASE 9: Setup do Workspace Kaleidos
-- =============================================

-- Criar assinatura enterprise para Kaleidos
INSERT INTO workspace_subscriptions (workspace_id, plan_id, current_period_end)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    (SELECT id FROM subscription_plans WHERE type = 'enterprise'),
    now() + interval '100 years'
ON CONFLICT (workspace_id) DO NOTHING;

-- Criar tokens ilimitados para Kaleidos
INSERT INTO workspace_tokens (workspace_id, balance, period_end)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    999999999,
    now() + interval '100 years'
)
ON CONFLICT (workspace_id) DO NOTHING;