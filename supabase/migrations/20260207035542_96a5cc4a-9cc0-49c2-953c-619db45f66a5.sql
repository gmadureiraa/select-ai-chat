-- Adicionar voice_profile aos clientes (Use/Evite estruturado)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS voice_profile JSONB DEFAULT '{}'::jsonb;

-- Adicionar output_schema à documentação de formatos
ALTER TABLE kai_documentation 
ADD COLUMN IF NOT EXISTS output_schema JSONB DEFAULT '{}'::jsonb;

-- Comentar as colunas para documentação
COMMENT ON COLUMN clients.voice_profile IS 'Perfil de voz estruturado: {"tone": "...", "use": ["..."], "avoid": ["..."]}';
COMMENT ON COLUMN kai_documentation.output_schema IS 'Schema de output JSON para validação: {"fields": {...}, "limits": {...}}';