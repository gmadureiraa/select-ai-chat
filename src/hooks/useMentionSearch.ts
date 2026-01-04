import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MentionItem {
  id: string;
  title: string;
  type: 'content' | 'reference';
  category: string;
  preview?: string;
  thumbnailUrl?: string;
}

export function useMentionSearch(clientId: string | undefined, query: string) {
  const [items, setItems] = useState<MentionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!clientId || query.length < 1) {
      setItems([]);
      return;
    }

    const searchItems = async () => {
      setIsLoading(true);
      try {
        // Busca em paralelo nas duas tabelas
        const [contentResult, referenceResult] = await Promise.all([
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

        setItems([...contentItems, ...referenceItems]);
      } catch (error) {
        console.error('Erro ao buscar menções:', error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchItems, 200);
    return () => clearTimeout(debounce);
  }, [clientId, query]);

  return { items, isLoading };
}

export function useFetchMentionItem(type: 'content' | 'reference', id: string) {
  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchItem = async () => {
      setIsLoading(true);
      try {
        const table = type === 'content' ? 'client_content_library' : 'client_reference_library';
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', id)
          .single();

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
