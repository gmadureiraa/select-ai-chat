-- Add new activity types for content library
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'content_library_added';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'content_library_updated';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'content_library_deleted';