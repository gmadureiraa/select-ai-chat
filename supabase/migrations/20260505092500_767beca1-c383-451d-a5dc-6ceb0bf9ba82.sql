
CREATE TABLE IF NOT EXISTS public.viral_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('youtube','news','trends','instagram')),
  query TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  item_count INTEGER NOT NULL DEFAULT 0,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  next_page_token TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viral_search_cache_lookup
  ON public.viral_search_cache(client_id, source, created_at DESC);

ALTER TABLE public.viral_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view viral search cache"
  ON public.viral_search_cache FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Team can insert viral search cache"
  ON public.viral_search_cache FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Team can update viral search cache"
  ON public.viral_search_cache FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Team can delete viral search cache"
  ON public.viral_search_cache FOR DELETE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE TRIGGER update_viral_search_cache_updated_at
  BEFORE UPDATE ON public.viral_search_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
