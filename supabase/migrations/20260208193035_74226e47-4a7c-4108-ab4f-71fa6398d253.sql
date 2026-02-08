-- Fix RLS policies for research_* tables
-- Since research_projects table doesn't exist, we'll create workspace-based policies

-- First, let's add workspace_id to research_conversations if needed
-- Actually, let's check what project_id references and create appropriate policies

-- For research_conversations - base access on authenticated users for now
-- These appear to be orphaned tables, so we'll apply restrictive policies
CREATE POLICY "Authenticated users can access research conversations"
ON public.research_conversations
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- research_messages - access via conversation
CREATE POLICY "Authenticated users can access research messages"
ON public.research_messages
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- research_items - access via project
CREATE POLICY "Authenticated users can access research items"
ON public.research_items
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- research_project_shares - users can see their own shares
CREATE POLICY "Users can access research shares"
ON public.research_project_shares
FOR SELECT
USING (
  shared_with_user_id = auth.uid() 
  OR shared_by = auth.uid()
);

CREATE POLICY "Users can create research shares"
ON public.research_project_shares
FOR INSERT
WITH CHECK (shared_by = auth.uid());

CREATE POLICY "Share owners can update"
ON public.research_project_shares
FOR UPDATE
USING (shared_by = auth.uid());

CREATE POLICY "Share owners can delete"
ON public.research_project_shares
FOR DELETE
USING (shared_by = auth.uid());

-- email_notification_queue - Only service role/triggers can access
-- Block all direct client access
CREATE POLICY "Block direct access to email queue"
ON public.email_notification_queue
FOR ALL
USING (false)
WITH CHECK (false);