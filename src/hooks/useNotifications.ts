import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useEffect, useRef } from 'react';

export type NotificationType = 
  | 'assignment' 
  | 'due_date' 
  | 'mention' 
  | 'publish_reminder' 
  | 'publish_failed'
  | 'publish_success'
  | 'automation_completed';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  type: NotificationType;
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
    // Substitui Supabase Realtime: poll a cada 30s para detectar
    // notificações novas. Foreground only (sem refetchIntervalInBackground)
    // para economizar requisições quando aba está oculta.
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Push notifications for background
  const { showNotificationIfHidden, permission } = usePushNotifications();

  // Detecta notificações novas no resultado do polling e dispara push.
  // Mantém o conjunto de IDs já vistos em ref para não duplicar push.
  const seenIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    // Primeira passagem: apenas registrar IDs sem disparar push (evita
    // notificar para tudo o que existia antes do componente montar).
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(notifications.map((n) => n.id));
      return;
    }

    if (permission !== 'granted') return;

    const seen = seenIdsRef.current;
    for (const n of notifications) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        showNotificationIfHidden(n.title, {
          body: n.message || undefined,
          tag: n.id,
        });
      }
    }
  }, [notifications, permission, showNotificationIfHidden]);

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
