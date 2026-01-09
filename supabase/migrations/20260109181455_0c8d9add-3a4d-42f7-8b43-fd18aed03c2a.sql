-- Create function to accept pending invites for existing users
CREATE OR REPLACE FUNCTION public.accept_pending_invite(
  p_workspace_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_member_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Find pending invite for this user/workspace
  SELECT * INTO v_invite FROM workspace_invites 
  WHERE email = v_user_email 
    AND workspace_id = p_workspace_id
    AND accepted_at IS NULL 
    AND expires_at > now();
  
  IF v_invite IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Add user to workspace members
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, p_user_id, v_invite.role)
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
  UPDATE workspace_invites SET accepted_at = now() WHERE id = v_invite.id;
  
  RETURN TRUE;
END;
$$;