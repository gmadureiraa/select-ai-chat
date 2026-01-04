import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type PlanningStatus = 'idea' | 'draft' | 'review' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type PlanningPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PlanningPlatform = 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'newsletter' | 'blog' | 'tiktok' | 'other';

export interface PlanningItem {
  id: string;
  workspace_id: string;
  client_id: string | null;
  column_id: string | null;
  title: string;
  description: string | null;
  content: string | null;
  platform: PlanningPlatform | null;
  content_type: string | null;
  due_date: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: PlanningStatus;
  priority: PlanningPriority;
  position: number;
  labels: string[];
  assigned_to: string | null;
  media_urls: string[];
  metadata: Record<string, unknown>;
  external_post_id: string | null;
  error_message: string | null;
  retry_count: number;
  added_to_library: boolean;
  content_library_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  clients?: { id: string; name: string; avatar_url: string | null } | null;
  kanban_columns?: { id: string; name: string; color: string | null; column_type: string | null } | null;
  assignee_profile?: { id: string; full_name: string | null; avatar_url: string | null; email: string | null } | null;
}

export interface KanbanColumn {
  id: string;
  workspace_id: string;
  name: string;
  position: number;
  color: string | null;
  column_type: string | null;
  is_default: boolean;
}

export interface PlanningFilters {
  clientId?: string;
  platform?: PlanningPlatform;
  status?: PlanningStatus;
  priority?: PlanningPriority;
  assignedTo?: string;
  search?: string;
}

export interface CreatePlanningItemInput {
  client_id?: string;
  column_id?: string;
  title: string;
  description?: string;
  content?: string;
  platform?: PlanningPlatform;
  content_type?: string;
  due_date?: string;
  scheduled_at?: string;
  status?: PlanningStatus;
  priority?: PlanningPriority;
  labels?: string[];
  assigned_to?: string;
  media_urls?: string[];
  metadata?: Record<string, unknown>;
}

