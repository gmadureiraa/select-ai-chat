-- Make user_id nullable in social_credentials_audit_log to allow system-level operations
ALTER TABLE IF EXISTS public.social_credentials_audit_log ALTER COLUMN user_id DROP NOT NULL;

-- Clean up polluted platform values (e.g., "linkedin?connected=linkedin" -> "linkedin")
UPDATE public.client_social_credentials 
SET platform = SPLIT_PART(platform, '?', 1)
WHERE platform LIKE '%?connected=%';

-- Delete any duplicate records that might have been created
DELETE FROM public.client_social_credentials a
USING public.client_social_credentials b
WHERE a.id > b.id 
  AND a.client_id = b.client_id 
  AND a.platform = b.platform;