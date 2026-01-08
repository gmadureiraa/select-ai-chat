-- Corrigir função search_messages com search_path explícito
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;