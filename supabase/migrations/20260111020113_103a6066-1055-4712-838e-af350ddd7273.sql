-- Fix SECURITY DEFINER functions with proper authorization checks

-- 1. Fix debit_workspace_tokens - Verify caller is a workspace member
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
    v_effective_user_id UUID;
BEGIN
    -- Use provided user_id or fall back to auth.uid()
    v_effective_user_id := COALESCE(p_user_id, auth.uid());
    
    -- SECURITY CHECK: Verify the caller is a member of the workspace
    IF NOT EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = p_workspace_id 
        AND user_id = v_effective_user_id
    ) THEN
        RETURN QUERY SELECT false, 0, 'Unauthorized: Not a workspace member'::TEXT;
        RETURN;
    END IF;
    
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
    VALUES (p_workspace_id, v_effective_user_id, 'usage', -p_amount, v_new_balance, p_description, p_metadata);
    
    RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- 2. Fix create_workspace_with_subscription - Verify owner_id matches caller
CREATE OR REPLACE FUNCTION public.create_workspace_with_subscription(
    p_name TEXT,
    p_slug TEXT,
    p_owner_id UUID,
    p_owner_full_name TEXT DEFAULT NULL
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
    -- SECURITY CHECK: Verify the caller is creating a workspace for themselves
    IF p_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Cannot create workspace for another user';
    END IF;

    -- Get the starter plan
    SELECT id, tokens_monthly INTO v_plan_id, v_tokens
    FROM subscription_plans
    WHERE type = 'starter'
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'Starter plan not found';
    END IF;

    -- Create workspace
    INSERT INTO workspaces (name, slug, owner_id)
    VALUES (p_name, p_slug, p_owner_id)
    RETURNING id INTO v_workspace_id;

    -- Create subscription with 14-day trial
    INSERT INTO workspace_subscriptions (
        workspace_id,
        plan_id,
        status,
        trial_ends_at,
        current_period_start,
        current_period_end
    )
    VALUES (
        v_workspace_id,
        v_plan_id,
        'trialing',
        NOW() + INTERVAL '14 days',
        NOW(),
        NOW() + INTERVAL '14 days'
    );

    -- Initialize tokens
    INSERT INTO workspace_tokens (workspace_id, balance, monthly_allowance)
    VALUES (v_workspace_id, v_tokens, v_tokens);

    -- Add owner as workspace member
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_owner_id, 'owner');

    -- Create profile if not exists
    INSERT INTO profiles (id, full_name)
    VALUES (p_owner_id, COALESCE(p_owner_full_name, 'Usuário'))
    ON CONFLICT (id) DO NOTHING;

    RETURN v_workspace_id;
END;
$$;

-- 3. Fix create_workspace_with_paid_subscription - Verify owner_id matches caller
CREATE OR REPLACE FUNCTION public.create_workspace_with_paid_subscription(
    p_name TEXT,
    p_slug TEXT,
    p_owner_id UUID,
    p_plan_type TEXT,
    p_stripe_subscription_id TEXT,
    p_stripe_customer_id TEXT
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
    -- SECURITY CHECK: Verify the caller is creating a workspace for themselves
    IF p_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Cannot create workspace for another user';
    END IF;

    -- Validate slug is available
    IF EXISTS (SELECT 1 FROM workspaces WHERE slug = p_slug) THEN
        RAISE EXCEPTION 'Slug already in use';
    END IF;

    -- Get the selected plan
    SELECT id, tokens_monthly INTO v_plan_id, v_tokens
    FROM subscription_plans
    WHERE type = p_plan_type
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'Plan not found: %', p_plan_type;
    END IF;

    -- Create workspace
    INSERT INTO workspaces (name, slug, owner_id)
    VALUES (p_name, p_slug, p_owner_id)
    RETURNING id INTO v_workspace_id;

    -- Create subscription with Stripe info (14-day trial)
    INSERT INTO workspace_subscriptions (
        workspace_id,
        plan_id,
        status,
        stripe_subscription_id,
        stripe_customer_id,
        trial_ends_at,
        current_period_start,
        current_period_end
    )
    VALUES (
        v_workspace_id,
        v_plan_id,
        'trialing',
        p_stripe_subscription_id,
        p_stripe_customer_id,
        NOW() + INTERVAL '14 days',
        NOW(),
        NOW() + INTERVAL '14 days'
    );

    -- Initialize tokens
    INSERT INTO workspace_tokens (workspace_id, balance, monthly_allowance)
    VALUES (v_workspace_id, v_tokens, v_tokens);

    -- Add owner as workspace member
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_owner_id, 'owner');

    RETURN v_workspace_id;
END;
$$;