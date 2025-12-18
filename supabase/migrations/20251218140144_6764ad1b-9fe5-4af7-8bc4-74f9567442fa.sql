-- Drop Social Publisher and ClickUp related tables

-- Drop scheduled_posts table (social publisher drafts/scheduled posts)
DROP TABLE IF EXISTS public.scheduled_posts;

-- Drop twitter_tokens table
DROP TABLE IF EXISTS public.twitter_tokens;

-- Drop linkedin_tokens table
DROP TABLE IF EXISTS public.linkedin_tokens;

-- Drop clickup_tokens table
DROP TABLE IF EXISTS public.clickup_tokens;