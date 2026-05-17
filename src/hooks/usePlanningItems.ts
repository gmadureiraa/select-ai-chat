import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiInvoke';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type PlanningStatus = 'idea' | 'draft' | 'review' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type PlanningPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PlanningPlatform = 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'newsletter' | 'blog' | 'tiktok' | 'facebook' | 'threads' | 'other';

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
  /**
   * Filtra por presença/ausência de métricas em metadata.metrics.
   * 'with'    → só posts publicados que já têm metrics persistidas
   * 'without' → posts publicados sem métricas (ainda não sincados)
   * undefined → sem filtro
   */
  metrics?: 'with' | 'without';
  /**
   * Inclui templates de recorrência (planning_items com is_recurrence_template=true).
   * Por padrão NÃO aparecem no board/calendário pra evitar visual duplicado
   * (template + instâncias geradas pelo cron). Set true em tela dedicada.
   */
  includeRecurrenceTemplates?: boolean;
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
      
      // Initialize default columns if none exist (P0 fix audit 2026-05-17:
      // troca supabase.rpc('initialize_kanban_columns') por /api/kanban-columns-init
      // — RPC PL/pgSQL pode não existir no Neon).
      if (!data || data.length === 0) {
        await apiInvoke('kanban-columns-init', { body: { workspace_id: workspaceId } });
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

      const pageSize = 1000;
      const allData: Record<string, any>[] = [];

      // Fallback: se PostgREST schema cache ainda estiver stale (FKs recém-aplicadas),
      // fazer query SEM embed. Front lida com clients/columns separadamente via
      // os queries dedicados de useClients/useKanbanColumns.
      const buildQuery = (withEmbed: boolean) => {
        let q = supabase
          .from('planning_items')
          .select(
            withEmbed
              ? `*,clients:client_id(id,name,avatar_url),kanban_columns:column_id(id,name,color,column_type)`
              : '*',
          )
          .eq('workspace_id', workspaceId)
          .order('position', { ascending: true });
        // Templates de recorrência são "blueprints" pro cron — não devem
        // aparecer no board/calendário (audit 2026-05-16, bug #15). Filtra
        // por padrão; UI dedicada de gestão de recorrência passa includeRecurrenceTemplates=true.
        if (!filters.includeRecurrenceTemplates) {
          q = q.or('is_recurrence_template.is.null,is_recurrence_template.eq.false');
        }
        if (filters.clientId) q = q.eq('client_id', filters.clientId);
        if (filters.platform) q = q.eq('platform', filters.platform);
        if (filters.status) q = q.eq('status', filters.status);
        if (filters.priority) q = q.eq('priority', filters.priority);
        if (filters.assignedTo) q = q.eq('assigned_to', filters.assignedTo);
        if (filters.search) q = q.ilike('title', `%${filters.search}%`);
        return q;
      };

      for (let from = 0; ; from += pageSize) {
        let { data, error } = await buildQuery(true).range(from, from + pageSize - 1);
        // PGRST200: relationship not found → schema cache stale, retry sem embed.
        if (error && (error as any)?.code === 'PGRST200') {
          console.warn('[usePlanningItems] embed query failed (schema cache stale), retrying without embed');
          const fallback = await buildQuery(false).range(from, from + pageSize - 1);
          data = fallback.data;
          error = fallback.error;
        }
        if (error) throw error;
        allData.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }

      const data = allData;

      let mapped = (data || []).map(item => ({
        ...item,
        labels: Array.isArray(item.labels) ? item.labels : [],
        media_urls: Array.isArray(item.media_urls) ? item.media_urls : [],
        metadata: typeof item.metadata === 'object' && item.metadata !== null ? item.metadata : {},
        priority: (item.priority || 'medium') as PlanningPriority,
        status: (item.status || 'idea') as PlanningStatus,
      })) as PlanningItem[];

      // Client-side: filtro por presença/ausência de métricas. Aplicado aqui
      // pq metrics vive em metadata.jsonb (custo SQL maior pra pouca redução).
      if (filters.metrics === 'with') {
        mapped = mapped.filter(it => {
          const m = (it.metadata as any)?.metrics;
          return m && typeof m === 'object' && typeof m.likes === 'number';
        });
      } else if (filters.metrics === 'without') {
        mapped = mapped.filter(it => {
          if (it.status !== 'published') return false;
          const m = (it.metadata as any)?.metrics;
          return !m || typeof m.likes !== 'number';
        });
      }

      return mapped;
    },
    enabled: !!workspaceId,
    // Substitui Supabase Realtime do planning: poll a cada 15s para
    // refletir mudanças vindas de outros usuários/automações no
    // workspace. Mutations locais já invalidam imediatamente.
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    // Evita flash de skeleton quando filtros mudam — mantém dados anteriores
    // visíveis enquanto refetch acontece em background.
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  // Create item — com optimistic update pra evitar percepção de "não criado"
  // (refetch após invalidate demora 500-1500ms com Neon cold start). Usuário
  // vê o card aparecer instantaneamente na coluna alvo enquanto o servidor
  // confirma. Em caso de erro, onError faz rollback automático.
  const createItem = useMutation({
    mutationFn: async (input: CreatePlanningItemInput) => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Usuário não autenticado');
      if (!workspaceId) throw new Error('Workspace não encontrado');

      // Resolve column_id: input → coluna 'idea' → primeira coluna.
      // Se nenhuma coluna existir, FALHA EXPLÍCITA em vez de criar órfão.
      const targetColumnId =
        input.column_id || columns.find(c => c.column_type === 'idea')?.id || columns[0]?.id;
      if (!targetColumnId) {
        throw new Error('Nenhuma coluna do board configurada. Atualize a página.');
      }

      const columnItems = items.filter(i => i.column_id === targetColumnId);
      const maxPosition = columnItems.length > 0 ? Math.max(...columnItems.map(i => i.position)) + 1 : 0;

      const inputWithRecurrence = input as CreatePlanningItemInput & {
        recurrence_type?: string | null;
        recurrence_days?: unknown;
        recurrence_time?: string | null;
        recurrence_end_date?: string | null;
        is_recurrence_template?: boolean | null;
      };

      // P0 fix audit 2026-05-17: troca insert direto por /api/planning-items-create
      // (handler valida assertWorkspaceAccess + assertClientAccess, força
      // created_by, sanitiza JSONBs). Joins client/column resolvidos client-side
      // via cache do useClients + columns array do hook.
      const { data, error } = await apiInvoke('planning-items-create', {
        body: {
          workspace_id: workspaceId,
          client_id: input.client_id || null,
          column_id: targetColumnId,
          title: input.title,
          description: input.description ?? null,
          content: input.content ?? null,
          platform: input.platform ?? null,
          content_type: input.content_type || 'social_post',
          due_date: input.due_date ?? null,
          scheduled_at: input.scheduled_at ?? null,
          status: input.status || 'idea',
          priority: input.priority || 'medium',
          position: maxPosition,
          labels: input.labels ?? [],
          assigned_to: input.assigned_to ?? null,
          media_urls: input.media_urls ?? [],
          metadata: input.metadata ?? {},
          recurrence_type: inputWithRecurrence.recurrence_type ?? null,
          recurrence_days: inputWithRecurrence.recurrence_days ?? null,
          recurrence_time: inputWithRecurrence.recurrence_time ?? null,
          recurrence_end_date: inputWithRecurrence.recurrence_end_date ?? null,
          is_recurrence_template: inputWithRecurrence.is_recurrence_template ?? false,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao criar card');
      return data?.item ?? data;
    },
    // Optimistic update — adiciona o item imediatamente no cache antes do
    // servidor confirmar. UI mostra o card sem flash de loading.
    onMutate: async (input) => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !workspaceId) return;

      const targetColumnId =
        input.column_id || columns.find(c => c.column_type === 'idea')?.id || columns[0]?.id;
      if (!targetColumnId) return;

      await queryClient.cancelQueries({ queryKey: ['planning-items', workspaceId] });
      const previous = queryClient.getQueriesData({ queryKey: ['planning-items', workspaceId] });

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: PlanningItem = {
        id: tempId,
        workspace_id: workspaceId,
        client_id: input.client_id ?? null,
        column_id: targetColumnId,
        title: input.title,
        description: input.description ?? null,
        content: input.content ?? null,
        platform: (input.platform ?? null) as PlanningPlatform | null,
        content_type: input.content_type ?? 'social_post',
        due_date: input.due_date ?? null,
        scheduled_at: input.scheduled_at ?? null,
        published_at: null,
        status: (input.status ?? 'idea') as PlanningStatus,
        priority: (input.priority ?? 'medium') as PlanningPriority,
        position: items.filter(i => i.column_id === targetColumnId).length,
        labels: input.labels ?? [],
        assigned_to: input.assigned_to ?? null,
        media_urls: input.media_urls ?? [],
        metadata: (input.metadata ?? {}) as Record<string, unknown>,
        external_post_id: null,
        error_message: null,
        retry_count: 0,
        added_to_library: false,
        content_library_id: null,
        created_by: authUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueriesData(
        { queryKey: ['planning-items', workspaceId] },
        (old: PlanningItem[] | undefined) => [...(old ?? []), optimistic],
      );
      return { previous, tempId };
    },
    onError: (error, _input, context) => {
      // Rollback em caso de erro
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error('Erro ao criar card: ' + (error as Error).message);
    },
    onSuccess: (created, _input, context) => {
      // Substitui placeholder pelo item real do servidor (mantém ID estável)
      if (context?.tempId && created) {
        queryClient.setQueriesData(
          { queryKey: ['planning-items', workspaceId] },
          (old: PlanningItem[] | undefined) =>
            (old ?? []).map(it => (it.id === context.tempId ? (created as PlanningItem) : it)),
        );
      }
      toast.success('Card criado com sucesso');
    },
    onSettled: () => {
      // Invalidate pra garantir consistência com servidor (joins, RLS, etc)
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
    },
  });

  // Update item — passa `silent: true` em moves rápidos pra evitar spam de toasts
  const updateItem = useMutation({
    mutationFn: async ({ id, silent: _silent, ...updates }: Partial<PlanningItem> & { id: string; silent?: boolean }) => {
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

      // Recurrence fields — passar undefined explícito pra PATCHar null no DB
      // (Dialog manda null pra desligar recurrence; antes esses campos eram dropados).
      const updatesWithRecurrence = updates as typeof updates & {
        recurrence_type?: string | null;
        recurrence_days?: unknown;
        recurrence_time?: string | null;
        recurrence_end_date?: string | null;
        is_recurrence_template?: boolean | null;
      };
      if (updatesWithRecurrence.recurrence_type !== undefined)
        updateData.recurrence_type = updatesWithRecurrence.recurrence_type;
      if (updatesWithRecurrence.recurrence_days !== undefined)
        updateData.recurrence_days = updatesWithRecurrence.recurrence_days as unknown as Json;
      if (updatesWithRecurrence.recurrence_time !== undefined)
        updateData.recurrence_time = updatesWithRecurrence.recurrence_time;
      if (updatesWithRecurrence.recurrence_end_date !== undefined)
        updateData.recurrence_end_date = updatesWithRecurrence.recurrence_end_date;
      if (updatesWithRecurrence.is_recurrence_template !== undefined)
        updateData.is_recurrence_template = updatesWithRecurrence.is_recurrence_template;

      // P0 fix audit 2026-05-17: troca update direto por /api/planning-items-update
      // (handler aceita TODOS os campos editáveis + valida workspace member).
      const { data, error } = await apiInvoke('planning-items-update', {
        body: { id, ...updateData },
      });
      if (error) throw new Error(error.message || 'Erro ao atualizar card');
      return data?.item ?? data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
      if (!vars.silent) {
        toast.success('Salvo');
      }
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  // Delete item with undo support
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      // Snapshot the item before deletion to allow restore
      const snapshot = items.find(i => i.id === id);

      // P0 fix audit 2026-05-17: troca delete direto por /api/planning-items-delete
      // (handler já existia, valida workspace access).
      const { error } = await apiInvoke('planning-items-delete', { body: { id } });
      if (error) throw new Error(error.message || 'Erro ao excluir');
      return { id, snapshot };
    },
    onSuccess: ({ snapshot }) => {
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });

      if (snapshot) {
        // Build a clean payload (strip joined relations & generated fields)
        const restorePayload = {
          id: snapshot.id,
          workspace_id: snapshot.workspace_id,
          client_id: snapshot.client_id,
          column_id: snapshot.column_id,
          title: snapshot.title,
          description: snapshot.description,
          content: snapshot.content,
          platform: snapshot.platform,
          content_type: snapshot.content_type,
          due_date: snapshot.due_date,
          scheduled_at: snapshot.scheduled_at,
          published_at: snapshot.published_at,
          status: snapshot.status,
          priority: snapshot.priority,
          position: snapshot.position,
          labels: snapshot.labels,
          assigned_to: snapshot.assigned_to,
          media_urls: snapshot.media_urls,
          metadata: snapshot.metadata as Json,
          external_post_id: snapshot.external_post_id,
          error_message: snapshot.error_message,
          retry_count: snapshot.retry_count,
          added_to_library: snapshot.added_to_library,
          content_library_id: snapshot.content_library_id,
          created_by: snapshot.created_by,
        };

        toast.success('Card excluído', {
          duration: 6000,
          action: {
            label: 'Desfazer',
            onClick: async () => {
              // P0 fix audit 2026-05-17: restore via /api/planning-items-create
              // preservando id original (handler aceita id opcional pra undo).
              const { error } = await apiInvoke('planning-items-create', {
                body: restorePayload,
              });
              if (error) {
                toast.error('Não foi possível restaurar: ' + error.message);
                return;
              }
              queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
              toast.success('Card restaurado');
            },
          },
        });
      } else {
        toast.success('Card excluído');
      }
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

      const { error } = await apiInvoke('planning-items-update', {
        body: {
          id: itemId,
          column_id: columnId,
          position: newPosition,
          status: newStatus,
        },
      });
      if (error) throw new Error(error.message || 'Erro ao mover');
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
      const column = columns.find(c => c.id === variables.columnId);
      if (column) {
        toast.success(`Movido para ${column.name}`);
      }
    }
  });

  // Reorder items in batch (drag & drop with @dnd-kit)
  const reorderItems = useMutation({
    mutationFn: async (updates: Array<{ id: string; column_id: string; position: number; status?: PlanningStatus }>) => {
      // P0 fix audit 2026-05-17: troca N supabase.from(...).update por 1 call
      // a /api/planning-items-reorder (batch transactional + assertClientAccess
      // em todos os ids do batch). Reduz N round-trips → 1 e elimina race
      // condition entre rollbacks parciais.
      const { error } = await apiInvoke('planning-items-reorder', {
        body: { updates },
      });
      if (error) throw new Error(error.message || 'Erro ao reordenar');
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['planning-items', workspaceId] });
      const previous = queryClient.getQueryData<PlanningItem[]>(['planning-items', workspaceId]);
      if (previous) {
        const updateMap = new Map(updates.map(u => [u.id, u]));
        const optimistic = previous.map(item => {
          const u = updateMap.get(item.id);
          if (!u) return item;
          return {
            ...item,
            column_id: u.column_id,
            position: u.position,
            status: u.status ?? item.status,
          };
        });
        queryClient.setQueryData(['planning-items', workspaceId], optimistic);
      }
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['planning-items', workspaceId], ctx.previous);
      }
      toast.error('Erro ao reordenar: ' + (error as Error).message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
    },
  });

  // Move to library
  const moveToLibrary = useMutation({
    mutationFn: async (itemId: string) => {
      const item = items.find(i => i.id === itemId);
      if (!item) throw new Error('Item não encontrado');
      if (!item.client_id) throw new Error('Item precisa ter um cliente associado');

      // P0 fix audit 2026-05-17: troca 2 mutations diretas (content_library
      // INSERT + planning_items UPDATE) por handlers /api/save-to-library +
      // /api/planning-items-update. Não-atomic mas cada call valida acesso.
      const { data: libData, error: libraryError } = await apiInvoke('save-to-library', {
        body: {
          client_id: item.client_id,
          title: item.title,
          content: item.content || item.description || '',
          destination: 'content',
          format: 'static',
          metadata: {
            from_planning: true,
            original_item_id: item.id,
            platform: item.platform,
          },
        },
      });
      if (libraryError) throw new Error(libraryError.message || 'Erro ao salvar na biblioteca');
      const libraryItem = libData?.item ?? libData;

      const { error: updateError } = await apiInvoke('planning-items-update', {
        body: {
          id: itemId,
          added_to_library: true,
          content_library_id: libraryItem?.id,
        },
      });

      if (updateError) throw new Error(updateError.message || 'Erro ao marcar item');

      return libraryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
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
      const { error } = await apiInvoke('planning-items-update', {
        body: {
          id: itemId,
          scheduled_at: scheduledAt,
          status: 'scheduled',
          column_id: scheduledColumn?.id ?? null,
        },
      });
      if (error) throw new Error(error.message || 'Erro ao agendar');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
      toast.success('Agendado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao agendar: ' + error.message);
    }
  });

  // Retry failed publication
  const retryPublication = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await apiInvoke('planning-items-update', {
        body: {
          id: itemId,
          status: 'scheduled',
          error_message: null,
          retry_count: 0,
        },
      });
      if (error) throw new Error(error.message || 'Erro ao reagendar');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
      toast.success('Agendado para nova tentativa');
    }
  });

  // Helper functions — useCallback pra estabilizar refs entre re-renders.
  // Sem isso, KanbanView.baseColumnsMap (useMemo([columns, getItemsByColumn]))
  // recalculava a cada poll de 15s mesmo quando items não mudaram, causando
  // re-render visível ("piscar") da board.
  const ideaColumnId = useMemo(
    () => columns.find(c => c.column_type === 'idea')?.id ?? columns[0]?.id ?? null,
    [columns],
  );

  const getItemsByColumn = useCallback(
    (columnId: string) =>
      items
        .filter(item => {
          if (item.column_id) return item.column_id === columnId;
          return columnId === ideaColumnId;
        })
        .sort((a, b) => a.position - b.position),
    [items, ideaColumnId],
  );

  const getItemsByDate = useCallback(
    (date: Date) =>
      items.filter(item => {
        const itemDate = item.due_date || item.scheduled_at || item.published_at;
        if (!itemDate) return false;
        const d = new Date(itemDate);
        return d.toDateString() === date.toDateString();
      }),
    [items],
  );

  const getItemsForCalendar = useCallback(
    () => items.filter(item => item.due_date || item.scheduled_at || item.published_at),
    [items],
  );

  const getFailedItems = useCallback(
    () => items.filter(item => item.status === 'failed'),
    [items],
  );

  return {
    items,
    columns,
    isLoading: columnsLoading || itemsLoading,
    refetch,
    createItem,
    updateItem,
    deleteItem,
    moveToColumn,
    reorderItems,
    moveToLibrary,
    scheduleItem,
    retryPublication,
    getItemsByColumn,
    getItemsByDate,
    getItemsForCalendar,
    getFailedItems
  };
}
