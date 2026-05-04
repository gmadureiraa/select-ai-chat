
CREATE TABLE IF NOT EXISTS public.viral_radar_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  niche text NOT NULL DEFAULT 'general',
  brief_date date NOT NULL DEFAULT CURRENT_DATE,
  narratives jsonb,
  hot_topics jsonb,
  carousel_ideas jsonb,
  cross_pollination jsonb,
  sources_summary jsonb,
  model_used text,
  cost_usd numeric(10,6),
  duration_ms integer,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viral_radar_client_date
  ON public.viral_radar_briefs(client_id, brief_date DESC);

ALTER TABLE public.viral_radar_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view radar briefs of their clients"
  ON public.viral_radar_briefs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert radar briefs"
  ON public.viral_radar_briefs FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update radar briefs"
  ON public.viral_radar_briefs FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete radar briefs"
  ON public.viral_radar_briefs FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER update_viral_radar_briefs_updated_at
  BEFORE UPDATE ON public.viral_radar_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
