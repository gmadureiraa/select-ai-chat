import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface YouTubeToken {
  id: string;
  user_id: string;
  client_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  channel_id: string | null;
  channel_title: string | null;
  created_at: string;
  updated_at: string;
}

export const useYouTubeConnection = (clientId: string) => {
  return useQuery({
    queryKey: ['youtube-connection', clientId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('youtube_tokens')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as YouTubeToken | null;
    },
    enabled: !!clientId,
  });
};

export const useStartYouTubeOAuth = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      // Edge function derives userId from JWT authentication
      const { data, error } = await supabase.functions.invoke('youtube-oauth-start', {
        body: { clientId },
      });

      if (error) throw error;
      if (!data.authUrl) throw new Error('No auth URL returned');

      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      // Redirect to Google OAuth
      window.location.href = authUrl;
    },
    onError: (error) => {
      toast({
        title: "Erro ao conectar YouTube",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });
};

export const useFetchYouTubeAnalytics = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('fetch-youtube-analytics', {
        body: { clientId },
      });

      if (error) throw error;
      if (data.needsAuth) throw new Error('YouTube not connected');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['youtube-videos'] });
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
      toast({
        title: "YouTube sincronizado",
        description: `${data.daysUpdated} dias de métricas atualizados.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao buscar métricas",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });
};

export const useDisconnectYouTube = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('youtube_tokens')
        .delete()
        .eq('client_id', clientId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-connection'] });
      toast({
        title: "YouTube desconectado",
        description: "A conexão com o YouTube foi removida.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });
};
