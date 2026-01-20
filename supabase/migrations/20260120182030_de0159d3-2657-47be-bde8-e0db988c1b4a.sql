-- Remove duplicate INSERT policies on clients table
DROP POLICY IF EXISTS "Members can create workspace clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create clients in their workspace" ON public.clients;

-- Create a single clear INSERT policy using security definer function
CREATE POLICY "Workspace members can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_workspace_member(auth.uid(), workspace_id)
);