-- =====================================================
-- Security Fix Migration: RLS Policies for Views & Tables
-- =====================================================

-- 1. FIX: client_social_credentials_decrypted view
-- The view was created with security_invoker=true but no RLS policies
-- We need to recreate it as a SECURITY DEFINER function instead
-- because PostgreSQL views cannot have RLS policies directly

-- Drop the old view and create a secure function instead
DROP VIEW IF EXISTS client_social_credentials_decrypted;

-- Create a secure function that checks workspace membership before returning credentials
CREATE OR REPLACE FUNCTION get_client_social_credentials_decrypted(p_client_id UUID)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  platform TEXT,
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  access_token_secret TEXT,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  account_id TEXT,
  account_name TEXT,
  is_valid BOOLEAN,
  last_validated_at TIMESTAMPTZ,
  validation_error TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller has access to this client's workspace
  IF NOT client_workspace_accessible(p_client_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: You do not have access to this client';
  END IF;
  
  RETURN QUERY
  SELECT 
    csc.id,
    csc.client_id,
    csc.platform,
    decrypt_credential(csc.api_key_encrypted) as api_key,
    decrypt_credential(csc.api_secret_encrypted) as api_secret,
    decrypt_credential(csc.access_token_encrypted) as access_token,
    decrypt_credential(csc.access_token_secret_encrypted) as access_token_secret,
    decrypt_credential(csc.oauth_access_token_encrypted) as oauth_access_token,
    decrypt_credential(csc.oauth_refresh_token_encrypted) as oauth_refresh_token,
    csc.account_id,
    csc.account_name,
    csc.is_valid,
    csc.last_validated_at,
    csc.validation_error,
    csc.expires_at,
    csc.created_at,
    csc.updated_at
  FROM client_social_credentials csc
  WHERE csc.client_id = p_client_id;
END;
$$;

-- Grant execute only to authenticated users (they must pass the workspace check)
REVOKE ALL ON FUNCTION get_client_social_credentials_decrypted(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_client_social_credentials_decrypted(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_social_credentials_decrypted(UUID) TO service_role;

-- 2. FIX: profiles table RLS policy
-- Current policy allows any admin to see ALL profiles
-- Need to restrict to profiles within their workspace only

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by workspace admins" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by same workspace members" ON profiles;

-- Create new restricted SELECT policies
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view profiles of members in their workspace"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm1
    JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid()
    AND wm2.user_id = profiles.id
  )
);

-- 3. FIX: profiles_secure view
-- Drop the view and recreate with proper security
DROP VIEW IF EXISTS profiles_secure;

-- Create a secure function instead of a view
CREATE OR REPLACE FUNCTION get_workspace_member_profiles(p_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is a member of this workspace
  IF NOT is_workspace_member(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: You are not a member of this workspace';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.avatar_url
  FROM profiles p
  JOIN workspace_members wm ON wm.user_id = p.id
  WHERE wm.workspace_id = p_workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION get_workspace_member_profiles(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_workspace_member_profiles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_member_profiles(UUID) TO service_role;

-- 4. FIX: ai_usage_logs INSERT policy
-- Current policy always returns false, breaking functionality
-- The service_role bypasses RLS anyway, so we just need to block regular users

DROP POLICY IF EXISTS "Only service role can insert ai_usage_logs" ON ai_usage_logs;
DROP POLICY IF EXISTS "Service role can insert usage logs" ON ai_usage_logs;

-- Create a policy that blocks regular user inserts but allows service_role
-- Note: service_role bypasses RLS by default, but we explicitly deny authenticated users
CREATE POLICY "Block direct user inserts to ai_usage_logs"
ON ai_usage_logs FOR INSERT
TO authenticated
WITH CHECK (false);

-- Allow service_role to insert (they bypass RLS, but explicit for clarity)
CREATE POLICY "Service role can manage ai_usage_logs"
ON ai_usage_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Ensure RLS is enabled on ai_usage_logs
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Add a comment explaining the security model
COMMENT ON FUNCTION get_client_social_credentials_decrypted(UUID) IS 
  'Secure function to retrieve decrypted social credentials. Checks workspace membership before returning data.';

COMMENT ON FUNCTION get_workspace_member_profiles(UUID) IS 
  'Secure function to retrieve profile information for workspace members only.';