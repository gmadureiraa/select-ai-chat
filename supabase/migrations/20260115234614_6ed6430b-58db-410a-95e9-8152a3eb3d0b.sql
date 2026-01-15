-- Fix: Remove user_id check from INSERT policy (default handles it)
DROP POLICY IF EXISTS "Members can create workspace clients" ON public.clients;

CREATE POLICY "Members can create workspace clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_workspace_member(auth.uid(), workspace_id)
);