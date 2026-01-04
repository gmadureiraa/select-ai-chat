-- Fix: Restrict workspace subscription data to owners and admins only
-- This prevents regular members and viewers from seeing billing/Stripe data

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Members can view workspace subscription" ON workspace_subscriptions;

-- Create new restrictive policy - only owners and admins can view subscription data
CREATE POLICY "Owners and admins can view workspace subscription"
  ON workspace_subscriptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_subscriptions.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  ));