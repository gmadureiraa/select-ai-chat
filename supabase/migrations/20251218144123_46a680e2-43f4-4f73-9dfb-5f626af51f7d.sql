-- Add avatar_url to clients table for client logos
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add avatar_url to profiles table for user photos
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;