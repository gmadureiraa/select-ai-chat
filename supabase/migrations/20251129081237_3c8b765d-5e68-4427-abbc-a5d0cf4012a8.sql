-- Criar tabela de automações
CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  model TEXT NOT NULL DEFAULT 'gpt-5-mini-2025-08-07',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de execuções de automações
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result TEXT,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER
);

-- RLS policies para automations
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on automations"
  ON public.automations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies para automation_runs
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on automation_runs"
  ON public.automation_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_automations_client_id 
  ON public.automations(client_id);

CREATE INDEX IF NOT EXISTS idx_automations_is_active_next_run 
  ON public.automations(is_active, next_run_at);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id 
  ON public.automation_runs(automation_id);

CREATE INDEX IF NOT EXISTS idx_automation_runs_status 
  ON public.automation_runs(status);