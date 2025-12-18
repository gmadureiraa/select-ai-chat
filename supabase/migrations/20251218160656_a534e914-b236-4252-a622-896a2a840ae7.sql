-- Create helper function to check if user is NOT a viewer (can modify data)
CREATE OR REPLACE FUNCTION public.can_modify_data(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE user_id = p_user_id 
    AND role IN ('owner', 'admin', 'member')
  )
$$;

-- Update import_history INSERT policy to block viewers
DROP POLICY IF EXISTS "Workspace members can create import history" ON public.import_history;
CREATE POLICY "Non-viewers can create import history"
ON public.import_history
FOR INSERT
WITH CHECK (
  client_workspace_accessible(client_id, auth.uid()) 
  AND can_modify_data(auth.uid())
);

-- Update instagram_posts policies to block viewers from INSERT/UPDATE
DROP POLICY IF EXISTS "Workspace members can create instagram posts" ON public.instagram_posts;
CREATE POLICY "Non-viewers can create instagram posts"
ON public.instagram_posts
FOR INSERT
WITH CHECK (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

DROP POLICY IF EXISTS "Workspace members can update instagram posts" ON public.instagram_posts;
CREATE POLICY "Non-viewers can update instagram posts"
ON public.instagram_posts
FOR UPDATE
USING (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

-- Update youtube_videos policies to block viewers from INSERT/UPDATE
DROP POLICY IF EXISTS "Workspace members can create youtube videos" ON public.youtube_videos;
CREATE POLICY "Non-viewers can create youtube videos"
ON public.youtube_videos
FOR INSERT
WITH CHECK (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

DROP POLICY IF EXISTS "Workspace members can update youtube videos" ON public.youtube_videos;
CREATE POLICY "Non-viewers can update youtube videos"
ON public.youtube_videos
FOR UPDATE
USING (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

-- Update platform_metrics policies to block viewers from INSERT/UPDATE
DROP POLICY IF EXISTS "Workspace members can create metrics" ON public.platform_metrics;
CREATE POLICY "Non-viewers can create metrics"
ON public.platform_metrics
FOR INSERT
WITH CHECK (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

DROP POLICY IF EXISTS "Workspace members can update metrics" ON public.platform_metrics;
CREATE POLICY "Non-viewers can update metrics"
ON public.platform_metrics
FOR UPDATE
USING (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

-- Update client_content_library policies to block viewers from INSERT/UPDATE  
DROP POLICY IF EXISTS "Workspace members can create content" ON public.client_content_library;
CREATE POLICY "Non-viewers can create content"
ON public.client_content_library
FOR INSERT
WITH CHECK (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

DROP POLICY IF EXISTS "Workspace members can update content" ON public.client_content_library;
CREATE POLICY "Non-viewers can update content"
ON public.client_content_library
FOR UPDATE
USING (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

-- Update client_reference_library policies to block viewers from INSERT/UPDATE
DROP POLICY IF EXISTS "Workspace members can create references" ON public.client_reference_library;
CREATE POLICY "Non-viewers can create references"
ON public.client_reference_library
FOR INSERT
WITH CHECK (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

DROP POLICY IF EXISTS "Workspace members can update references" ON public.client_reference_library;
CREATE POLICY "Non-viewers can update references"
ON public.client_reference_library
FOR UPDATE
USING (
  client_workspace_accessible(client_id, auth.uid())
  AND can_modify_data(auth.uid())
);

-- Update messages policies to block viewers from INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Workspace members can create messages" ON public.messages;
CREATE POLICY "Non-viewers can create messages"
ON public.messages
FOR INSERT
WITH CHECK (
  conversation_workspace_accessible(conversation_id, auth.uid())
  AND can_modify_data(auth.uid())
);

DROP POLICY IF EXISTS "Workspace members can update messages" ON public.messages;
CREATE POLICY "Non-viewers can update messages"
ON public.messages
FOR UPDATE
USING (
  conversation_workspace_accessible(conversation_id, auth.uid())
  AND can_modify_data(auth.uid())
);

DROP POLICY IF EXISTS "Workspace members can delete messages" ON public.messages;
CREATE POLICY "Non-viewers can delete messages"
ON public.messages
FOR DELETE
USING (
  conversation_workspace_accessible(conversation_id, auth.uid())
  AND can_modify_data(auth.uid())
);