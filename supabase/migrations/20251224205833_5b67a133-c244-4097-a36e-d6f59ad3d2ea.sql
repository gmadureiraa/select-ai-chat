-- =============================================
-- ENTERPRISE FEATURES: Calendar, Kanban, Social Publishing
-- =============================================

-- 1. Scheduled Posts table
CREATE TABLE public.scheduled_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'post', -- post, thread, carousel
  platform TEXT NOT NULL, -- twitter, linkedin
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, publishing, published, failed
  error_message TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  external_post_id TEXT, -- ID returned from Twitter/LinkedIn
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Client Social Credentials table (for OAuth tokens)
CREATE TABLE public.client_social_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- twitter, linkedin
  -- Twitter OAuth 1.0a fields
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  access_token_secret TEXT,
  -- LinkedIn OAuth 2.0 fields
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  -- Validation status
  is_valid BOOLEAN DEFAULT false,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  validation_error TEXT,
  -- Metadata
  account_name TEXT,
  account_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform)
);

-- 3. Kanban Columns table
CREATE TABLE public.kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT 'gray',
  is_default BOOLEAN DEFAULT false,
  column_type TEXT DEFAULT 'custom', -- idea, draft, review, approved, scheduled, published, custom
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Kanban Cards table
CREATE TABLE public.kanban_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  scheduled_post_id UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL,
  content_library_id UUID REFERENCES public.client_content_library(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  labels JSONB DEFAULT '[]'::jsonb,
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  platform TEXT, -- twitter, linkedin, instagram
  media_urls JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_social_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for scheduled_posts
-- =============================================
CREATE POLICY "Workspace members can view scheduled posts"
ON public.scheduled_posts FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Non-viewers can create scheduled posts"
ON public.scheduled_posts FOR INSERT
WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND can_modify_data(auth.uid()));

CREATE POLICY "Non-viewers can update scheduled posts"
ON public.scheduled_posts FOR UPDATE
USING (is_workspace_member(auth.uid(), workspace_id) AND can_modify_data(auth.uid()));

CREATE POLICY "Only owners/admins can delete scheduled posts"
ON public.scheduled_posts FOR DELETE
USING (is_workspace_member(auth.uid(), workspace_id) AND can_delete_in_workspace(auth.uid()));

-- =============================================
-- RLS Policies for client_social_credentials
-- =============================================
CREATE POLICY "Workspace members can view social credentials"
ON public.client_social_credentials FOR SELECT
USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Non-viewers can create social credentials"
ON public.client_social_credentials FOR INSERT
WITH CHECK (client_workspace_accessible(client_id, auth.uid()) AND can_modify_data(auth.uid()));

CREATE POLICY "Non-viewers can update social credentials"
ON public.client_social_credentials FOR UPDATE
USING (client_workspace_accessible(client_id, auth.uid()) AND can_modify_data(auth.uid()));

CREATE POLICY "Only owners/admins can delete social credentials"
ON public.client_social_credentials FOR DELETE
USING (client_workspace_can_delete(client_id, auth.uid()));

-- =============================================
-- RLS Policies for kanban_columns
-- =============================================
CREATE POLICY "Workspace members can view kanban columns"
ON public.kanban_columns FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Non-viewers can create kanban columns"
ON public.kanban_columns FOR INSERT
WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND can_modify_data(auth.uid()));

CREATE POLICY "Non-viewers can update kanban columns"
ON public.kanban_columns FOR UPDATE
USING (is_workspace_member(auth.uid(), workspace_id) AND can_modify_data(auth.uid()));

CREATE POLICY "Only owners/admins can delete kanban columns"
ON public.kanban_columns FOR DELETE
USING (is_workspace_member(auth.uid(), workspace_id) AND can_delete_in_workspace(auth.uid()));

-- =============================================
-- RLS Policies for kanban_cards
-- =============================================
CREATE POLICY "Workspace members can view kanban cards"
ON public.kanban_cards FOR SELECT
USING (EXISTS (
  SELECT 1 FROM kanban_columns kc
  WHERE kc.id = kanban_cards.column_id
  AND is_workspace_member(auth.uid(), kc.workspace_id)
));

CREATE POLICY "Non-viewers can create kanban cards"
ON public.kanban_cards FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM kanban_columns kc
  WHERE kc.id = kanban_cards.column_id
  AND is_workspace_member(auth.uid(), kc.workspace_id)
  AND can_modify_data(auth.uid())
));

CREATE POLICY "Non-viewers can update kanban cards"
ON public.kanban_cards FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM kanban_columns kc
  WHERE kc.id = kanban_cards.column_id
  AND is_workspace_member(auth.uid(), kc.workspace_id)
  AND can_modify_data(auth.uid())
));

CREATE POLICY "Only owners/admins can delete kanban cards"
ON public.kanban_cards FOR DELETE
USING (EXISTS (
  SELECT 1 FROM kanban_columns kc
  WHERE kc.id = kanban_cards.column_id
  AND is_workspace_member(auth.uid(), kc.workspace_id)
  AND can_delete_in_workspace(auth.uid())
));

-- =============================================
-- Triggers for updated_at
-- =============================================
CREATE TRIGGER update_scheduled_posts_updated_at
BEFORE UPDATE ON public.scheduled_posts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_social_credentials_updated_at
BEFORE UPDATE ON public.client_social_credentials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kanban_columns_updated_at
BEFORE UPDATE ON public.kanban_columns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kanban_cards_updated_at
BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Function to check if workspace has enterprise plan
-- =============================================
CREATE OR REPLACE FUNCTION public.is_enterprise_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_subscriptions ws
    JOIN subscription_plans sp ON sp.id = ws.plan_id
    WHERE ws.workspace_id = p_workspace_id
    AND sp.type = 'enterprise'
    AND ws.status = 'active'
  )
$$;

-- =============================================
-- Function to initialize default kanban columns for a workspace
-- =============================================
CREATE OR REPLACE FUNCTION public.initialize_kanban_columns(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only insert if no columns exist for this workspace
  IF NOT EXISTS (SELECT 1 FROM kanban_columns WHERE workspace_id = p_workspace_id) THEN
    INSERT INTO kanban_columns (workspace_id, name, position, color, is_default, column_type) VALUES
      (p_workspace_id, 'Ideias', 0, 'purple', true, 'idea'),
      (p_workspace_id, 'Rascunho', 1, 'blue', true, 'draft'),
      (p_workspace_id, 'Revisão', 2, 'yellow', true, 'review'),
      (p_workspace_id, 'Aprovado', 3, 'green', true, 'approved'),
      (p_workspace_id, 'Agendado', 4, 'orange', true, 'scheduled'),
      (p_workspace_id, 'Publicado', 5, 'gray', true, 'published');
  END IF;
END;
$$;