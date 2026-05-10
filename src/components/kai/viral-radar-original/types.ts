/**
 * Tipos compartilhados — extraídos das route handlers do standalone
 * (app/api/data/[platform]/route.ts). No standalone os components
 * importavam direto da route. Aqui no KAI movemos pra um types.ts central.
 *
 * Schemas idênticos ao DB Neon que o cron v1 popula.
 */

export interface InstagramPostRow {
  shortcode: string;
  account_handle: string;
  niche: string;
  type: string | null;
  caption: string | null;
  display_url: string | null;
  child_urls: string[] | null;
  video_url: string | null;
  likes: number;
  comments: number;
  views: number;
  hashtags: string[] | null;
  mentions: string[] | null;
  posted_at: string | null;
  scraped_at: string;
  transcribed_at?: string | null;
}

export interface VideoRow {
  video_id: string;
  channel_id: string;
  channel_name: string;
  channel_handle: string | null;
  country: string | null;
  category: string | null;
  title: string;
  thumbnail_url: string;
  published_at: string;
  link: string;
  first_seen_at: string;
  last_seen_at: string;
}

export type NewsKind = "news" | "analysis";

export interface NewsArticleRow {
  link: string;
  source_id: string | null;
  source_name: string | null;
  source_color: string | null;
  language: string | null;
  niche: string;
  category: string | null;
  title: string;
  description: string | null;
  thumbnail: string | null;
  pub_date: string | null;
  /** Heurística: "news" = atualização concreta; "analysis" = opinião/listicle */
  kind?: NewsKind;
  /** Score do classificador (>=0 news, <0 analysis) */
  classifier_score?: number;
}

export interface SavedItemRow {
  id: number;
  user_id: string;
  platform: string;
  ref_id: string;
  niche_slug: string | null;
  title: string;
  thumbnail: string | null;
  source_url: string | null;
  note: string | null;
  saved_at: string;
}

export interface NewsletterRow {
  id: number;
  gmail_message_id: string;
  thread_id: string | null;
  niche: string | null;
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  snippet: string | null;
  link_count: number | null;
  sent_at: string | null;
  fetched_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Threads / X (Twitter) / LinkedIn — novas seções dedicadas no dashboard.
// Schemas refletem as tabelas viral_*_posts populadas pelos crons (2026-05-10).
// ─────────────────────────────────────────────────────────────────────────

export interface ThreadsPostRow {
  url: string;
  author_handle: string;
  author_followers: number | null;
  text_content: string | null;
  media_urls: string[] | null;
  views: number | null;
  likes: number;
  reposts: number;
  replies: number;
  niche: string | null;
  posted_at: string | null;
  scraped_at: string;
}

export interface TwitterPostRow {
  tweet_id: string;
  url: string;
  author_handle: string;
  author_name: string | null;
  author_followers: number | null;
  author_verified: boolean | null;
  text_content: string | null;
  media_urls: string[] | null;
  is_thread: boolean;
  thread_tweets: Array<{ id: string; text: string; media_urls?: string[] }> | null;
  views: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  niche: string | null;
  posted_at: string | null;
  scraped_at: string;
}

export interface LinkedInPostRow {
  post_id: string;
  url: string;
  author_handle: string | null;
  author_name: string | null;
  author_headline: string | null;
  author_followers: number | null;
  text_content: string | null;
  media_urls: string[] | null;
  post_type: string | null;
  reactions: number | null;
  likes: number;
  comments: number;
  shares: number;
  niche: string | null;
  posted_at: string | null;
  scraped_at: string;
}
