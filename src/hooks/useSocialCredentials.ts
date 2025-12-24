import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SocialCredential {
  id: string;
  client_id: string;
  platform: 'twitter' | 'linkedin';
  is_valid: boolean;
  last_validated_at: string | null;
  validation_error: string | null;
  account_name: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface LinkedInCredentials {
  oauthAccessToken: string;
}

export function useSocialCredentials(clientId: string) {
  const queryClient = useQueryClient();

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['social-credentials', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_social_credentials')
        .select('id, client_id, platform, is_valid, last_validated_at, validation_error, account_name, account_id, created_at, updated_at')
        .eq('client_id', clientId);

      if (error) throw error;
      return data as SocialCredential[];
    },
    enabled: !!clientId,
  });

  const validateTwitter = useMutation({
    mutationFn: async (creds: TwitterCredentials) => {
      const { data, error } = await supabase.functions.invoke('validate-social-credentials', {
        body: {
          clientId,
          platform: 'twitter',
          credentials: creds,
        },
      });

      if (error) throw error;
      
      if (!data.isValid) {
        throw new Error(data.error || 'Credenciais inválidas');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
      toast.success(`Twitter conectado! Conta: @${data.accountName}`);
    },
    onError: (error) => {
      toast.error(`Erro ao validar Twitter: ${error.message}`);
    },
  });

  const validateLinkedIn = useMutation({
    mutationFn: async (creds: LinkedInCredentials) => {
      const { data, error } = await supabase.functions.invoke('validate-social-credentials', {
        body: {
          clientId,
          platform: 'linkedin',
          credentials: creds,
        },
      });

      if (error) throw error;
      
      if (!data.isValid) {
        throw new Error(data.error || 'Credenciais inválidas');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
      toast.success(`LinkedIn conectado! Conta: ${data.accountName}`);
    },
    onError: (error) => {
      toast.error(`Erro ao validar LinkedIn: ${error.message}`);
    },
  });

  const deleteCredential = useMutation({
    mutationFn: async (platform: 'twitter' | 'linkedin') => {
      const { error } = await supabase
        .from('client_social_credentials')
        .delete()
        .eq('client_id', clientId)
        .eq('platform', platform);

      if (error) throw error;
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
      toast.success(`${platform === 'twitter' ? 'Twitter' : 'LinkedIn'} desconectado!`);
    },
    onError: (error) => {
      toast.error(`Erro ao desconectar: ${error.message}`);
    },
  });

  const getCredential = (platform: 'twitter' | 'linkedin') => {
    return credentials?.find(c => c.platform === platform);
  };

  return {
    credentials: credentials || [],
    isLoading,
    twitterCredential: getCredential('twitter'),
    linkedInCredential: getCredential('linkedin'),
    validateTwitter,
    validateLinkedIn,
    deleteCredential,
    getCredential,
  };
}
