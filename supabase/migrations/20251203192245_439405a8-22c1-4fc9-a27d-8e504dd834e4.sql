-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy that allows admins to view workspace members' profiles
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR
  EXISTS (
    SELECT 1 
    FROM workspace_members wm1
    JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid() 
    AND wm1.role IN ('owner', 'admin')
    AND wm2.user_id = profiles.id
  )
);