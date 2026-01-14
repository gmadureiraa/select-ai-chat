import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { format } from "date-fns";

export interface MentionItem {
  id: string;
  title: string;
  type: 'content' | 'reference' | 'user' | 'performance';
  category: string;
  preview?: string;
  thumbnailUrl?: string;
  avatarUrl?: string;
  engagementRate?: number;
}

export function useMentionSearch(clientId: string | undefined, query: string) {
  const [items, setItems] = useState<MentionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { workspace } = useWorkspace();

  useEffect(() => {
    if (!clientId || query.length < 1) {
      setItems([]);
      return;
    }

    const searchItems = async () => {
      setIsLoading(true);
      try {
        // Busca em paralelo nas quatro fontes: content, reference, users e performance
        const [contentResult, referenceResult, membersResult, performanceResult] = await Promise.all([
          supabase
            .from('client_content_library')
            .select('id, title, content_type, content, thumbnail_url')
            .eq('client_id', clientId)
            .ilike('title', `%${query}%`)
            .limit(5),
          supabase
            .from('client_reference_library')
            .select('id, title, reference_type, content, thumbnail_url')
            .eq('client_id', clientId)
            .ilike('title', `%${query}%`)
            .limit(5),
          // Buscar membros do workspace
          workspace?.id ? supabase
            .from('workspace_members')
            .select(`
              user_id,
              profile:profiles!inner(id, full_name, email, avatar_url)
            `)
            .eq('workspace_id', workspace.id)
            .or(`profile.full_name.ilike.%${query}%,profile.email.ilike.%${query}%`)
            .limit(5)
          : Promise.resolve({ data: [] }),
          // Buscar posts de performance (Instagram)
          supabase
            .from('instagram_posts')
            .select('id, caption, post_type, engagement_rate, likes, posted_at, thumbnail_url')
            .eq('client_id', clientId)
            .ilike('caption', `%${query}%`)
            .order('engagement_rate', { ascending: false, nullsFirst: false })
            .limit(5)
        ]);

        const contentItems: MentionItem[] = (contentResult.data || []).map(item => ({
          id: item.id,
          title: item.title,
          type: 'content' as const,
          category: item.content_type || 'conteúdo',
          preview: item.content?.substring(0, 100),
          thumbnailUrl: item.thumbnail_url
        }));

        const referenceItems: MentionItem[] = (referenceResult.data || []).map(item => ({
          id: item.id,
          title: item.title,
          type: 'reference' as const,
          category: item.reference_type || 'referência',
          preview: item.content?.substring(0, 100),
          thumbnailUrl: item.thumbnail_url
        }));

        const memberItems: MentionItem[] = (membersResult.data || []).map((member: any) => ({
          id: member.user_id,
          title: member.profile?.full_name || member.profile?.email || 'Membro',
          type: 'user' as const,
          category: 'membro',
          avatarUrl: member.profile?.avatar_url
        }));

        const performanceItems: MentionItem[] = (performanceResult.data || []).map(post => ({
          id: post.id,
          title: post.caption?.substring(0, 50) || `Post de ${post.posted_at ? format(new Date(post.posted_at), "dd/MM") : 'Instagram'}`,
          type: 'performance' as const,
          category: `${post.post_type || 'post'} • ${post.engagement_rate?.toFixed(1) || 0}% eng`,
          preview: `${post.likes || 0} likes • ${post.engagement_rate?.toFixed(1) || 0}% engajamento`,
          thumbnailUrl: post.thumbnail_url,
          engagementRate: post.engagement_rate
        }));

        // Users first, then performance, then content, then references
        setItems([...memberItems, ...performanceItems, ...contentItems, ...referenceItems]);
      } catch (error) {
        console.error('Erro ao buscar menções:', error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchItems, 200);
    return () => clearTimeout(debounce);
  }, [clientId, query, workspace?.id]);

  return { items, isLoading };
}

export function useFetchMentionItem(type: 'content' | 'reference' | 'performance', id: string) {
  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchItem = async () => {
      setIsLoading(true);
      try {
        let data: any = null;
        let error: any = null;
        
        if (type === 'content') {
          const result = await supabase
            .from('client_content_library')
            .select('*')
            .eq('id', id)
            .single();
          data = result.data;
          error = result.error;
        } else if (type === 'reference') {
          const result = await supabase
            .from('client_reference_library')
            .select('*')
            .eq('id', id)
            .single();
          data = result.data;
          error = result.error;
        } else {
          const result = await supabase
            .from('instagram_posts')
            .select('*')
            .eq('id', id)
            .single();
          data = result.data;
          error = result.error;
        }

        if (error) throw error;
        setItem(data);
      } catch (error) {
        console.error('Erro ao buscar item:', error);
        setItem(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [type, id]);

  return { item, isLoading };
}

