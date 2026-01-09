
-- Fix the add_workspace_member_or_invite function to properly cast role to workspace_role enum
CREATE OR REPLACE FUNCTION public.add_workspace_member_or_invite(
  p_workspace_id uuid, 
  p_email text, 
  p_role text, 
  p_invited_by uuid, 
  p_client_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_user_id UUID;
  v_member_id UUID;
  v_invite_id UUID;
  v_client_id UUID;
BEGIN
  -- Normalize email
  p_email := lower(trim(p_email));
  
  -- Check if user already exists in profiles
  SELECT id INTO v_existing_user_id 
  FROM profiles 
  WHERE lower(email) = p_email;
  
  -- If user exists, add them directly as a member
  IF v_existing_user_id IS NOT NULL THEN
    -- Check if already a member
    SELECT id INTO v_member_id
    FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = v_existing_user_id;
    
    IF v_member_id IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'already_member', 'member_id', v_member_id);
    END IF;
    
    -- Add as member directly with proper cast to workspace_role
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (p_workspace_id, v_existing_user_id, p_role::workspace_role)
    RETURNING id INTO v_member_id;
    
    -- Add client access if provided
    IF p_client_ids IS NOT NULL AND array_length(p_client_ids, 1) > 0 THEN
      FOREACH v_client_id IN ARRAY p_client_ids
      LOOP
        INSERT INTO workspace_member_clients (workspace_member_id, client_id)
        VALUES (v_member_id, v_client_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
    
    RETURN jsonb_build_object('status', 'member_added', 'member_id', v_member_id, 'user_id', v_existing_user_id);
  END IF;
  
  -- User doesn't exist, create an invite with proper cast to workspace_role
  INSERT INTO workspace_invites (workspace_id, email, role, invited_by)
  VALUES (p_workspace_id, p_email, p_role::workspace_role, p_invited_by)
  ON CONFLICT (workspace_id, email) DO UPDATE SET
    role = (EXCLUDED.role)::workspace_role,
    invited_by = EXCLUDED.invited_by,
    created_at = now(),
    expires_at = now() + interval '7 days',
    accepted_at = NULL
  RETURNING id INTO v_invite_id;
  
  -- Add client access to invite if provided
  IF p_client_ids IS NOT NULL AND array_length(p_client_ids, 1) > 0 THEN
    -- Remove old client associations for this invite
    DELETE FROM workspace_invite_clients WHERE invite_id = v_invite_id;
    
    FOREACH v_client_id IN ARRAY p_client_ids
    LOOP
      INSERT INTO workspace_invite_clients (invite_id, client_id)
      VALUES (v_invite_id, v_client_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object('status', 'invite_created', 'invite_id', v_invite_id);
END;
$function$;
