-- Tabela para associar clientes a convites pendentes
CREATE TABLE public.workspace_invite_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_id UUID NOT NULL REFERENCES public.workspace_invites(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (invite_id, client_id)
);

-- Enable RLS
ALTER TABLE public.workspace_invite_clients ENABLE ROW LEVEL SECURITY;

-- Policies: apenas owners/admins podem gerenciar
CREATE POLICY "Owners and admins can view invite clients"
ON public.workspace_invite_clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_invites wi
    JOIN workspace_members wm ON wm.workspace_id = wi.workspace_id
    WHERE wi.id = workspace_invite_clients.invite_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners and admins can create invite clients"
ON public.workspace_invite_clients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_invites wi
    JOIN workspace_members wm ON wm.workspace_id = wi.workspace_id
    WHERE wi.id = workspace_invite_clients.invite_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Owners and admins can delete invite clients"
ON public.workspace_invite_clients
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workspace_invites wi
    JOIN workspace_members wm ON wm.workspace_id = wi.workspace_id
    WHERE wi.id = workspace_invite_clients.invite_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  )
);

-- Atualizar o trigger para copiar clientes do convite para workspace_member_clients
CREATE OR REPLACE FUNCTION public.handle_workspace_invite_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite RECORD;
  v_member_id UUID;
BEGIN
  -- Check for pending invites for this email
  FOR v_invite IN 
    SELECT * FROM workspace_invites 
    WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now()
  LOOP
    -- Add user to workspace
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_invite.workspace_id, NEW.id, v_invite.role)
    ON CONFLICT (workspace_id, user_id) DO NOTHING
    RETURNING id INTO v_member_id;
    
    -- Copy client access from invite to member
    IF v_member_id IS NOT NULL THEN
      INSERT INTO workspace_member_clients (workspace_member_id, client_id)
      SELECT v_member_id, wic.client_id
      FROM workspace_invite_clients wic
      WHERE wic.invite_id = v_invite.id
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Mark invite as accepted
    UPDATE workspace_invites 
    SET accepted_at = now() 
    WHERE id = v_invite.id;
  END LOOP;
  
  RETURN NEW;
END;
$$;