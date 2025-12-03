-- Create function to check if user can view workspace AI usage
CREATE OR REPLACE FUNCTION public.can_view_workspace_ai_usage(p_user_id uuid, p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User can always see their own usage
    p_user_id = p_target_user_id
    OR
    -- Admins/owners can see usage of workspace members
    EXISTS (
      SELECT 1 
      FROM workspace_members wm1
      JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = p_user_id 
      AND wm1.role IN ('owner', 'admin')
      AND wm2.user_id = p_target_user_id
    )
$$;

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own AI usage logs" ON public.ai_usage_logs;

-- Create new policy that allows admins to view workspace members' usage
CREATE POLICY "Users can view AI usage logs"
ON public.ai_usage_logs
FOR SELECT
USING (can_view_workspace_ai_usage(auth.uid(), user_id));