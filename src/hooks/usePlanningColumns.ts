import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
 */
export function usePlanningColumns() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;

  const renameColumn = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Nome não pode ficar vazio');
      const { error } = await supabase
        .from('kanban_columns')
        .update({ name: trimmed })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-columns', workspaceId] });
      toast.success('Coluna renomeada');
    },
    onError: (err) => toast.error('Erro ao renomear: ' + (err as Error).message),
  });

  const reorderColumns = useMutation({
    mutationFn: async (updates: Array<{ id: string; position: number }>) => {
      // Atualiza em paralelo (ok pra <= ~12 colunas)
      const results = await Promise.all(
        updates.map(u =>
          supabase.from('kanban_columns').update({ position: u.position }).eq('id', u.id),
        ),
      );
      const firstError = results.find(r => r.error);
      if (firstError?.error) throw firstError.error;
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
      const { data, error } = await supabase
        .from('kanban_columns')
        .insert({
          workspace_id: workspaceId,
          name: trimmed,
          position,
          column_type: 'custom',
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-columns', workspaceId] });
      toast.success('Coluna criada');
    },
    onError: (err) => toast.error('Erro ao criar coluna: ' + (err as Error).message),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      // Pega items dessa coluna pra mover pra "idea" antes de deletar
      const { data: orphans, error: fetchErr } = await supabase
        .from('planning_items')
        .select('id')
        .eq('column_id', id);
      if (fetchErr) throw fetchErr;
      if (orphans && orphans.length > 0) {
        // Pega coluna idea
        const { data: idea } = await supabase
          .from('kanban_columns')
          .select('id')
          .eq('workspace_id', workspaceId!)
          .eq('column_type', 'idea')
          .single();
        if (idea?.id) {
          await supabase
            .from('planning_items')
            .update({ column_id: idea.id, status: 'idea' })
            .in('id', orphans.map(o => o.id));
        }
      }
      const { error } = await supabase.from('kanban_columns').delete().eq('id', id);
      if (error) throw error;
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
