-- Helper function to check workspace access via client
CREATE OR REPLACE FUNCTION public.client_workspace_accessible(p_client_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = p_client_id AND wm.user_id = p_user_id
  )
$$;

-- Helper function to check if user can delete via client's workspace
CREATE OR REPLACE FUNCTION public.client_workspace_can_delete(p_client_id UUID, p_user_id UUID)
RETURNS BOOLEAN
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
    AND wm.role IN ('owner', 'admin')
  )
$$;

-- Update client_content_library policies
DROP POLICY IF EXISTS "Users can view content for their clients" ON public.client_content_library;
DROP POLICY IF EXISTS "Users can create content for their clients" ON public.client_content_library;
DROP POLICY IF EXISTS "Users can update content for their clients" ON public.client_content_library;
DROP POLICY IF EXISTS "Users can delete content for their clients" ON public.client_content_library;

CREATE POLICY "Workspace members can view content"
ON public.client_content_library FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create content"
ON public.client_content_library FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update content"
ON public.client_content_library FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete content"
ON public.client_content_library FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update client_reference_library policies
DROP POLICY IF EXISTS "Users can view references for their clients" ON public.client_reference_library;
DROP POLICY IF EXISTS "Users can create references for their clients" ON public.client_reference_library;
DROP POLICY IF EXISTS "Users can update references for their clients" ON public.client_reference_library;
DROP POLICY IF EXISTS "Users can delete references for their clients" ON public.client_reference_library;

CREATE POLICY "Workspace members can view references"
ON public.client_reference_library FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create references"
ON public.client_reference_library FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update references"
ON public.client_reference_library FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete references"
ON public.client_reference_library FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update client_templates policies
DROP POLICY IF EXISTS "Users can view templates for their clients" ON public.client_templates;
DROP POLICY IF EXISTS "Users can create templates for their clients" ON public.client_templates;
DROP POLICY IF EXISTS "Users can update templates for their clients" ON public.client_templates;
DROP POLICY IF EXISTS "Users can delete templates for their clients" ON public.client_templates;

CREATE POLICY "Workspace members can view templates"
ON public.client_templates FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create templates"
ON public.client_templates FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update templates"
ON public.client_templates FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete templates"
ON public.client_templates FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update client_documents policies
DROP POLICY IF EXISTS "Users can view documents for their clients" ON public.client_documents;
DROP POLICY IF EXISTS "Users can create documents for their clients" ON public.client_documents;
DROP POLICY IF EXISTS "Users can update documents for their clients" ON public.client_documents;
DROP POLICY IF EXISTS "Users can delete documents for their clients" ON public.client_documents;

CREATE POLICY "Workspace members can view documents"
ON public.client_documents FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create documents"
ON public.client_documents FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update documents"
ON public.client_documents FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete documents"
ON public.client_documents FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update client_websites policies
DROP POLICY IF EXISTS "Users can view websites for their clients" ON public.client_websites;
DROP POLICY IF EXISTS "Users can create websites for their clients" ON public.client_websites;
DROP POLICY IF EXISTS "Users can update websites for their clients" ON public.client_websites;
DROP POLICY IF EXISTS "Users can delete websites for their clients" ON public.client_websites;

CREATE POLICY "Workspace members can view websites"
ON public.client_websites FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create websites"
ON public.client_websites FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update websites"
ON public.client_websites FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete websites"
ON public.client_websites FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update conversations policies
DROP POLICY IF EXISTS "Users can view conversations for their clients" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations for their clients" ON public.conversations;
DROP POLICY IF EXISTS "Users can update conversations for their clients" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete conversations for their clients" ON public.conversations;

CREATE POLICY "Workspace members can view conversations"
ON public.conversations FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update conversations"
ON public.conversations FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete conversations"
ON public.conversations FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update image_generations policies
DROP POLICY IF EXISTS "Users can view images for their clients" ON public.image_generations;
DROP POLICY IF EXISTS "Users can create images for their clients" ON public.image_generations;
DROP POLICY IF EXISTS "Users can delete images for their clients" ON public.image_generations;

CREATE POLICY "Workspace members can view images"
ON public.image_generations FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create images"
ON public.image_generations FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete images"
ON public.image_generations FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update automations policies
DROP POLICY IF EXISTS "Users can view their automations" ON public.automations;
DROP POLICY IF EXISTS "Users can create automations" ON public.automations;
DROP POLICY IF EXISTS "Users can update their automations" ON public.automations;
DROP POLICY IF EXISTS "Users can delete their automations" ON public.automations;

CREATE POLICY "Workspace members can view automations"
ON public.automations FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create automations"
ON public.automations FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update automations"
ON public.automations FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete automations"
ON public.automations FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));

-- Update messages policies (via conversation -> client)
DROP POLICY IF EXISTS "Users can view messages for their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages for their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages for their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages for their conversations" ON public.messages;

CREATE OR REPLACE FUNCTION public.conversation_workspace_accessible(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations conv
    JOIN clients c ON c.id = conv.client_id
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE conv.id = p_conversation_id AND wm.user_id = p_user_id
  )
$$;

CREATE POLICY "Workspace members can view messages"
ON public.messages FOR SELECT
USING (public.conversation_workspace_accessible(conversation_id, auth.uid()));

CREATE POLICY "Workspace members can create messages"
ON public.messages FOR INSERT
WITH CHECK (public.conversation_workspace_accessible(conversation_id, auth.uid()));

CREATE POLICY "Workspace members can update messages"
ON public.messages FOR UPDATE
USING (public.conversation_workspace_accessible(conversation_id, auth.uid()));

CREATE POLICY "Workspace members can delete messages"
ON public.messages FOR DELETE
USING (public.conversation_workspace_accessible(conversation_id, auth.uid()));

-- Update platform_metrics policies
DROP POLICY IF EXISTS "Users can view metrics for their clients" ON public.platform_metrics;
DROP POLICY IF EXISTS "Users can insert metrics for their clients" ON public.platform_metrics;
DROP POLICY IF EXISTS "Users can update metrics for their clients" ON public.platform_metrics;
DROP POLICY IF EXISTS "Users can delete metrics for their clients" ON public.platform_metrics;

CREATE POLICY "Workspace members can view metrics"
ON public.platform_metrics FOR SELECT
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can create metrics"
ON public.platform_metrics FOR INSERT
WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update metrics"
ON public.platform_metrics FOR UPDATE
USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Only owners/admins can delete metrics"
ON public.platform_metrics FOR DELETE
USING (public.client_workspace_can_delete(client_id, auth.uid()));