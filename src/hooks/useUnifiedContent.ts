import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Helper to get storage URL
function getStorageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const { data } = supabase.storage.from('client-files').getPublicUrl(path);
  return data?.publicUrl || path;
}

export interface UnifiedContentItem {
  id: string;
  platform: 'instagram' | 'twitter' | 'linkedin' | 'newsletter' | 'youtube' | 'content';
  title: string;
  content: string;
  thumbnail_url?: string;
  images?: string[]; // All images from metadata + thumbnail
  posted_at: string;
  engagement_rate?: number;
  permalink?: string;
  is_favorite?: boolean;
  content_type?: string; // Original content type for filtering
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

      // Fetch from all sources in parallel - include images field for Instagram
      const [instagramRes, twitterRes, linkedinRes, libraryRes] = await Promise.all([
        supabase
          .from('instagram_posts')
          .select('id, caption, thumbnail_url, images, posted_at, engagement_rate, likes, comments, shares, permalink, is_favorite, post_type')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false }),
        supabase
          .from('twitter_posts')
          .select('id, tweet_id, content, posted_at, engagement_rate, likes, retweets, replies, is_favorite')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false }),
        supabase
          .from('linkedin_posts')
          .select('id, content, images, posted_at, engagement_rate, likes, comments, shares, post_url, is_favorite')
          .eq('client_id', clientId)
          .order('posted_at', { ascending: false }),
        supabase
          .from('client_content_library')
          .select('id, title, content, thumbnail_url, created_at, content_type, content_url, is_favorite, metadata')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ]);

      const items: UnifiedContentItem[] = [];

      // Normalize Instagram posts with all images
      if (instagramRes.data) {
        instagramRes.data.forEach(post => {
          // Collect all images from the images field
          const postImages = Array.isArray(post.images) ? (post.images as string[]) : [];
          const allImages: string[] = [];
          
          // Add thumbnail first if exists
          if (post.thumbnail_url) {
            allImages.push(getStorageUrl(post.thumbnail_url));
          }
          
          // Add other images from the images array
          postImages.forEach(img => {
            const imgUrl = getStorageUrl(img);
            if (imgUrl && !allImages.includes(imgUrl)) {
              allImages.push(imgUrl);
            }
          });

          items.push({
            id: post.id,
            platform: 'instagram',
            title: post.caption?.substring(0, 100) || 'Post Instagram',
            content: post.caption || '',
            thumbnail_url: allImages[0] || undefined,
            images: allImages.length > 0 ? allImages : undefined,
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.permalink || undefined,
            is_favorite: post.is_favorite || false,
            content_type: post.post_type || 'instagram_post',
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
            content_type: 'tweet',
            metrics: {
              likes: post.likes || 0,
              comments: post.replies || 0,
              shares: post.retweets || 0,
            },
            _source: 'twitter_posts',
          });
        });
      }

      // Normalize LinkedIn posts with images
      if (linkedinRes.data) {
        linkedinRes.data.forEach(post => {
          const postImages = Array.isArray(post.images) ? (post.images as string[]) : [];
          const allImages = postImages.map(img => getStorageUrl(img)).filter(Boolean);
          
          items.push({
            id: post.id,
            platform: 'linkedin',
            title: post.content?.substring(0, 100) || 'Post LinkedIn',
            content: post.content || '',
            thumbnail_url: allImages[0] || undefined,
            images: allImages.length > 0 ? allImages : undefined,
            posted_at: post.posted_at || new Date().toISOString(),
            engagement_rate: post.engagement_rate || undefined,
            permalink: post.post_url || undefined,
            is_favorite: post.is_favorite || false,
            content_type: 'linkedin_post',
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
          // Determine platform based on content_type
          let platform: 'newsletter' | 'youtube' | 'content' = 'content';
          if (item.content_type === 'newsletter') {
            platform = 'newsletter';
          } else if (item.content_type === 'long_video' || item.content_type === 'short_video') {
            platform = 'youtube';
          }
          
          // Extract all images from metadata + thumbnail
          const metadata = item.metadata as Record<string, unknown> | null;
          const metadataImages = Array.isArray(metadata?.images) 
            ? (metadata.images as string[]) 
            : [];
          const allImages: string[] = [];
          if (item.thumbnail_url) allImages.push(getStorageUrl(item.thumbnail_url));
          metadataImages.forEach(img => {
            const imgUrl = getStorageUrl(img);
            if (imgUrl && !allImages.includes(imgUrl)) allImages.push(imgUrl);
          });
          
          items.push({
            id: item.id,
            platform,
            title: item.title || 'Conteúdo',
            content: item.content || '',
            thumbnail_url: allImages[0] || undefined,
            images: allImages.length > 0 ? allImages : undefined,
            posted_at: item.created_at || new Date().toISOString(),
            permalink: item.content_url || undefined,
            is_favorite: item.is_favorite || false,
            content_type: item.content_type,
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
          .select('id, caption, thumbnail_url, images, posted_at, engagement_rate, likes, comments, shares, permalink')
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
          .select('id, content, images, posted_at, engagement_rate, likes, comments, shares, post_url')
          .eq('client_id', clientId)
          .not('engagement_rate', 'is', null)
          .order('engagement_rate', { ascending: false })
          .limit(limit),
      ]);

      const items: UnifiedContentItem[] = [];

      if (instagramRes.data) {
        instagramRes.data.forEach(post => {
          const postImages = Array.isArray(post.images) ? (post.images as string[]) : [];
          const allImages: string[] = [];
          if (post.thumbnail_url) allImages.push(getStorageUrl(post.thumbnail_url));
          postImages.forEach(img => {
            const imgUrl = getStorageUrl(img);
            if (imgUrl && !allImages.includes(imgUrl)) allImages.push(imgUrl);
          });

          items.push({
            id: post.id,
            platform: 'instagram',
            title: post.caption?.substring(0, 100) || 'Post Instagram',
            content: post.caption || '',
            thumbnail_url: allImages[0] || undefined,
            images: allImages.length > 0 ? allImages : undefined,
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
          const postImages = Array.isArray(post.images) ? (post.images as string[]) : [];
          const allImages = postImages.map(img => getStorageUrl(img)).filter(Boolean);
          
          items.push({
            id: post.id,
            platform: 'linkedin',
            title: post.content?.substring(0, 100) || 'Post LinkedIn',
            content: post.content || '',
            thumbnail_url: allImages[0] || undefined,
            images: allImages.length > 0 ? allImages : undefined,
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

// New mutation to update unified content items
export function useUpdateUnifiedContent(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      item, 
      data 
    }: { 
      item: UnifiedContentItem; 
      data: {
        title?: string;
        content?: string;
        content_url?: string;
        thumbnail_url?: string;
      };
    }) => {
      // Map fields based on source table
      let updateData: Record<string, unknown> = {};
      
      if (item._source === 'instagram_posts') {
        if (data.content !== undefined) updateData.caption = data.content;
        if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
      } else if (item._source === 'twitter_posts') {
        if (data.content !== undefined) updateData.content = data.content;
      } else if (item._source === 'linkedin_posts') {
        if (data.content !== undefined) updateData.content = data.content;
        if (data.content_url !== undefined) updateData.post_url = data.content_url;
      } else if (item._source === 'client_content_library') {
        if (data.title !== undefined) updateData.title = data.title;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.content_url !== undefined) updateData.content_url = data.content_url;
        if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
      }

      const { error } = await supabase
        .from(item._source)
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;
      return { ...item, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-content', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-content-library', clientId] });
      toast.success('Conteúdo atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar conteúdo');
    },
  });
}
