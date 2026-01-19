-- Remover duplicatas, mantendo apenas o registro mais recente (com maior id)
DELETE FROM client_content_library a
USING client_content_library b
WHERE a.content_url IS NOT NULL 
  AND a.content_url != ''
  AND a.client_id = b.client_id
  AND a.content_type = b.content_type
  AND a.content_url = b.content_url
  AND a.created_at < b.created_at;

-- Agora criar o índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_library_unique_video 
ON client_content_library (client_id, content_type, content_url) 
WHERE content_url IS NOT NULL AND content_url != '';