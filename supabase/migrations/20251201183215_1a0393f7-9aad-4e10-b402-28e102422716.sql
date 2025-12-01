-- FASE 1.1: Corrigir check constraint para incluir 'note' e 'ai_chat'
ALTER TABLE research_items DROP CONSTRAINT IF EXISTS research_items_type_check;
ALTER TABLE research_items ADD CONSTRAINT research_items_type_check 
  CHECK (type = ANY (ARRAY['youtube', 'image', 'audio', 'text', 'link', 'pdf', 'note', 'ai_chat']));

-- FASE 2.1: Adicionar RLS policies na client_reference_library
ALTER TABLE client_reference_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view references for their clients"
ON client_reference_library FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clients 
  WHERE clients.id = client_reference_library.client_id 
  AND clients.user_id = auth.uid()
));

CREATE POLICY "Users can create references for their clients"
ON client_reference_library FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM clients 
  WHERE clients.id = client_reference_library.client_id 
  AND clients.user_id = auth.uid()
));

CREATE POLICY "Users can update references for their clients"
ON client_reference_library FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM clients 
  WHERE clients.id = client_reference_library.client_id 
  AND clients.user_id = auth.uid()
));

CREATE POLICY "Users can delete references for their clients"
ON client_reference_library FOR DELETE
USING (EXISTS (
  SELECT 1 FROM clients 
  WHERE clients.id = client_reference_library.client_id 
  AND clients.user_id = auth.uid()
));