-- 1. Adicionar colunas de rating na tabela messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating IN (-1, 0, 1));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS rating_feedback TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;

-- 2. Criar tabela de preferências do cliente (aprendidas via feedback)
CREATE TABLE IF NOT EXISTS client_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5,
  created_from_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Criar tabela de sugestões proativas
CREATE TABLE IF NOT EXISTS proactive_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  is_dismissed BOOLEAN DEFAULT false,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Índice de busca textual para mensagens
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector 
  GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(search_vector);

-- 5. Função de busca em mensagens
CREATE OR REPLACE FUNCTION search_messages(
  p_client_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 50
) RETURNS TABLE(
  message_id UUID,
  content TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  conversation_id UUID,
  conversation_title TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.content,
    m.role,
    m.created_at,
    m.conversation_id,
    c.title as conversation_title,
    ts_rank(m.search_vector, plainto_tsquery('portuguese', p_query)) as rank
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  WHERE c.client_id = p_client_id
    AND m.search_vector @@ plainto_tsquery('portuguese', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS para client_preferences
ALTER TABLE client_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view preferences for their clients"
ON client_preferences FOR SELECT
USING (
  client_id IN (
    SELECT id FROM clients WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert preferences for their clients"
ON client_preferences FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update preferences for their clients"
ON client_preferences FOR UPDATE
USING (
  client_id IN (
    SELECT id FROM clients WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

-- 7. RLS para proactive_suggestions
ALTER TABLE proactive_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suggestions for their clients"
ON proactive_suggestions FOR SELECT
USING (
  client_id IN (
    SELECT id FROM clients WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage suggestions for their clients"
ON proactive_suggestions FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);