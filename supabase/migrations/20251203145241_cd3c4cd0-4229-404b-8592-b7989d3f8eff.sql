-- Adicionar novos valores ao enum content_type
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'x_article';
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'linkedin_post';

-- Atualizar registros existentes com tipos antigos para os novos
UPDATE public.client_content_library 
SET content_type = 'short_video' 
WHERE content_type IN ('reel_script');

UPDATE public.client_content_library 
SET content_type = 'long_video' 
WHERE content_type IN ('video_script');

UPDATE public.client_content_library 
SET content_type = 'static_image' 
WHERE content_type IN ('social_post');