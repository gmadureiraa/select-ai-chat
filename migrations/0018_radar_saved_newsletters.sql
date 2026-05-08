-- ─── Radar saved items + newsletters curated ────────────────────────────
-- Tabelas faltando do radar v1 que viral-radar-original espera:
--   - radar_saved_items: bookmarks cross-platform (instagram/news/youtube/topic/idea)
--   - radar_newsletters_curated: newsletters curadas exibidas em /newsletters

CREATE TABLE IF NOT EXISTS public.radar_saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,           -- instagram | news | youtube | tiktok | twitter | threads | linkedin | topic | idea
  ref_id text NOT NULL,             -- id externo (post id / news id / etc)
  ref_data jsonb DEFAULT '{}'::jsonb,
  niche text,
  notes text,
  saved_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_radar_saved_unique
  ON public.radar_saved_items(user_id, platform, ref_id);
CREATE INDEX IF NOT EXISTS idx_radar_saved_user_platform
  ON public.radar_saved_items(user_id, platform, saved_at DESC);

ALTER TABLE public.radar_saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radar_saved_items own" ON public.radar_saved_items;
CREATE POLICY "radar_saved_items own"
  ON public.radar_saved_items FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.radar_newsletters_curated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL,
  title text NOT NULL,
  source text,
  content text,
  url text UNIQUE,
  thumbnail_url text,
  published_at timestamptz,
  language text DEFAULT 'pt-BR',
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_newsletters_niche
  ON public.radar_newsletters_curated(niche, published_at DESC) WHERE is_active = true;

ALTER TABLE public.radar_newsletters_curated ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radar_newsletters_curated read" ON public.radar_newsletters_curated;
CREATE POLICY "radar_newsletters_curated read"
  ON public.radar_newsletters_curated FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "radar_newsletters_curated admin" ON public.radar_newsletters_curated;
CREATE POLICY "radar_newsletters_curated admin"
  ON public.radar_newsletters_curated FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));
