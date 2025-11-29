-- Add field for function templates/patterns
ALTER TABLE public.clients 
ADD COLUMN function_templates JSONB DEFAULT '[]'::jsonb;