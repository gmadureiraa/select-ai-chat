import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  type: 'assignment' | 'due_date' | 'mention' | 'publish_reminder';
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const { user } = useAuth();

  // Fetch unread notifications
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id, workspace?.id],
    queryFn: async () => {
      if (!user?.id || !workspace?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id && !!workspace?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id || !workspace?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, workspace?.id, refetch]);

  // Mark single as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id || !workspace?.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('workspace_id', workspace.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
