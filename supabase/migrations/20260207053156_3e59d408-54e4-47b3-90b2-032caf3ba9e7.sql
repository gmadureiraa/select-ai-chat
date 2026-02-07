-- Add payload column to messages table for storing metadata like sources_used, validation, etc.
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.messages.payload IS 'Stores message metadata including sources_used, format_type, validation results, and citations';