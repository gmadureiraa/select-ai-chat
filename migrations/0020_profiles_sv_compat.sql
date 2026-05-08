-- ─── profiles compat layer pro viral-sv-original ────────────────────────
-- O sub-app SV (cópia literal Sequência Viral standalone) lê 14 colunas
-- extras em profiles que o KAI não tinha. Sem essas colunas, queries
-- `select(*)` retornam undefined nos campos esperados → onboarding/settings
-- crashava em `profile.brand_analysis.detected_niche` (cannot read of undefined).
--
-- Adiciono as colunas como nullable. SV vai popular conforme uso; KAI core
-- ignora porque nunca lê esses campos.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS carousel_style text,
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS usage_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_limit int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_analysis jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_colors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_image_refs jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS twitter_handle text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Backfill twitter_handle pra Gabriel (decisão @ogmadureira 2026-04-29)
UPDATE public.profiles
   SET twitter_handle = 'ogmadureira'
 WHERE email = 'gf.madureiraa@gmail.com'
   AND twitter_handle IS NULL;

-- Index pra lookups por handle (used em SV referrals + radar)
CREATE INDEX IF NOT EXISTS idx_profiles_twitter_handle
  ON public.profiles(twitter_handle) WHERE twitter_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_instagram_handle
  ON public.profiles(instagram_handle) WHERE instagram_handle IS NOT NULL;
