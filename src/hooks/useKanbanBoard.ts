import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface KanbanColumn {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  color: string | null;
  is_default: boolean | null;
  column_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  id: string;
  column_id: string;
  client_id: string | null;
  scheduled_post_id: string | null;
  content_library_id: string | null;
  title: string;
  description: string | null;
  position: number;
  labels: Json;
  due_date: string | null;
  assigned_to: string | null;
  platform: string | null;
  media_urls: Json;
  metadata: Json;
  created_by: string;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    avatar_url: string | null;
  } | null;
  scheduled_posts?: {
    status: string;
    scheduled_at: string;
  } | null;
}

export interface CreateCardInput {
  column_id: string;
  client_id?: string;
  title: string;
  description?: string;
  labels?: string[];
  due_date?: string;
  platform?: string;
  media_urls?: string[];
}

export function useKanbanBoard() {
  const { workspace } = useWorkspaceContext();
  const queryClient = useQueryClient();

  // Fetch columns
  const { data: columns, isLoading: columnsLoading } = useQuery({
    queryKey: ['kanban-columns', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      // First, try to get existing columns
      const { data: existingColumns, error: fetchError } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('position', { ascending: true });

      if (fetchError) throw fetchError;

      // If no columns exist, initialize default ones
      if (!existingColumns || existingColumns.length === 0) {
        const { error: initError } = await supabase.rpc('initialize_kanban_columns', {
          p_workspace_id: workspace.id,
        });

        if (initError) {
          console.error('Error initializing kanban columns:', initError);
          throw initError;
        }

        // Fetch the newly created columns
        const { data: newColumns, error: refetchError } = await supabase
          .from('kanban_columns')
          .select('*')
          .eq('workspace_id', workspace.id)
          .order('position', { ascending: true });

        if (refetchError) throw refetchError;
        return newColumns as KanbanColumn[];
      }

      return existingColumns as KanbanColumn[];
    },
    enabled: !!workspace?.id,
  });

  // Fetch cards
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['kanban-cards', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id || !columns || columns.length === 0) return [];

      const columnIds = columns.map(c => c.id);

      const { data, error } = await supabase
        .from('kanban_cards')
        .select(`
          *,
          clients (
            name,
            avatar_url
          ),
          scheduled_posts (
            status,
            scheduled_at
          )
        `)
        .in('column_id', columnIds)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as KanbanCard[];
    },
    enabled: !!workspace?.id && !!columns && columns.length > 0,
  });

  // Create card
  const createCard = useMutation({
    mutationFn: async (input: CreateCardInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get max position in the column
      const columnCards = cards?.filter(c => c.column_id === input.column_id) || [];
      const maxPosition = columnCards.length > 0 
        ? Math.max(...columnCards.map(c => c.position)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('kanban_cards')
        .insert({
          column_id: input.column_id,
          client_id: input.client_id,
          title: input.title,
          description: input.description,
          due_date: input.due_date,
          platform: input.platform,
          position: maxPosition,
          created_by: user.id,
          labels: (input.labels || []) as Json,
          media_urls: (input.media_urls || []) as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
      toast.success('Card criado!');
    },
    onError: (error) => {
      toast.error(`Erro ao criar card: ${error.message}`);
    },
  });

  // Update card
  const updateCard = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<{
      column_id: string;
      client_id: string | null;
      title: string;
      description: string | null;
      position: number;
      labels: Json;
      due_date: string | null;
      assigned_to: string | null;
      platform: string | null;
      media_urls: Json;
      metadata: Json;
      scheduled_post_id: string | null;
      content_library_id: string | null;
    }>) => {
      const { data, error } = await supabase
        .from('kanban_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
    },
  });

  // Delete card
  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kanban_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
      toast.success('Card excluído!');
    },
    onError: (error) => {
      toast.error(`Erro ao excluir card: ${error.message}`);
    },
  });

  // Move card to different column
  const moveCard = useMutation({
    mutationFn: async ({ cardId, targetColumnId, newPosition }: { 
      cardId: string; 
      targetColumnId: string; 
      newPosition: number;
    }) => {
      const { data, error } = await supabase
        .from('kanban_cards')
        .update({ 
          column_id: targetColumnId,
          position: newPosition,
        })
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
    },
  });

  // Move card to content library
  const moveToLibrary = useMutation({
    mutationFn: async (cardId: string) => {
      const card = cards?.find(c => c.id === cardId);
      if (!card) throw new Error('Card não encontrado');
      if (!card.client_id) throw new Error('Card precisa ter um cliente associado');

      // Determine content type
      let contentType: 'tweet' | 'linkedin_post' | 'social_post' = 'social_post';
      if (card.platform === 'twitter') contentType = 'tweet';
      else if (card.platform === 'linkedin') contentType = 'linkedin_post';

      // Create content in library
      const { data: content, error: contentError } = await supabase
        .from('client_content_library')
        .insert({
          client_id: card.client_id,
          title: card.title,
          content: card.description || card.title,
          content_type: contentType,
          metadata: {
            from_kanban: true,
            kanban_card_id: card.id,
            media_urls: card.media_urls,
          } as Json,
        })
        .select()
        .single();

      if (contentError) throw contentError;

      // Update card with content library reference
      const { error: updateError } = await supabase
        .from('kanban_cards')
        .update({ content_library_id: content.id })
        .eq('id', cardId);

      if (updateError) throw updateError;

      return content;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
      queryClient.invalidateQueries({ queryKey: ['content-library'] });
      toast.success('Conteúdo adicionado à biblioteca!');
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar à biblioteca: ${error.message}`);
    },
  });

  // Get cards by column
  const getCardsByColumn = (columnId: string) => {
    return (cards || [])
      .filter(card => card.column_id === columnId)
      .sort((a, b) => a.position - b.position);
  };

  return {
    columns: columns || [],
    cards: cards || [],
    isLoading: columnsLoading || cardsLoading,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    moveToLibrary,
    getCardsByColumn,
  };
}
