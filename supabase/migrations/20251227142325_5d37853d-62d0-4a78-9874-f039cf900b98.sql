-- Drop existing delete policy for clients
DROP POLICY IF EXISTS "Only owners and admins can delete clients" ON public.clients;

-- Create corrected delete policy that checks the client's actual workspace
CREATE POLICY "Only owners and admins can delete clients"
ON public.clients FOR DELETE
USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND can_delete_in_specific_workspace(auth.uid(), workspace_id)
);