import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

/**
 * Substitui o antigo Supabase Realtime do planning por polling.
 *
 * Antes: subscription em `postgres_changes` da tabela `planning_items`
 * (filtrada por workspace_id) com reconexão exponencial.
 *
 * Agora: invalida a query `planning-items` a cada 15s. O hook
 * `usePlanningItems` também tem `refetchInterval: 15000`, então este
 * hook é defensivo — garante que componentes que escutam o cache
 * (ex.: PlanningBoard) recebam atualizações de qualquer outro caller
 * que tenha modificado o cache.
 */
export function usePlanningRealtime() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;

  useEffect(() => {
    if (!workspaceId) return;

    const POLL_INTERVAL_MS = 15000;

    const interval = setInterval(() => {
      // Apenas invalida quando a aba está visível para economizar req.
      if (typeof document !== 'undefined' && document.hidden) return;
      queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [workspaceId, queryClient]);
}
