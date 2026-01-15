import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnifiedContentItem {
  id: string;
  platform: 'instagram' | 'twitter' | 'linkedin' | 'newsletter' | 'content';
  title: string;
  content: string;
  thumbnail_url?: string;
  posted_at: string;
  engagement_rate?: number;
  permalink?: string;
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    reach?: number;
  };
}

export function useUnifiedContent(clientId: string) {
  return useQuery({
    queryKey: ['unified-content', clientId],
    queryFn: async (): Promise<UnifiedContentItem[]> => {
      if (!clientId) return [];

      // Fetch from all platforms in parallel
      const [instagramRes, twitterRes, linkedinRes, contentRes] = await Promise.all([
        supabase
          .from('instagram_posts')
          .select('id, caption, thumbnail_url, posted_at, engagement_rate, likes, comments, shares, reach, permalink')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false })
          .limit(100),
        supabase
          .from('twitter_posts')
          .select('id, content, posted_at, engagement_rate, likes, retweets, replies, impressions, tweet_id')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false })
          .limit(100),
        supabase
          .from('linkedin_posts')
          .select('id, content, posted_at, engagement_rate, likes, comments, shares, impressions, post_url')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false })
          .limit(100),
        supabase
          .from('client_content_library')
          .select('id, title, content, thumbnail_url, created_at, content_url')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const items: UnifiedContentItem[] = [];

      // Normalize Instagram posts
      if (instagramRes.data) {
        instagramRes.data.forEach((post) => {
          items.push({
            id: post.id,
            platform: 'instagram',
            title: post.caption?.slice(0, 60) || 'Post Instagram',
            content: post.caption || '',
            thumbnail_url: post.thumbnail_url || undefined,
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.permalink || undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
              reach: post.reach || undefined,
            },
          });
        });
      }

      // Normalize Twitter posts
      if (twitterRes.data) {
        twitterRes.data.forEach((post) => {
          items.push({
            id: post.id,
            platform: 'twitter',
            title: post.content?.slice(0, 60) || 'Tweet',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.tweet_id ? `https://twitter.com/i/status/${post.tweet_id}` : undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.replies || 0,
              shares: post.retweets || 0,
              reach: post.impressions || undefined,
            },
          });
        });
      }

      // Normalize LinkedIn posts
      if (linkedinRes.data) {
        linkedinRes.data.forEach((post) => {
          items.push({
            id: post.id,
            platform: 'linkedin',
            title: post.content?.slice(0, 60) || 'Post LinkedIn',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.post_url || undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
              reach: post.impressions || undefined,
            },
          });
        });
      }

      // Normalize content library items
      if (contentRes.data) {
        contentRes.data.forEach((item) => {
          items.push({
            id: item.id,
            platform: 'content',
            title: item.title || 'Conteúdo',
            content: item.content || '',
            thumbnail_url: item.thumbnail_url || undefined,
            posted_at: item.created_at || new Date().toISOString(),
            permalink: item.content_url || undefined,
            metrics: {
              likes: 0,
              comments: 0,
              shares: 0,
            },
          });
        });
      }

      // Sort by date
      items.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

      return items;
    },
    enabled: !!clientId,
  });
}

export function useTopPerformingContent(clientId: string, limit: number = 5) {
  return useQuery({
    queryKey: ['top-performing-content', clientId, limit],
    queryFn: async (): Promise<UnifiedContentItem[]> => {
      if (!clientId) return [];

      // Fetch top performing posts from each platform
      const [instagramRes, twitterRes, linkedinRes] = await Promise.all([
        supabase
          .from('instagram_posts')
          .select('id, caption, thumbnail_url, posted_at, engagement_rate, likes, comments, shares, reach, permalink, post_type')
          .eq('client_id', clientId)
          .not('engagement_rate', 'is', null)
          .order('engagement_rate', { ascending: false })
          .limit(limit),
        supabase
          .from('twitter_posts')
          .select('id, content, posted_at, engagement_rate, likes, retweets, replies, impressions, tweet_id')
          .eq('client_id', clientId)
          .not('engagement_rate', 'is', null)
          .order('engagement_rate', { ascending: false })
          .limit(limit),
        supabase
          .from('linkedin_posts')
          .select('id, content, posted_at, engagement_rate, likes, comments, shares, impressions, post_url')
          .eq('client_id', clientId)
          .not('engagement_rate', 'is', null)
          .order('engagement_rate', { ascending: false })
          .limit(limit),
      ]);

      const items: UnifiedContentItem[] = [];

      if (instagramRes.data) {
        instagramRes.data.forEach((post) => {
          items.push({
            id: post.id,
            platform: 'instagram',
            title: post.caption?.slice(0, 60) || 'Post Instagram',
            content: post.caption || '',
            thumbnail_url: post.thumbnail_url || undefined,
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.permalink || undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
              reach: post.reach || undefined,
            },
          });
        });
      }

      if (twitterRes.data) {
        twitterRes.data.forEach((post) => {
          items.push({
            id: post.id,
            platform: 'twitter',
            title: post.content?.slice(0, 60) || 'Tweet',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.tweet_id ? `https://twitter.com/i/status/${post.tweet_id}` : undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.replies || 0,
              shares: post.retweets || 0,
              reach: post.impressions || undefined,
            },
          });
        });
      }

      if (linkedinRes.data) {
        linkedinRes.data.forEach((post) => {
          items.push({
            id: post.id,
            platform: 'linkedin',
            title: post.content?.slice(0, 60) || 'Post LinkedIn',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.post_url || undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
              reach: post.impressions || undefined,
            },
          });
        });
      }

      // Sort by engagement rate and take top items
      items.sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
      return items.slice(0, limit);
    },
    enabled: !!clientId,
  });
}
