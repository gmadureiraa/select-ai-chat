-- Fix: allow updating clients a user can access (previous policy relied on get_user_workspace_id and was blocking updates)

DROP POLICY IF EXISTS "Members can update workspace clients" ON public.clients;

CREATE POLICY "Members can update accessible clients"
ON public.clients
FOR UPDATE
USING (can_access_client(auth.uid(), id))
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
