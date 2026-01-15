import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UnifiedContentItem {
  id: string;
  platform: 'instagram' | 'twitter' | 'linkedin' | 'newsletter' | 'content';
  title: string;
  content: string;
  thumbnail_url?: string;
  posted_at: string;
  engagement_rate?: number;
  permalink?: string;
  is_favorite?: boolean;
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    reach?: number;
  };
  // Source table info for updates
  _source: 'instagram_posts' | 'twitter_posts' | 'linkedin_posts' | 'client_content_library';
}

export function useUnifiedContent(clientId: string) {
  return useQuery({
    queryKey: ['unified-content', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      // Fetch from all sources in parallel
      const [instagramRes, twitterRes, linkedinRes, libraryRes] = await Promise.all([
        supabase
          .from('instagram_posts')
          .select('id, caption, thumbnail_url, posted_at, engagement_rate, likes, comments, shares, permalink, is_favorite')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false }),
        supabase
          .from('twitter_posts')
          .select('id, tweet_id, content, posted_at, engagement_rate, likes, retweets, replies, is_favorite')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false }),
        supabase
          .from('linkedin_posts')
          .select('id, content, posted_at, engagement_rate, likes, comments, shares, post_url, is_favorite')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false }),
        supabase
          .from('client_content_library')
          .select('id, title, content, thumbnail_url, created_at, content_type, content_url, is_favorite')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ]);

      const items: UnifiedContentItem[] = [];

      // Normalize Instagram posts
      if (instagramRes.data) {
        instagramRes.data.forEach(post => {
          items.push({
            id: post.id,
            platform: 'instagram',
            title: post.caption?.substring(0, 100) || 'Post Instagram',
            content: post.caption || '',
            thumbnail_url: post.thumbnail_url || undefined,
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.permalink || undefined,
            is_favorite: post.is_favorite || false,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
            },
            _source: 'instagram_posts',
          });
        });
      }

      // Normalize Twitter posts
      if (twitterRes.data) {
        twitterRes.data.forEach(post => {
          items.push({
            id: post.id,
            platform: 'twitter',
            title: post.content?.substring(0, 100) || 'Tweet',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.tweet_id ? `https://twitter.com/i/web/status/${post.tweet_id}` : undefined,
            is_favorite: post.is_favorite || false,
            metrics: {
              likes: post.likes || 0,
              comments: post.replies || 0,
              shares: post.retweets || 0,
            },
            _source: 'twitter_posts',
          });
        });
      }

      // Normalize LinkedIn posts
      if (linkedinRes.data) {
        linkedinRes.data.forEach(post => {
          items.push({
            id: post.id,
            platform: 'linkedin',
            title: post.content?.substring(0, 100) || 'Post LinkedIn',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.post_url || undefined,
            is_favorite: post.is_favorite || false,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
            },
            _source: 'linkedin_posts',
          });
        });
      }

      // Normalize content library items
      if (libraryRes.data) {
        libraryRes.data.forEach(item => {
          const isNewsletter = item.content_type === 'newsletter';
          items.push({
            id: item.id,
            platform: isNewsletter ? 'newsletter' : 'content',
            title: item.title || 'Conteúdo',
            content: item.content || '',
            thumbnail_url: item.thumbnail_url || undefined,
            posted_at: item.created_at || new Date().toISOString(),
            permalink: item.content_url || undefined,
            is_favorite: item.is_favorite || false,
            metrics: {
              likes: 0,
              comments: 0,
              shares: 0,
            },
            _source: 'client_content_library',
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
    queryFn: async () => {
      if (!clientId) return [];

      const [instagramRes, twitterRes, linkedinRes] = await Promise.all([
        supabase
          .from('instagram_posts')
          .select('id, caption, thumbnail_url, posted_at, engagement_rate, likes, comments, shares, permalink')
          .eq('client_id', clientId)
          .not('engagement_rate', 'is', null)
          .order('engagement_rate', { ascending: false })
          .limit(limit),
        supabase
          .from('twitter_posts')
          .select('id, tweet_id, content, posted_at, engagement_rate, likes, retweets, replies')
          .eq('client_id', clientId)
          .not('engagement_rate', 'is', null)
          .order('engagement_rate', { ascending: false })
          .limit(limit),
        supabase
          .from('linkedin_posts')
          .select('id, content, posted_at, engagement_rate, likes, comments, shares, post_url')
          .eq('client_id', clientId)
          .not('engagement_rate', 'is', null)
          .order('engagement_rate', { ascending: false })
          .limit(limit),
      ]);

      const items: UnifiedContentItem[] = [];

      if (instagramRes.data) {
        instagramRes.data.forEach(post => {
          items.push({
            id: post.id,
            platform: 'instagram',
            title: post.caption?.substring(0, 100) || 'Post Instagram',
            content: post.caption || '',
            thumbnail_url: post.thumbnail_url || undefined,
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.permalink || undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
            },
            _source: 'instagram_posts',
          });
        });
      }

      if (twitterRes.data) {
        twitterRes.data.forEach(post => {
          items.push({
            id: post.id,
            platform: 'twitter',
            title: post.content?.substring(0, 100) || 'Tweet',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.tweet_id ? `https://twitter.com/i/web/status/${post.tweet_id}` : undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.replies || 0,
              shares: post.retweets || 0,
            },
            _source: 'twitter_posts',
          });
        });
      }

      if (linkedinRes.data) {
        linkedinRes.data.forEach(post => {
          items.push({
            id: post.id,
            platform: 'linkedin',
            title: post.content?.substring(0, 100) || 'Post LinkedIn',
            content: post.content || '',
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.post_url || undefined,
            metrics: {
              likes: post.likes || 0,
              comments: post.comments || 0,
              shares: post.shares || 0,
            },
            _source: 'linkedin_posts',
          });
        });
      }

      // Sort by engagement and limit
      items.sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
      return items.slice(0, limit);
    },
    enabled: !!clientId,
  });
}

export function useToggleFavorite(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item }: { item: UnifiedContentItem }) => {
      const newValue = !item.is_favorite;
      
      const { error } = await supabase
        .from(item._source)
        .update({ is_favorite: newValue })
        .eq('id', item.id);

      if (error) throw error;
      return { ...item, is_favorite: newValue };
    },
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({ queryKey: ['unified-content', clientId] });
      toast.success(updatedItem.is_favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    },
    onError: () => {
      toast.error('Erro ao atualizar favorito');
    },
  });
}
