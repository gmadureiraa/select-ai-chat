-- Tabela para roteiros adaptados de Reels virais (Reels Viral / engenharia reversa)
CREATE TABLE public.viral_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Input do user
  source_url TEXT NOT NULL,
  source_short_code TEXT,
  tema TEXT NOT NULL,
  objetivo TEXT NOT NULL CHECK (objetivo IN ('leads','produto','seguidores','engajamento')),
  cta TEXT NOT NULL,
  persona TEXT,
  nicho TEXT,

  -- Metadata do reel original (cache)
  source_meta JSONB DEFAULT '{}'::jsonb,

  -- Output da IA
  analysis JSONB,         -- { resumo, porQueViralizou[], estrutura{hook,promessa,demo,prova,cta}, padroesTransferiveis[] }
  script JSONB,           -- { titulo, hook, roteiroCompleto, scenes[], captionSugerida, notasProducao[] }

  -- Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  error_message TEXT,
  duration_ms INT,
  cost_usd NUMERIC(10,5),
  planning_item_id UUID REFERENCES public.planning_items(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_viral_reels_client ON public.viral_reels(client_id);
CREATE INDEX idx_viral_reels_workspace ON public.viral_reels(workspace_id);
CREATE INDEX idx_viral_reels_user ON public.viral_reels(user_id);
CREATE INDEX idx_viral_reels_short_code ON public.viral_reels(source_short_code);

ALTER TABLE public.viral_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view viral reels"
  ON public.viral_reels FOR SELECT
  USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can insert viral reels"
  ON public.viral_reels FOR INSERT
  WITH CHECK (public.client_workspace_accessible(client_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Workspace members can update viral reels"
  ON public.viral_reels FOR UPDATE
  USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE POLICY "Workspace members can delete viral reels"
  ON public.viral_reels FOR DELETE
  USING (public.client_workspace_accessible(client_id, auth.uid()));

CREATE TRIGGER update_viral_reels_updated_at
  BEFORE UPDATE ON public.viral_reels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();