import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TwitterToken {
  id: string;
  user_id: string;
  client_id: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  twitter_id: string | null;
  username: string | null;
  twitter_api_key: string | null;
  twitter_api_secret: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useTwitterConnection = (clientId: string) => {
  return useQuery({
    queryKey: ["twitter-connection", clientId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("twitter_tokens")
        .select("*")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (error) throw error;
      return data as TwitterToken | null;
    },
    enabled: !!clientId,
  });
};

export const useStartTwitterOAuth = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const { data, error } = await supabase.functions.invoke("twitter-oauth-start", {
        body: { clientId },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
      return data;
    },
    onError: (error) => {
      console.error("Twitter OAuth error:", error);
      toast({
        title: "Erro ao conectar",
        description: "Não foi possível iniciar a conexão com o X. Verifique as credenciais.",
        variant: "destructive",
      });
    },
  });
};

export const useDisconnectTwitter = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("twitter_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("client_id", clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twitter-connection", clientId] });
      toast({
        title: "Desconectado",
        description: "Conta do X desconectada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível desconectar a conta.",
        variant: "destructive",
      });
    },
  });
};

export const useSaveTwitterCredentials = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ apiKey, apiSecret }: { apiKey: string; apiSecret: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if record exists
      const { data: existing } = await supabase
        .from("twitter_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from("twitter_tokens")
          .update({
            twitter_api_key: apiKey,
            twitter_api_secret: apiSecret,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new record with placeholder access_token
        const { error } = await supabase
          .from("twitter_tokens")
          .insert({
            user_id: user.id,
            client_id: clientId,
            access_token: "pending",
            twitter_api_key: apiKey,
            twitter_api_secret: apiSecret,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twitter-connection", clientId] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as credenciais.",
        variant: "destructive",
      });
    },
  });
};
