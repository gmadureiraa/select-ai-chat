-- =============================================================================
-- SECURITY FIX: Comprehensive RLS and Function Security Improvements
-- =============================================================================

-- 1. ENHANCE client_workspace_accessible() TO CHECK CLIENT-LEVEL ACCESS
-- This fixes the credential exposure issue where members could access any client's credentials
-- =============================================================================

CREATE OR REPLACE FUNCTION public.client_workspace_accessible(p_client_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = p_client_id
    AND wm.user_id = p_user_id
    AND (
      -- Owners and admins have access to all clients in their workspace
      wm.role IN ('owner', 'admin')
      OR
      -- Members with no specific client restrictions (no entries in workspace_member_clients)
      -- have access to all clients
      (
        wm.role IN ('member', 'viewer')
        AND NOT EXISTS (
          SELECT 1 FROM workspace_member_clients wmc
          WHERE wmc.workspace_member_id = wm.id
        )
      )
      OR
      -- Members with specific client restrictions need explicit access
      EXISTS (
        SELECT 1 FROM workspace_member_clients wmc
        WHERE wmc.workspace_member_id = wm.id
        AND wmc.client_id = p_client_id
      )
    )
  )
$$;

-- 2. ENHANCE can_access_client() WITH SAME LOGIC FOR CONSISTENCY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_access_client(p_user_id uuid, p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_workspace_accessible(p_client_id, p_user_id)
$$;

-- 3. CREATE FUNCTION TO CHECK IF USER CAN ACCESS SENSITIVE CREDENTIALS
-- Viewers should NEVER be able to access credentials
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_access_credentials(p_client_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = p_client_id
    AND wm.user_id = p_user_id
    -- Only owners, admins, and members (NOT viewers) can access credentials
    AND wm.role IN ('owner', 'admin', 'member')
    AND (
      -- Owners and admins have access to all clients
      wm.role IN ('owner', 'admin')
      OR
      -- Members with no client restrictions have access to all
      (
        wm.role = 'member'
        AND NOT EXISTS (
          SELECT 1 FROM workspace_member_clients wmc
          WHERE wmc.workspace_member_id = wm.id
        )
      )
      OR
      -- Members with explicit client access
      EXISTS (
        SELECT 1 FROM workspace_member_clients wmc
        WHERE wmc.workspace_member_id = wm.id
        AND wmc.client_id = p_client_id
      )
    )
  )
$$;

-- 4. FIX planning_item_comments RLS - Replace USING(true) with workspace check
-- =============================================================================

DROP POLICY IF EXISTS "Users can view comments on accessible items" ON planning_item_comments;

CREATE POLICY "Workspace members can view comments"
ON planning_item_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM planning_items pi
    WHERE pi.id = planning_item_comments.planning_item_id
    AND is_workspace_member(auth.uid(), pi.workspace_id)
  )
);

-- 5. FIX planning_item_versions RLS - Replace USING(true) with workspace check  
-- =============================================================================

DROP POLICY IF EXISTS "Users can view version history" ON planning_item_versions;

CREATE POLICY "Workspace members can view versions"
ON planning_item_versions FOR SELECT
TO authenticated
USING (
  can_access_planning_item(planning_item_id)
);

-- 6. FIX profiles table RLS - Restrict to workspace members only
-- =============================================================================

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can view profiles of people in their workspace
CREATE POLICY "Workspace members can view colleague profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm1
    JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid()
    AND wm2.user_id = profiles.id
  )
);

-- 7. TIGHTEN instagram_tokens RLS - Ensure only client owners can access
-- =============================================================================

-- Drop any permissive policies
DROP POLICY IF EXISTS "Users can view instagram tokens for their clients" ON instagram_tokens;
DROP POLICY IF EXISTS "Users can view their instagram tokens" ON instagram_tokens;

-- Only workspace members with client access can view tokens
CREATE POLICY "Client members can view instagram tokens"
ON instagram_tokens FOR SELECT
TO authenticated
USING (
  can_access_credentials(client_id, auth.uid())
);

-- Only workspace members with client access can insert tokens
DROP POLICY IF EXISTS "Users can insert instagram tokens for their clients" ON instagram_tokens;
CREATE POLICY "Client members can insert instagram tokens"
ON instagram_tokens FOR INSERT
TO authenticated
WITH CHECK (
  can_access_credentials(client_id, auth.uid())
);

-- Only workspace members with client access can update tokens
DROP POLICY IF EXISTS "Users can update instagram tokens for their clients" ON instagram_tokens;
CREATE POLICY "Client members can update instagram tokens"
ON instagram_tokens FOR UPDATE
TO authenticated
USING (
  can_access_credentials(client_id, auth.uid())
);

-- Only workspace members with client access can delete tokens
DROP POLICY IF EXISTS "Users can delete instagram tokens for their clients" ON instagram_tokens;
CREATE POLICY "Client members can delete instagram tokens"
ON instagram_tokens FOR DELETE
TO authenticated
USING (
  can_access_credentials(client_id, auth.uid())
);

-- 8. UPDATE client_social_credentials policies to use can_access_credentials
-- =============================================================================

DROP POLICY IF EXISTS "Users can view credentials for their clients" ON client_social_credentials;
CREATE POLICY "Users can view credentials for accessible clients"
ON client_social_credentials FOR SELECT
TO authenticated
USING (
  can_access_credentials(client_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can insert credentials for their clients" ON client_social_credentials;
CREATE POLICY "Users can insert credentials for accessible clients"  
ON client_social_credentials FOR INSERT
TO authenticated
WITH CHECK (
  can_access_credentials(client_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can update credentials for their clients" ON client_social_credentials;
CREATE POLICY "Users can update credentials for accessible clients"
ON client_social_credentials FOR UPDATE
TO authenticated
USING (
  can_access_credentials(client_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can delete credentials for their clients" ON client_social_credentials;
CREATE POLICY "Users can delete credentials for accessible clients"
ON client_social_credentials FOR DELETE
TO authenticated
USING (
  can_access_credentials(client_id, auth.uid())
);