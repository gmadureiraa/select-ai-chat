-- Add identity_guide column to clients table for rich positioning context
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS identity_guide TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.clients.identity_guide IS 'Guia de identidade e posicionamento do cliente em formato markdown - inclui tom de voz, pilares de conteúdo, estratégias por plataforma';

-- Copy existing knowledge from madureira guide file to the client
-- (This will be done via the UI or manually)