import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Notification preferences agora vivem em `notification_preferences`
 * (migration 20260504144016) — UMA row por (user, workspace, channel, type).
 * O JSONB legado em `profiles.notification_preferences` foi descontinuado
 * porque os triggers SQL novos consultam ESSA tabela via `notif_pref_enabled()`.
 *
 * Pra preservar a API do hook (chaves flat tipo `assignment_notifications`),
 * mapeamos cada chave do hook pra um par (channel, type) específico:
 *
 *   push_enabled              → channel='push',   type='*'          (toggle global)
 *   email_notifications       → channel='email',  type='*'          (toggle global)
 *   assignment_notifications  → channel='in_app', type='task_assigned'
 *   due_date_notifications    → channel='in_app', type='task_due_soon'
 *   publish_notifications     → channel='in_app', type='publish_success'
 *                                                + 'publish_failed'  + 'publish_reminder'
 *   mention_notifications     → channel='in_app', type='task_mention'
 *                                                + 'mention'
 *
 * Toggle global (push/email) usa `type='*'` que é interpretado pelo helper
 * `notif_pref_enabled` como wildcard quando type=específico está ausente.
 */

export interface NotificationPreferences {
  push_enabled: boolean;
  email_notifications: boolean;
  assignment_notifications: boolean;
  due_date_notifications: boolean;
  publish_notifications: boolean;
  mention_notifications: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  push_enabled: true,
  email_notifications: true,
  assignment_notifications: true,
  due_date_notifications: true,
  publish_notifications: true,
  mention_notifications: true,
};

// Mapeamento canônico: chave do hook → lista de (channel, type) que precisam estar habilitadas
type Channel = 'in_app' | 'push' | 'telegram' | 'email';
type PrefMapping = { channel: Channel; type: string };

const PREF_MAP: Record<keyof NotificationPreferences, PrefMapping[]> = {
  push_enabled: [{ channel: 'push', type: '*' }],
  email_notifications: [{ channel: 'email', type: '*' }],
  assignment_notifications: [
    { channel: 'in_app', type: 'task_assigned' },
    { channel: 'in_app', type: 'assignment' },
  ],
  due_date_notifications: [
    { channel: 'in_app', type: 'task_due_soon' },
    { channel: 'in_app', type: 'due_date' },
  ],
  publish_notifications: [
    { channel: 'in_app', type: 'publish_success' },
    { channel: 'in_app', type: 'publish_failed' },
    { channel: 'in_app', type: 'publish_reminder' },
  ],
  mention_notifications: [
    { channel: 'in_app', type: 'task_mention' },
    { channel: 'in_app', type: 'mention' },
    { channel: 'in_app', type: 'task_comment' },
  ],
};

interface PreferenceRow {
  channel: Channel;
  type: string;
  enabled: boolean;
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { workspace } = useWorkspaceContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const userId = user?.id;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['notification-preferences', userId, workspaceId],
    queryFn: async (): Promise<PreferenceRow[]> => {
      if (!userId || !workspaceId) return [];
      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .select('channel, type, enabled')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId);
      if (error) {
        // Tabela pode não existir ainda em alguns ambientes (migração 0144016).
        // Tratar como sem preferências → defaults aplicam.
        console.warn('[useNotificationPreferences] fetch warning:', error.message);
        return [];
      }
      return (data || []) as PreferenceRow[];
    },
    enabled: !!userId && !!workspaceId,
  });

  // Derivar PREFs flat a partir das rows
  const preferences: NotificationPreferences = useMemo(() => {
    const byKey = (k: keyof NotificationPreferences) => {
      const mappings = PREF_MAP[k];
      // Se QUALQUER row mapeada estiver explicitamente false → toggle off
      // Senão default true.
      for (const m of mappings) {
        const row = rows.find((r) => r.channel === m.channel && r.type === m.type);
        if (row && row.enabled === false) return false;
      }
      return DEFAULT_PREFERENCES[k];
    };
    return {
      push_enabled: byKey('push_enabled'),
      email_notifications: byKey('email_notifications'),
      assignment_notifications: byKey('assignment_notifications'),
      due_date_notifications: byKey('due_date_notifications'),
      publish_notifications: byKey('publish_notifications'),
      mention_notifications: byKey('mention_notifications'),
    };
  }, [rows]);

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!userId || !workspaceId) throw new Error('User/workspace not ready');

      // Pra cada chave alterada, UPSERT uma row por (channel, type) com `enabled`.
      const upserts: Array<{
        user_id: string;
        workspace_id: string;
        channel: Channel;
        type: string;
        enabled: boolean;
      }> = [];
      for (const [keyRaw, enabled] of Object.entries(updates)) {
        const key = keyRaw as keyof NotificationPreferences;
        if (typeof enabled !== 'boolean') continue;
        for (const m of PREF_MAP[key]) {
          upserts.push({
            user_id: userId,
            workspace_id: workspaceId,
            channel: m.channel,
            type: m.type,
            enabled,
          });
        }
      }

      if (upserts.length === 0) return;

      const { error } = await (supabase as any)
        .from('notification_preferences')
        .upsert(upserts, { onConflict: 'user_id,workspace_id,channel,type' });

      if (error) throw error;
    },
    onSuccess: (_data, updates) => {
      queryClient.invalidateQueries({
        queryKey: ['notification-preferences', userId, workspaceId],
      });
      toast({
        title: 'Preferências salvas',
        description: 'Suas preferências de notificação foram atualizadas.',
      });
    },
    onError: (error: Error) => {
      console.error('Error updating preferences:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível atualizar suas preferências.',
        variant: 'destructive',
      });
    },
  });

  const togglePreference = (key: keyof NotificationPreferences) => {
    updatePreferences.mutate({
      [key]: !preferences[key],
    });
  };

  return {
    preferences,
    isLoading,
    updatePreferences: updatePreferences.mutate,
    togglePreference,
    isUpdating: updatePreferences.isPending,
  };
}
