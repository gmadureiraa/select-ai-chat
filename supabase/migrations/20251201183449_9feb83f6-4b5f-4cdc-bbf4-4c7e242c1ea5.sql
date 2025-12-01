-- Adicionar campo metadata na research_conversations para suportar conversas isoladas por item
ALTER TABLE research_conversations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;