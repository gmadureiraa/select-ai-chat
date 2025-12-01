-- Tabela para registrar uso de IA e custos
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google'
  edge_function TEXT NOT NULL, -- qual função foi chamada
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd DECIMAL(10, 6),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem ver apenas seus próprios logs
CREATE POLICY "Users can view their own AI usage logs"
ON public.ai_usage_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: sistema pode inserir logs (edge functions)
CREATE POLICY "System can insert AI usage logs"
ON public.ai_usage_logs
FOR INSERT
WITH CHECK (true);

-- Index para queries rápidas por usuário e data
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created 
ON public.ai_usage_logs(user_id, created_at DESC);

-- Index para queries por função
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_function 
ON public.ai_usage_logs(edge_function, created_at DESC);