-- Criar tabela unificada de planejamento
CREATE TABLE public.planning_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
  
  -- Conteúdo
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  
  -- Plataforma e tipo
  platform TEXT CHECK (platform IN ('twitter', 'linkedin', 'instagram', 'youtube', 'newsletter', 'blog', 'tiktok', 'other')),
  content_type TEXT DEFAULT 'social_post',
  
  -- Datas
  due_date DATE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Status e prioridade
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'review', 'approved', 'scheduled', 'publishing', 'published', 'failed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Organização
  position INTEGER DEFAULT 0,
  labels JSONB DEFAULT '[]'::jsonb,
  assigned_to UUID,
  
  -- Mídia e metadados
  media_urls JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Publicação
  external_post_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Biblioteca
  added_to_library BOOLEAN DEFAULT false,
  content_library_id UUID REFERENCES public.client_content_library(id) ON DELETE SET NULL,
  
  -- Audit
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_planning_items_workspace ON public.planning_items(workspace_id);
CREATE INDEX idx_planning_items_client ON public.planning_items(client_id);
CREATE INDEX idx_planning_items_column ON public.planning_items(column_id);
CREATE INDEX idx_planning_items_status ON public.planning_items(status);
CREATE INDEX idx_planning_items_due_date ON public.planning_items(due_date);
CREATE INDEX idx_planning_items_scheduled ON public.planning_items(scheduled_at);

-- Enable RLS
ALTER TABLE public.planning_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view planning items"
ON public.planning_items FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create planning items"
ON public.planning_items FOR INSERT
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can update planning items"
ON public.planning_items FOR UPDATE
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Only owners/admins can delete planning items"
ON public.planning_items FOR DELETE
USING (is_workspace_member(auth.uid(), workspace_id) AND can_delete_in_workspace(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_planning_items_updated_at
BEFORE UPDATE ON public.planning_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar dados existentes do kanban_cards (obtendo workspace_id via kanban_columns)
INSERT INTO public.planning_items (
  workspace_id, client_id, column_id, title, description, content,
  platform, due_date, status, position, labels, assigned_to,
  media_urls, metadata, created_by, created_at, updated_at
)
SELECT 
  col.workspace_id,
  kc.client_id,
  kc.column_id,
  kc.title,
  kc.description,
  kc.description as content,
  kc.platform,
  kc.due_date::date,
  CASE 
    WHEN col.column_type = 'idea' THEN 'idea'
    WHEN col.column_type = 'draft' THEN 'draft'
    WHEN col.column_type = 'review' THEN 'review'
    WHEN col.column_type = 'approved' THEN 'approved'
    WHEN col.column_type = 'scheduled' THEN 'scheduled'
    WHEN col.column_type = 'published' THEN 'published'
    ELSE 'idea'
  END as status,
  kc.position,
  COALESCE(kc.labels, '[]'::jsonb),
  kc.assigned_to,
  COALESCE(kc.media_urls, '[]'::jsonb),
  COALESCE(kc.metadata, '{}'::jsonb),
  kc.created_by,
  kc.created_at,
  kc.updated_at
FROM public.kanban_cards kc
INNER JOIN public.kanban_columns col ON col.id = kc.column_id
WHERE col.workspace_id IS NOT NULL;

-- Migrar dados do scheduled_posts
INSERT INTO public.planning_items (
  workspace_id, client_id, title, description, content,
  platform, scheduled_at, published_at, status, 
  media_urls, metadata, external_post_id, error_message, retry_count,
  created_by, created_at, updated_at
)
SELECT 
  sp.workspace_id,
  sp.client_id,
  sp.title,
  sp.content as description,
  sp.content,
  sp.platform,
  sp.scheduled_at,
  sp.published_at,
  CASE 
    WHEN sp.status = 'published' THEN 'published'
    WHEN sp.status = 'failed' THEN 'failed'
    WHEN sp.status = 'publishing' THEN 'publishing'
    ELSE 'scheduled'
  END as status,
  COALESCE(sp.media_urls, '[]'::jsonb),
  COALESCE(sp.metadata, '{}'::jsonb),
  sp.external_post_id,
  sp.error_message,
  COALESCE(sp.retry_count, 0),
  sp.created_by,
  sp.created_at,
  sp.updated_at
FROM public.scheduled_posts sp
WHERE sp.workspace_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.planning_items pi 
  WHERE pi.title = sp.title 
  AND pi.scheduled_at = sp.scheduled_at
  AND pi.client_id = sp.client_id
);