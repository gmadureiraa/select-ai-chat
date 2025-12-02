-- Adicionar novos tipos de conteúdo ao enum content_type
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'stories';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'static_image';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'short_video';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'long_video';