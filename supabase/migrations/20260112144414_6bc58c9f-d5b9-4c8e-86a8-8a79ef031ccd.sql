-- Fix Security Definer View issue by using SECURITY INVOKER
DROP VIEW IF EXISTS public.client_social_credentials_decrypted;

CREATE VIEW public.client_social_credentials_decrypted 
WITH (security_invoker = true)
AS
SELECT 
  id,
  client_id,
  platform,
  public.decrypt_social_token(api_key_encrypted) as api_key,
  public.decrypt_social_token(api_secret_encrypted) as api_secret,
  public.decrypt_social_token(access_token_encrypted) as access_token,
  public.decrypt_social_token(access_token_secret_encrypted) as access_token_secret,
  public.decrypt_social_token(oauth_access_token_encrypted) as oauth_access_token,
  public.decrypt_social_token(oauth_refresh_token_encrypted) as oauth_refresh_token,
  expires_at,
  is_valid,
  last_validated_at,
  validation_error,
  account_name,
  account_id,
  metadata,
  created_at,
  updated_at
FROM public.client_social_credentials;

-- Grant access to the view
GRANT SELECT ON public.client_social_credentials_decrypted TO authenticated;
GRANT SELECT ON public.client_social_credentials_decrypted TO service_role;

-- FASE 2.2: Create secure function to get masked email for non-owners
CREATE OR REPLACE FUNCTION public.mask_email(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  at_pos INTEGER;
BEGIN
  IF email IS NULL THEN
    RETURN NULL;
  END IF;
  
  at_pos := position('@' in email);
  IF at_pos = 0 THEN
    RETURN email;
  END IF;
  
  local_part := substring(email FROM 1 FOR at_pos - 1);
  domain_part := substring(email FROM at_pos);
  
  -- Show first 2 chars, mask the rest, show domain
  IF length(local_part) <= 2 THEN
    RETURN local_part || '***' || domain_part;
  ELSE
    RETURN substring(local_part FROM 1 FOR 2) || '***' || domain_part;
  END IF;
END;
$$;

-- Create secure function to check if user can see full email
-- profiles.id is the user_id in this schema
CREATE OR REPLACE FUNCTION public.can_view_full_email(target_user_id UUID, viewer_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- User can see their own email
  IF target_user_id = viewer_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if viewer is workspace admin where target is a member
  RETURN EXISTS (
    SELECT 1 
    FROM workspace_members wm1
    JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = viewer_user_id 
      AND wm1.role = 'admin'
      AND wm2.user_id = target_user_id
  );
END;
$$;

-- Create a secure view for profiles that masks emails for non-owners/non-admins
-- Note: profiles.id IS the user_id (references auth.users.id)
CREATE OR REPLACE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  CASE 
    WHEN public.can_view_full_email(id, auth.uid()) THEN email
    ELSE public.mask_email(email)
  END as email,
  full_name,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the secure profiles view
GRANT SELECT ON public.profiles_secure TO authenticated;

-- Create a secure view for workspace invites that masks emails for non-admins
CREATE OR REPLACE VIEW public.workspace_invites_secure 
WITH (security_invoker = true)
AS
SELECT 
  wi.id,
  wi.workspace_id,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = wi.workspace_id 
        AND wm.user_id = auth.uid() 
        AND wm.role = 'admin'
    ) THEN wi.email
    ELSE public.mask_email(wi.email)
  END as email,
  wi.role,
  wi.invited_by,
  wi.created_at,
  wi.accepted_at
FROM public.workspace_invites wi
WHERE EXISTS (
  SELECT 1 FROM workspace_members wm 
  WHERE wm.workspace_id = wi.workspace_id 
    AND wm.user_id = auth.uid()
);

-- Grant access to the secure invites view
GRANT SELECT ON public.workspace_invites_secure TO authenticated;