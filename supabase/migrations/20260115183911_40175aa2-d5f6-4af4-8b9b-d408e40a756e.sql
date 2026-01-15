-- Fix RLS: Simplify INSERT policy to always allow authenticated users who are workspace members
-- The issue is that the function call within RLS context may not have proper permissions

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Members can create workspace clients" ON public.clients;

-- Create a simpler, more permissive INSERT policy that checks membership directly
CREATE POLICY "Members can create workspace clients" ON public.clients
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    -- User is a workspace member
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = clients.workspace_id
    )
    OR
    -- User is the workspace owner
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = clients.workspace_id
      AND w.owner_id = auth.uid()
    )
  )
);

-- Also ensure workspace_members and workspaces have proper SELECT policies for authenticated users
-- This is needed so the INSERT policy can check membership

-- Check if policies exist and create if not
DO $$
BEGIN
  -- Ensure authenticated users can read their own workspace memberships
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workspace_members' 
    AND policyname = 'Users can view their own memberships'
  ) THEN
    CREATE POLICY "Users can view their own memberships" ON public.workspace_members
    FOR SELECT USING (user_id = auth.uid());
  END IF;
  
  -- Ensure authenticated users can read workspaces they own or are members of
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workspaces' 
    AND policyname = 'Users can view accessible workspaces'
  ) THEN
    CREATE POLICY "Users can view accessible workspaces" ON public.workspaces
    FOR SELECT USING (
      owner_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm 
        WHERE wm.workspace_id = workspaces.id 
        AND wm.user_id = auth.uid()
      )
    );
  END IF;
END $$;