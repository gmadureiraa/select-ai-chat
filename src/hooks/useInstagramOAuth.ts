import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface InstagramToken {
  id: string;
  user_id: string;
  client_id: string;
  access_token: string;
  user_access_token: string | null;
  page_id: string | null;
  instagram_business_id: string | null;
  instagram_username: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useInstagramConnection = (clientId: string) => {
  return useQuery({
    queryKey: ['instagram-connection', clientId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('instagram_tokens')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as InstagramToken | null;
    },
    enabled: !!clientId,
  });
};

export const useStartInstagramOAuth = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('instagram-oauth-start', {
        body: { clientId },
      });

      if (error) throw error;
      if (!data.authUrl) throw new Error('No auth URL returned');

      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: (error) => {
      toast({
        title: "Erro ao conectar Instagram",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });
};

export const useFetchInstagramOAuthMetrics = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('fetch-instagram-oauth-metrics', {
        body: { clientId },
      });

      if (error) throw error;
      if (data.needsAuth) throw new Error('Instagram not connected');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
      toast({
        title: "Instagram sincronizado",
        description: `@${data.profile?.username}: ${data.metrics?.recentPostsAnalyzed} posts analisados.`,
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

export const useDisconnectInstagram = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('instagram_tokens')
        .delete()
        .eq('client_id', clientId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-connection'] });
      toast({
        title: "Instagram desconectado",
        description: "A conexão com o Instagram foi removida.",
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
