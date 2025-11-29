-- Criar tabela de templates com regras
CREATE TABLE IF NOT EXISTS public.client_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(client_id, name)
);

-- Enable RLS
ALTER TABLE public.client_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view client templates"
  ON public.client_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create client templates"
  ON public.client_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client templates"
  ON public.client_templates FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client templates"
  ON public.client_templates FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_client_templates_updated_at
  BEFORE UPDATE ON public.client_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar templates existentes para nova tabela
INSERT INTO public.client_templates (client_id, name, rules)
SELECT 
  id as client_id,
  jsonb_array_elements_text(function_templates) as name,
  '[]'::jsonb as rules
FROM public.clients
WHERE function_templates IS NOT NULL 
  AND jsonb_array_length(function_templates) > 0;

-- Remover coluna function_templates da tabela clients (será deprecated)
-- Mantemos por enquanto para compatibilidade