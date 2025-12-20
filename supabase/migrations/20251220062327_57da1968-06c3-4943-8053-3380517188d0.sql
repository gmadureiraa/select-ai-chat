-- Drop existing select policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Create new policy: users can view their own profile OR admins/owners can view all profiles
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  -- Can always view own profile
  auth.uid() = id
  OR
  -- Admins and owners can view all profiles (for team management)
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);