import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef, useCallback } from "react";

const POPUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max

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
  
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    popupRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const openPopup = async () => {
    cleanup(); // Clean any previous state
    
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

      popupRef.current = popup;

      // Listen for messages from popup
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'TWITTER_OAUTH_SUCCESS') {
          toast.success(`X/Twitter conectado! @${event.data.accountName}`);
          queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
          cleanup();
        } else if (event.data?.type === 'TWITTER_OAUTH_ERROR') {
          toast.error(`Erro ao conectar: ${event.data.error}`);
          cleanup();
        }
      };

      messageHandlerRef.current = handleMessage;
      window.addEventListener('message', handleMessage);

      // Set timeout to prevent infinite polling
      timeoutRef.current = window.setTimeout(() => {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        cleanup();
        toast.error('Tempo esgotado. Tente novamente.');
      }, POPUP_TIMEOUT_MS);

      // Poll for popup close (in case message fails)
      pollTimerRef.current = window.setInterval(() => {
        if (popupRef.current?.closed) {
          cleanup();
          // Refresh credentials after popup closes
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
          }, 500);
        }
      }, 500);

    } catch (error) {
      console.error('Twitter OAuth error:', error);
      cleanup();
    }
  };

  return {
    openPopup,
    isLoading: startOAuth.isPending
  };
}
