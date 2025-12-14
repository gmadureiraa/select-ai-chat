-- Adicionar novas categorias ao enum knowledge_category
ALTER TYPE public.knowledge_category ADD VALUE IF NOT EXISTS 'marketing_strategy';
ALTER TYPE public.knowledge_category ADD VALUE IF NOT EXISTS 'growth_hacking';
ALTER TYPE public.knowledge_category ADD VALUE IF NOT EXISTS 'social_media';
ALTER TYPE public.knowledge_category ADD VALUE IF NOT EXISTS 'seo';
ALTER TYPE public.knowledge_category ADD VALUE IF NOT EXISTS 'branding';
ALTER TYPE public.knowledge_category ADD VALUE IF NOT EXISTS 'analytics';
ALTER TYPE public.knowledge_category ADD VALUE IF NOT EXISTS 'audience';