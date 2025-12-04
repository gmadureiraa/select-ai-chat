-- Add extracted content column to client_documents
ALTER TABLE public.client_documents 
ADD COLUMN IF NOT EXISTS extracted_content TEXT;

-- Add comment
COMMENT ON COLUMN public.client_documents.extracted_content IS 'Extracted/transcribed content from PDF, images, and other documents';