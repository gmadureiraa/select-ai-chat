-- Add type field to client_templates to distinguish between chat and image templates
ALTER TABLE client_templates 
ADD COLUMN type text NOT NULL DEFAULT 'chat' CHECK (type IN ('chat', 'image'));