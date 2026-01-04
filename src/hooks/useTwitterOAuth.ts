import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useStartTwitterOAuth() {
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('twitter-oauth-start', {
        body: { clientId }
      });
      
      if (error) throw error;
      if (!data?.authUrl) throw new Error('Failed to get authorization URL');
      
      return data.authUrl as string;
    },
    onError: (error) => {
      console.error('Twitter OAuth start error:', error);
      toast.error(`Erro ao iniciar conexão: ${error.message}`);
    }
  });
}

export function useTwitterOAuthPopup(clientId: string) {
  const queryClient = useQueryClient();
  const startOAuth = useStartTwitterOAuth();

  const openPopup = async () => {
    try {
      const authUrl = await startOAuth.mutateAsync(clientId);
      
      // Open popup window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        'twitter-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        toast.error('Popup bloqueado! Permita popups para este site.');
        return;
      }

      // Listen for messages from popup
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'TWITTER_OAUTH_SUCCESS') {
          toast.success(`X/Twitter conectado! @${event.data.accountName}`);
          queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
          window.removeEventListener('message', handleMessage);
        } else if (event.data?.type === 'TWITTER_OAUTH_ERROR') {
          toast.error(`Erro ao conectar: ${event.data.error}`);
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Also poll for popup close (in case message fails)
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', handleMessage);
          // Refresh credentials after popup closes
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
          }, 500);
        }
      }, 500);

    } catch (error) {
      console.error('Twitter OAuth error:', error);
    }
  };

  return {
    openPopup,
    isLoading: startOAuth.isPending
  };
}
