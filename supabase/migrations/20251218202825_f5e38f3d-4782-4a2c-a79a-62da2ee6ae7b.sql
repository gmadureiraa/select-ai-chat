-- Fix function search path security
CREATE OR REPLACE FUNCTION public.search_knowledge_semantic(
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
SECURITY DEFINER
SET search_path = public
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