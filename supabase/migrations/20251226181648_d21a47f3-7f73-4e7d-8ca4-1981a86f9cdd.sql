-- Add ai_analysis JSONB column to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT NULL;

COMMENT ON COLUMN public.clients.ai_analysis IS 
'Análise automática gerada pela IA durante onboarding do cliente';