-- Fix: Add missing enum values used by the Library UI
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'case_study';
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'report';