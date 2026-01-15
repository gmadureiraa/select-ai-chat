-- Fix: allow creating profiles (clients) by using SECURITY DEFINER membership check
-- Current INSERT policy can evaluate to false because it depends on RLS-protected tables in subqueries.

DROP POLICY IF EXISTS "Members can create workspace clients" ON public.clients;

CREATE POLICY "Members can create workspace clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.is_workspace_member(auth.uid(), workspace_id)
  AND user_id = auth.uid()
);
