-- Migration 0007: Radar Viral — additional platforms (Threads, Twitter/X, LinkedIn)
-- Adds 3 new tables to the Radar Viral pipeline so the daily brief can aggregate
-- signals from Meta Threads, X/Twitter and LinkedIn (in addition to RSS news,
-- Instagram and TikTok which already exist).
--
-- Idempotente: usa IF NOT EXISTS e DROP POLICY/CONSTRAINT IF EXISTS.
-- Pode rerodar com segurança.

-- ─── Update source_type CHECK in viral_tracked_sources ───────────────
-- The original migration 0003 only allowed: rss/instagram/tiktok/youtube/twitter/newsletter
-- Now we add: threads, linkedin (twitter já estava na lista).
ALTER TABLE public.viral_tracked_sources
  DROP CONSTRAINT IF EXISTS viral_tracked_sources_source_type_check;

ALTER TABLE public.viral_tracked_sources
  ADD CONSTRAINT viral_tracked_sources_source_type_check
  CHECK (source_type IN (
    'rss','instagram','tiktok','youtube',
    'twitter','threads','linkedin','newsletter'
  ));

-- ─── viral_threads_posts ──────────────────────────────────────────────
-- Posts virais do Threads (Meta). Apify actor: apify/threads-scraper.
CREATE TABLE IF NOT EXISTS public.viral_threads_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.viral_tracked_sources(id) ON DELETE SET NULL,
  url text NOT NULL UNIQUE,
  author_handle text,
  author_followers integer,
  text_content text,
  media_urls text[] DEFAULT '{}',
  views bigint,
  likes integer,
  reposts integer,
  replies integer,
  niche text,
  posted_at timestamp with time zone,
  scraped_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_threads_posted
  ON public.viral_threads_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_likes
  ON public.viral_threads_posts(likes DESC);
CREATE INDEX IF NOT EXISTS idx_threads_author
  ON public.viral_threads_posts(author_handle);
CREATE INDEX IF NOT EXISTS idx_threads_niche
  ON public.viral_threads_posts(niche);

-- ─── viral_twitter_posts ──────────────────────────────────────────────
-- Tweets virais (radar global). Apify actor: xtdata/twitter-x-scraper.
-- NOTE: existe tambem `twitter_posts` (per-client metrics). Esta tabela é
-- separada e GLOBAL — alimenta o Radar e o brief diário.
CREATE TABLE IF NOT EXISTS public.viral_twitter_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.viral_tracked_sources(id) ON DELETE SET NULL,
  tweet_id text UNIQUE,
  url text NOT NULL,
  author_handle text,
  author_name text,
  author_followers integer,
  author_verified boolean DEFAULT false,
  text_content text,
  media_urls text[] DEFAULT '{}',
  is_thread boolean DEFAULT false,
  thread_tweets jsonb DEFAULT '[]'::jsonb,
  views bigint,
  likes integer,
  retweets integer,
  replies integer,
  bookmarks integer,
  niche text,
  posted_at timestamp with time zone,
  scraped_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_twitter_posted
  ON public.viral_twitter_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_twitter_likes
  ON public.viral_twitter_posts(likes DESC);
CREATE INDEX IF NOT EXISTS idx_twitter_views
  ON public.viral_twitter_posts(views DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_twitter_author
  ON public.viral_twitter_posts(author_handle);
CREATE INDEX IF NOT EXISTS idx_twitter_niche
  ON public.viral_twitter_posts(niche);

-- ─── viral_linkedin_posts ─────────────────────────────────────────────
-- Posts virais do LinkedIn. Apify actor: apify/linkedin-post-search ou similar.
-- ATENÇÃO: LinkedIn detecta bots agressivamente — taxa de erro maior.
CREATE TABLE IF NOT EXISTS public.viral_linkedin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.viral_tracked_sources(id) ON DELETE SET NULL,
  post_id text UNIQUE,
  url text NOT NULL,
  author_handle text,
  author_name text,
  author_headline text,
  author_followers integer,
  text_content text,
  media_urls text[] DEFAULT '{}',
  post_type text, -- text/image/video/article/poll
  reactions integer,
  likes integer,
  comments integer,
  shares integer,
  niche text,
  posted_at timestamp with time zone,
  scraped_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_linkedin_posted
  ON public.viral_linkedin_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_reactions
  ON public.viral_linkedin_posts(reactions DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_linkedin_author
  ON public.viral_linkedin_posts(author_handle);
CREATE INDEX IF NOT EXISTS idx_linkedin_niche
  ON public.viral_linkedin_posts(niche);

-- ─── RLS read-only (write via service-role only) ──────────────────────
ALTER TABLE public.viral_threads_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_twitter_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_linkedin_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "viral_threads_posts read all"  ON public.viral_threads_posts;
DROP POLICY IF EXISTS "viral_twitter_posts read all"  ON public.viral_twitter_posts;
DROP POLICY IF EXISTS "viral_linkedin_posts read all" ON public.viral_linkedin_posts;

CREATE POLICY "viral_threads_posts read all"
  ON public.viral_threads_posts  FOR SELECT USING (true);
CREATE POLICY "viral_twitter_posts read all"
  ON public.viral_twitter_posts  FOR SELECT USING (true);
CREATE POLICY "viral_linkedin_posts read all"
  ON public.viral_linkedin_posts FOR SELECT USING (true);
