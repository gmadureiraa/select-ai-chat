-- Fix overly permissive RLS policies on planning_automation_runs
-- These policies allow ANY authenticated user to insert/update, which is a security risk

-- Drop the problematic policies
DROP POLICY IF EXISTS "Service role can insert runs" ON public.planning_automation_runs;
DROP POLICY IF EXISTS "Service role can update runs" ON public.planning_automation_runs;

-- Recreate with proper restrictions - only service_role should be able to insert/update
-- Using a function approach to check service role or workspace membership

CREATE POLICY "Service role can insert automation runs"
ON public.planning_automation_runs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update automation runs"
ON public.planning_automation_runs
FOR UPDATE
TO service_role
USING (true);

-- Also add policies for workspace members to be able to insert/update their own runs
CREATE POLICY "Workspace members can insert runs"
ON public.planning_automation_runs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM planning_automations pa
    JOIN workspace_members wm ON wm.workspace_id = pa.workspace_id
    WHERE pa.id = automation_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace members can update runs"
ON public.planning_automation_runs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM planning_automations pa
    JOIN workspace_members wm ON wm.workspace_id = pa.workspace_id
    WHERE pa.id = automation_id
    AND wm.user_id = auth.uid()
  )
);