import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface NotificationPreferences {
  push_enabled: boolean;
  assignment_notifications: boolean;
  due_date_notifications: boolean;
  publish_notifications: boolean;
  mention_notifications: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  push_enabled: true,
  assignment_notifications: true,
  due_date_notifications: true,
  publish_notifications: true,
  mention_notifications: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences = DEFAULT_PREFERENCES, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_PREFERENCES;

      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching notification preferences:', error);
        return DEFAULT_PREFERENCES;
      }

      // Merge with defaults to ensure all keys exist
      const rawPrefs = data?.notification_preferences;
      const prefs = typeof rawPrefs === 'object' && rawPrefs !== null && !Array.isArray(rawPrefs)
        ? (rawPrefs as Record<string, unknown>)
        : {};
      
      return {
        push_enabled: typeof prefs.push_enabled === 'boolean' ? prefs.push_enabled : DEFAULT_PREFERENCES.push_enabled,
        assignment_notifications: typeof prefs.assignment_notifications === 'boolean' ? prefs.assignment_notifications : DEFAULT_PREFERENCES.assignment_notifications,
        due_date_notifications: typeof prefs.due_date_notifications === 'boolean' ? prefs.due_date_notifications : DEFAULT_PREFERENCES.due_date_notifications,
        publish_notifications: typeof prefs.publish_notifications === 'boolean' ? prefs.publish_notifications : DEFAULT_PREFERENCES.publish_notifications,
        mention_notifications: typeof prefs.mention_notifications === 'boolean' ? prefs.mention_notifications : DEFAULT_PREFERENCES.mention_notifications,
      };
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const newPreferences = {
        ...preferences,
        ...updates,
      };

      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: newPreferences })
        .eq('id', user.id);

      if (error) throw error;
      return newPreferences;
    },
    onSuccess: (newPreferences) => {
      queryClient.setQueryData(['notification-preferences', user?.id], newPreferences);
      toast({
        title: 'Preferências salvas',
        description: 'Suas preferências de notificação foram atualizadas.',
      });
    },
    onError: (error) => {
      console.error('Error updating preferences:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar suas preferências.',
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
