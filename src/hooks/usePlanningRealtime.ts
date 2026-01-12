import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function usePlanningRealtime() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;

  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel('planning-items-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'planning_items',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('Planning item changed:', payload.eventType);
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);
}
