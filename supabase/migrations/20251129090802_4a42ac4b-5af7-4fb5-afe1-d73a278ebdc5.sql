-- Add image_urls column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS image_urls TEXT[];