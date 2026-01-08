import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const POPUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max

export function useLinkedInOAuthPopup(clientId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cleanup function
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    popupRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const openPopup = useCallback(async () => {
    cleanup(); // Clean any previous state
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-oauth-start', {
        body: { clientId }
      });

      if (error) throw error;
      
      if (!data?.authUrl) {
        throw new Error(data?.message || 'Falha ao iniciar OAuth do LinkedIn');
      }

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const newPopup = window.open(
        data.authUrl,
        'linkedin_oauth',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (!newPopup) {
        toast({
          title: 'Popup bloqueado',
          description: 'Permita popups para conectar o LinkedIn.',
          variant: 'destructive'
        });
        setIsLoading(false);
        return;
      }

      popupRef.current = newPopup;

      // Set timeout to prevent infinite polling
      timeoutRef.current = window.setTimeout(() => {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        cleanup();
        toast({
          title: 'Tempo esgotado',
          description: 'A conexão com LinkedIn expirou. Tente novamente.',
          variant: 'destructive'
        });
      }, POPUP_TIMEOUT_MS);

      // Monitor popup close
      intervalRef.current = window.setInterval(() => {
        if (popupRef.current?.closed) {
          cleanup();
          queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
        }
      }, 500);
    } catch (error) {
      console.error('[useLinkedInOAuth] Error:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (message.includes('not configured')) {
        toast({
          title: 'LinkedIn não configurado',
          description: 'As credenciais do LinkedIn OAuth não estão configuradas neste projeto.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Erro ao conectar LinkedIn',
          description: message,
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast, cleanup, queryClient]);

  return {
    openPopup,
    isLoading,
    isPopupOpen: !!popupRef.current
  };
}
