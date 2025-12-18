-- Enable vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new columns to global_knowledge for URL sources and AI summaries
ALTER TABLE public.global_knowledge 
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS key_takeaways JSONB,
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for semantic search
CREATE INDEX IF NOT EXISTS global_knowledge_embedding_idx 
ON public.global_knowledge 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create a function for semantic search
CREATE OR REPLACE FUNCTION search_knowledge_semantic(
  query_embedding vector(768),
  workspace_id_filter uuid,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  summary text,
  category text,
  source_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gk.id,
    gk.title,
    gk.content,
    gk.summary,
    gk.category::text,
    gk.source_url,
    1 - (gk.embedding <=> query_embedding) AS similarity
  FROM global_knowledge gk
  WHERE gk.workspace_id = workspace_id_filter
    AND gk.embedding IS NOT NULL
    AND 1 - (gk.embedding <=> query_embedding) > similarity_threshold
  ORDER BY gk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;