-- Criar tabela para armazenar tokens OAuth do ClickUp
CREATE TABLE IF NOT EXISTS public.clickup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  workspace_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.clickup_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own ClickUp tokens"
  ON public.clickup_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ClickUp tokens"
  ON public.clickup_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ClickUp tokens"
  ON public.clickup_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ClickUp tokens"
  ON public.clickup_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Adicionar coluna clickup_list_id na tabela client_templates
ALTER TABLE public.client_templates 
ADD COLUMN IF NOT EXISTS clickup_list_id TEXT;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_clickup_tokens_updated_at
  BEFORE UPDATE ON public.clickup_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();