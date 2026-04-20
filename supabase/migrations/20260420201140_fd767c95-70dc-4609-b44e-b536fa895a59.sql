-- Tabela de keywords do Viral Hunter
CREATE TABLE public.client_viral_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(client_id, keyword)
);

CREATE INDEX idx_viral_keywords_client ON public.client_viral_keywords(client_id);

ALTER TABLE public.client_viral_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view viral keywords"
  ON public.client_viral_keywords FOR SELECT
  USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can insert viral keywords"
  ON public.client_viral_keywords FOR INSERT
  WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can delete viral keywords"
  ON public.client_viral_keywords FOR DELETE
  USING (client_workspace_accessible(client_id, auth.uid()));

-- Tabela de concorrentes do Viral Hunter
CREATE TABLE public.client_viral_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(client_id, platform, handle)
);

CREATE INDEX idx_viral_competitors_client ON public.client_viral_competitors(client_id);

ALTER TABLE public.client_viral_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view viral competitors"
  ON public.client_viral_competitors FOR SELECT
  USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can insert viral competitors"
  ON public.client_viral_competitors FOR INSERT
  WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can update viral competitors"
  ON public.client_viral_competitors FOR UPDATE
  USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can delete viral competitors"
  ON public.client_viral_competitors FOR DELETE
  USING (client_workspace_accessible(client_id, auth.uid()));

-- Tabela de carrosséis da Sequência Viral
CREATE TABLE public.viral_carousels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Novo carrossel',
  briefing TEXT,
  tone TEXT,
  template TEXT NOT NULL DEFAULT 'twitter',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_viral_carousels_client ON public.viral_carousels(client_id);
CREATE INDEX idx_viral_carousels_workspace ON public.viral_carousels(workspace_id);
CREATE INDEX idx_viral_carousels_user ON public.viral_carousels(user_id);

ALTER TABLE public.viral_carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view viral carousels"
  ON public.viral_carousels FOR SELECT
  USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can insert viral carousels"
  ON public.viral_carousels FOR INSERT
  WITH CHECK (client_workspace_accessible(client_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Workspace members can update viral carousels"
  ON public.viral_carousels FOR UPDATE
  USING (client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can delete viral carousels"
  ON public.viral_carousels FOR DELETE
  USING (client_workspace_accessible(client_id, auth.uid()));

CREATE TRIGGER update_viral_carousels_updated_at
  BEFORE UPDATE ON public.viral_carousels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migração de dados existentes do tags.viral_hunter para as novas tabelas
DO $$
DECLARE
  rec RECORD;
  cfg JSONB;
  kw TEXT;
  comp JSONB;
BEGIN
  FOR rec IN
    SELECT id, tags FROM public.clients
    WHERE tags ? 'viral_hunter' AND tags->>'viral_hunter' IS NOT NULL
  LOOP
    BEGIN
      cfg := (rec.tags->>'viral_hunter')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
    
    -- Migra keywords
    IF cfg ? 'keywords' AND jsonb_typeof(cfg->'keywords') = 'array' THEN
      FOR kw IN SELECT jsonb_array_elements_text(cfg->'keywords')
      LOOP
        IF kw IS NOT NULL AND length(trim(kw)) > 0 THEN
          INSERT INTO public.client_viral_keywords(client_id, keyword)
          VALUES (rec.id, trim(kw))
          ON CONFLICT (client_id, keyword) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
    
    -- Migra competitors
    IF cfg ? 'competitors' AND jsonb_typeof(cfg->'competitors') = 'array' THEN
      FOR comp IN SELECT jsonb_array_elements(cfg->'competitors')
      LOOP
        IF comp ? 'platform' AND comp ? 'handle' THEN
          INSERT INTO public.client_viral_competitors(client_id, platform, handle, notes)
          VALUES (rec.id, comp->>'platform', comp->>'handle', comp->>'notes')
          ON CONFLICT (client_id, platform, handle) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;