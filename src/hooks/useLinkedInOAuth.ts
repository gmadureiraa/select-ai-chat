import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export function useLinkedInOAuthPopup(clientId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [popup, setPopup] = useState<Window | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const openPopup = useCallback(async () => {
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
        return;
      }

      setPopup(newPopup);
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
  }, [clientId, toast]);

  // Monitor popup close and check for success
  useEffect(() => {
    if (!popup) return;

    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        setPopup(null);
        
        // Invalidate queries to refresh credential status
        queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [popup, clientId, queryClient]);

  return {
    openPopup,
    isLoading,
    isPopupOpen: !!popup
  };
}
