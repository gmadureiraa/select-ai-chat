import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

export function usePlanningRealtime() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  const retryCount = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const connect = useCallback(() => {
    if (!workspaceId) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`planning-items-realtime-${workspaceId}`)
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
          queryClient.invalidateQueries({ queryKey: ['planning-items', workspaceId] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          retryCount.current = 0;
          console.log('Realtime: Connected to planning items');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime connection error:', err?.message || status);
          
          // Schedule reconnection with exponential backoff
          const delay = RECONNECT_DELAYS[Math.min(retryCount.current, RECONNECT_DELAYS.length - 1)];
          retryCount.current += 1;
          
          setTimeout(() => {
            console.log(`Realtime: Attempting reconnect (attempt ${retryCount.current})...`);
            connect();
          }, delay);
        } else if (status === 'CLOSED') {
          console.log('Realtime: Channel closed');
        }
      });

    channelRef.current = channel;
  }, [workspaceId, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [connect]);
}
