-- Fix create_workspace_with_subscription to use 'starter' plan instead of non-existent 'free'
-- Also create new function for paid workspace creation

-- 1. Fix the existing function to default to 'starter' plan with trial
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
    -- Get the starter plan (was incorrectly looking for 'free')
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

-- 2. Create new function for workspace with paid subscription (after Stripe checkout)
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