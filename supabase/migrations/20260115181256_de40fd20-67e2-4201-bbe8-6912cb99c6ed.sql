-- Fix the RLS policy for inserting clients
-- The current policy uses get_user_workspace_id which gets the first workspace,
-- but should allow inserting into any workspace the user is a member of

DROP POLICY IF EXISTS "Members can create workspace clients" ON public.clients;

CREATE POLICY "Members can create workspace clients"
ON public.clients
FOR INSERT
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));