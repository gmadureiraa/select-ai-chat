-- Add content_url field to client_content_library
ALTER TABLE public.client_content_library 
ADD COLUMN content_url TEXT;