export function usePlanningItems(filters: PlanningFilters = {}) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const { user } = useAuth();
  const workspaceId = workspace?.id;
  

  // Fetch columns
  const { data: columns = [], isLoading: columnsLoading } = useQuery({
    queryKey: ['kanban-columns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('position', { ascending: true });

      if (error) throw error;
      
      // Initialize default columns if none exist
      if (!data || data.length === 0) {
        await supabase.rpc('initialize_kanban_columns', { p_workspace_id: workspaceId });
        const { data: newData } = await supabase
          .from('kanban_columns')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('position', { ascending: true });
        return (newData || []) as KanbanColumn[];
      }
      
      return data as KanbanColumn[];
    },
    enabled: !!workspaceId
  });

  // Fetch planning items
  const { data: items = [], isLoading: itemsLoading, refetch } = useQuery({
    queryKey: ['planning-items', workspaceId, filters],
    queryFn: async () => {
      if (!workspaceId) return [];

      let query = supabase
        .from('planning_items')
        .select(`
          *,
          clients:client_id (id, name, avatar_url),
          kanban_columns:column_id (id, name, color, column_type)
        `)
        .eq('workspace_id', workspaceId)
        .order('position', { ascending: true });

      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters.platform) {
        query = query.eq('platform', filters.platform);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        labels: Array.isArray(item.labels) ? item.labels : [],
        media_urls: Array.isArray(item.media_urls) ? item.media_urls : [],
        metadata: typeof item.metadata === 'object' && item.metadata !== null ? item.metadata : {},
        priority: (item.priority || 'medium') as PlanningPriority,
        status: (item.status || 'idea') as PlanningStatus,
      })) as PlanningItem[];
    },
    enabled: !!workspaceId
  });

  // Create item
  const createItem = useMutation({
    mutationFn: async (input: CreatePlanningItemInput) => {
      // Verify authentication directly from Supabase
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Usuário não autenticado');
      
      if (!workspaceId) throw new Error('Workspace não encontrado');

      // Get max position for the column
      const targetColumnId = input.column_id || columns.find(c => c.column_type === 'idea')?.id || columns[0]?.id;
      const columnItems = items.filter(i => i.column_id === targetColumnId);
      const maxPosition = columnItems.length > 0 ? Math.max(...columnItems.map(i => i.position)) + 1 : 0;

      const { data, error } = await supabase
        .from('planning_items')
        .insert({
          workspace_id: workspaceId,
          client_id: input.client_id || null,
          column_id: targetColumnId,
          title: input.title,
          description: input.description || null,
          content: input.content || null,
          platform: input.platform || null,
          content_type: input.content_type || 'social_post',
          due_date: input.due_date || null,
          scheduled_at: input.scheduled_at || null,
          status: input.status || 'idea',
          priority: input.priority || 'medium',
          position: maxPosition,
          labels: (input.labels || []) as unknown as Json,
          assigned_to: input.assigned_to || null,
          media_urls: (input.media_urls || []) as unknown as Json,
          metadata: (input.metadata || {}) as unknown as Json,
          created_by: authUser.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      toast.success('Card criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar card: ' + error.message);
    }
  });

  // Update item
  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlanningItem> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.platform !== undefined) updateData.platform = updates.platform;
      if (updates.content_type !== undefined) updateData.content_type = updates.content_type;
      if (updates.due_date !== undefined) updateData.due_date = updates.due_date;
      if (updates.scheduled_at !== undefined) updateData.scheduled_at = updates.scheduled_at;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.position !== undefined) updateData.position = updates.position;
      if (updates.column_id !== undefined) updateData.column_id = updates.column_id;
      if (updates.client_id !== undefined) updateData.client_id = updates.client_id;
      if (updates.labels !== undefined) updateData.labels = updates.labels as unknown as Json;
      if (updates.assigned_to !== undefined) updateData.assigned_to = updates.assigned_to;
      if (updates.media_urls !== undefined) updateData.media_urls = updates.media_urls as unknown as Json;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata as unknown as Json;
      if (updates.error_message !== undefined) updateData.error_message = updates.error_message;

      const { data, error } = await supabase
        .from('planning_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  // Delete item
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('planning_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      toast.success('Card excluído');
    },
    onError: (error) => {
      toast.error('Erro ao excluir: ' + error.message);
    }
  });

  // Move to column (with status update)
  const moveToColumn = useMutation({
    mutationFn: async ({ itemId, columnId, newPosition }: { itemId: string; columnId: string; newPosition: number }) => {
      const column = columns.find(c => c.id === columnId);
      const statusMap: Record<string, PlanningStatus> = {
        'idea': 'idea',
        'draft': 'draft',
        'review': 'review',
        'approved': 'approved',
        'scheduled': 'scheduled',
        'published': 'published'
      };
      const newStatus = column?.column_type ? statusMap[column.column_type] || 'idea' : 'idea';

      const { error } = await supabase
        .from('planning_items')
        .update({ 
          column_id: columnId, 
          position: newPosition,
          status: newStatus
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
    }
  });

  // Move to library
  const moveToLibrary = useMutation({
    mutationFn: async (itemId: string) => {
      const item = items.find(i => i.id === itemId);
      if (!item) throw new Error('Item não encontrado');
      if (!item.client_id) throw new Error('Item precisa ter um cliente associado');

      // Create content library entry - use 'other' as safe default
      const { data: libraryItem, error: libraryError } = await supabase
        .from('client_content_library')
        .insert([{
          client_id: item.client_id,
          title: item.title,
          content: item.content || item.description || '',
          content_type: 'other' as const,
          metadata: { 
            from_planning: true, 
            original_item_id: item.id,
            platform: item.platform 
          } as unknown as Json
        }])
        .select()
        .single();

      if (libraryError) throw libraryError;

      // Update planning item
      const { error: updateError } = await supabase
        .from('planning_items')
        .update({ 
          added_to_library: true,
          content_library_id: libraryItem.id 
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      return libraryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      queryClient.invalidateQueries({ queryKey: ['content-library'] });
      toast.success('Adicionado à biblioteca!');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  // Schedule item
  const scheduleItem = useMutation({
    mutationFn: async ({ itemId, scheduledAt }: { itemId: string; scheduledAt: string }) => {
      const scheduledColumn = columns.find(c => c.column_type === 'scheduled');
      
      const { error } = await supabase
        .from('planning_items')
        .update({ 
          scheduled_at: scheduledAt,
          status: 'scheduled',
          column_id: scheduledColumn?.id || null
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      toast.success('Agendado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao agendar: ' + error.message);
    }
  });

  // Retry failed publication
  const retryPublication = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('planning_items')
        .update({ 
          status: 'scheduled',
          error_message: null,
          retry_count: 0
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      toast.success('Agendado para nova tentativa');
    }
  });

  // Helper functions
  const getItemsByColumn = (columnId: string) => 
    items.filter(item => item.column_id === columnId).sort((a, b) => a.position - b.position);

  const getItemsByDate = (date: Date) => 
    items.filter(item => {
      const itemDate = item.due_date || item.scheduled_at;
      if (!itemDate) return false;
      const d = new Date(itemDate);
      return d.toDateString() === date.toDateString();
    });

  const getItemsForCalendar = () => 
    items.filter(item => item.due_date || item.scheduled_at);

  const getFailedItems = () => 
    items.filter(item => item.status === 'failed');

  return {
    items,
    columns,
    isLoading: columnsLoading || itemsLoading,
    refetch,
    createItem,
    updateItem,
    deleteItem,
    moveToColumn,
    moveToLibrary,
    scheduleItem,
    retryPublication,
    getItemsByColumn,
    getItemsByDate,
    getItemsForCalendar,
    getFailedItems
  };
}
