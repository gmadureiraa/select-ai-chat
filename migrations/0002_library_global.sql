-- 0002_library_global.sql
-- Fase 1 — Combo Viral Integration: tabelas globais de Biblioteca Viral
-- Criadas para alimentar a página /kai (tab=library-global) com Kaleidos 100
-- (importado do Notion no futuro) + curadoria global de reels virais.

-- library_ideas: Kaleidos 100 (importado do Notion no futuro)
CREATE TABLE IF NOT EXISTS public.library_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  hook text,
  description text,
  source_url text,
  source_handle text,
  tags text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  is_global boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.library_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "library_ideas readable" ON public.library_ideas;
CREATE POLICY "library_ideas readable" ON public.library_ideas FOR SELECT USING (is_global OR created_by = auth.uid());
DROP POLICY IF EXISTS "library_ideas insert authed" ON public.library_ideas;
CREATE POLICY "library_ideas insert authed" ON public.library_ideas FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- library_reels: curadoria global de reels virais
CREATE TABLE IF NOT EXISTS public.library_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  caption text,
  source_url text NOT NULL UNIQUE,
  thumbnail_url text,
  video_url text,
  author_handle text,
  author_followers integer,
  views integer,
  likes integer,
  comments integer,
  saves integer,
  posted_at timestamp with time zone,
  duration_seconds integer,
  category text,
  tags text[] DEFAULT '{}',
  hooks text[] DEFAULT '{}',
  metrics jsonb DEFAULT '{}'::jsonb,
  is_global boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.library_reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "library_reels readable" ON public.library_reels;
CREATE POLICY "library_reels readable" ON public.library_reels FOR SELECT USING (is_global OR created_by = auth.uid());
DROP POLICY IF EXISTS "library_reels insert admin" ON public.library_reels;
CREATE POLICY "library_reels insert admin" ON public.library_reels FOR INSERT TO authenticated WITH CHECK ((SELECT count(*) FROM super_admins WHERE user_id = auth.uid()) > 0);

CREATE INDEX IF NOT EXISTS idx_library_reels_category ON public.library_reels(category);
CREATE INDEX IF NOT EXISTS idx_library_reels_views ON public.library_reels(views DESC);
CREATE INDEX IF NOT EXISTS idx_library_ideas_category ON public.library_ideas(category);
