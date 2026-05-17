import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

/**
 * Mutations pra customizar as colunas do Kanban (renomear, reordenar,
 * adicionar coluna custom). Lê via useQuery em `usePlanningItems`.
 *
 * Schema canônico de `kanban_columns`:
 *   id, workspace_id, name, position, color, column_type, is_default
 *
 * `column_type` IDs canônicos (idea/draft/review/approved/scheduled/published)
 * têm semântica em `moveToColumn` (status). Colunas custom usam `column_type
 * = 'custom'` e não trocam status automaticamente.
 *
 * P0 fix audit 2026-05-17: todas as mutations migradas pra handlers
 * /api/kanban-columns-* (validam assertWorkspaceAccess). Antes faziam
 * supabase.from(...).update/insert/delete direto, bypassando o check no
 * pool serverless (neondb_owner BYPASSRLS).
 */
export function usePlanningColumns() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;

  const renameColumn = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Nome não pode ficar vazio');
      const { error } = await apiInvoke('kanban-columns-update', {
        body: { id, name: trimmed },
      });
      if (error) throw new Error(error.message || 'Erro ao renomear coluna');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-columns', workspaceId] });
      toast.success('Coluna renomeada');
    },
    onError: (err) => toast.error('Erro ao renomear: ' + (err as Error).message),
  });

  const reorderColumns = useMutation({
    mutationFn: async (updates: Array<{ id: string; position: number }>) => {
      // Batch update via handler (transaction-safe + 1 round-trip).
      const { error } = await apiInvoke('kanban-columns-update', {
        body: { updates },
      });
      if (error) throw new Error(error.message || 'Erro ao reordenar colunas');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-columns', workspaceId] });
    },
    onError: (err) => toast.error('Erro ao reordenar colunas: ' + (err as Error).message),
  });

  const addCustomColumn = useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) => {
      if (!workspaceId) throw new Error('Workspace não encontrado');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Nome obrigatório');
      const { data, error } = await apiInvoke('kanban-columns-create', {
        body: {
          workspace_id: workspaceId,
          name: trimmed,
          position,
          column_type: 'custom',
        },
      });
      if (error) throw new Error(error.message || 'Erro ao criar coluna');
      return data?.column ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-columns', workspaceId] });
      toast.success('Coluna criada');
    },
    onError: (err) => toast.error('Erro ao criar coluna: ' + (err as Error).message),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      // Handler kanban-columns-delete já move planning_items órfãos pra
      // coluna 'idea' do mesmo workspace em transaction (atomic).
      const { error } = await apiInvoke('kanban-columns-delete', {
        body: { id },
      });
      if (error) throw new Error(error.message || 'Erro ao remover coluna');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-columns', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
      toast.success('Coluna removida');
    },
    onError: (err) => toast.error('Erro ao remover coluna: ' + (err as Error).message),
  });

  return { renameColumn, reorderColumns, addCustomColumn, deleteColumn };
}
