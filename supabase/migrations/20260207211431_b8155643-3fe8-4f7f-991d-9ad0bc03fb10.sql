-- Índices para otimizar deduplicação por URL
CREATE INDEX IF NOT EXISTS idx_instagram_posts_permalink 
  ON instagram_posts(client_id, permalink) 
  WHERE permalink IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_url 
  ON linkedin_posts(client_id, post_url) 
  WHERE post_url IS NOT NULL;

-- Twitter não tem campo de URL no schema, então skip