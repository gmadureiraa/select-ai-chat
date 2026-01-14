import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export type LatePlatform = 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'threads';

interface UseLateConnectionProps {
  clientId: string;
}

export function useLateConnection({ clientId }: UseLateConnectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<LatePlatform | null>(null);
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track expected connection to correlate postMessage with the correct attempt
  const expectedConnectionRef = useRef<{ clientId: string; platform: LatePlatform } | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const platformNames: Record<LatePlatform, string> = {
    twitter: 'Twitter/X',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    facebook: 'Facebook',
    threads: 'Threads',
    tiktok: 'TikTok',
    youtube: 'YouTube'
  };

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
    expectedConnectionRef.current = null;
    setIsLoading(false);
    setCurrentPlatform(null);
  }, []);

  useEffect(() => {
    // Listen for postMessage from OAuth callback popup
    const handleMessage = (event: MessageEvent) => {
      // Only process our OAuth messages
      if (!event.data?.type?.startsWith('late_oauth_')) {
        return;
      }

      const messageClientId = event.data.clientId as string | undefined;
      const messagePlatform = event.data.platform as LatePlatform | undefined;
      
      // Validate that this message corresponds to our current connection attempt
      const expected = expectedConnectionRef.current;
      
      if (event.data.type === 'late_oauth_success') {
        // Always invalidate queries for the clientId that actually got connected
        if (messageClientId) {
          queryClient.invalidateQueries({ queryKey: ['social-credentials', messageClientId] });
          queryClient.invalidateQueries({ queryKey: ['client-platform-status', messageClientId] });
        }
        
        // Check if this is for our current connection attempt
        if (expected && messagePlatform === expected.platform) {
          cleanup();
          
          const displayName = platformNames[messagePlatform] || messagePlatform;
          
          // If the connected clientId differs from what we expected, warn the user
          if (messageClientId && messageClientId !== expected.clientId) {
            toast({
              title: "Atenção",
              description: `${displayName} foi conectado para outro cliente. Verifique qual cliente está selecionado.`,
              variant: "default",
            });
          } else {
            toast({
              title: "Conectado!",
              description: `${displayName} foi conectado com sucesso.`,
            });
          }
          
          // Also invalidate the expected client queries to refresh UI
          queryClient.invalidateQueries({ queryKey: ['social-credentials', expected.clientId] });
          queryClient.invalidateQueries({ queryKey: ['client-platform-status', expected.clientId] });
        } else if (!expected) {
          // No active connection attempt, just invalidate received clientId
          const displayName = messagePlatform ? (platformNames[messagePlatform] || messagePlatform) : 'Plataforma';
          toast({
            title: "Conectado!",
            description: `${displayName} foi conectado com sucesso.`,
          });
        }
        // If platform doesn't match, ignore (stale message from another attempt)
        
      } else if (event.data.type === 'late_oauth_error') {
        // Only show error if it matches our expected connection
        if (expected && (!messagePlatform || messagePlatform === expected.platform)) {
          cleanup();
          toast({
            title: "Erro na conexão",
            description: event.data.error || "Falha ao conectar. Tente novamente.",
            variant: "destructive",
          });
        }
        
        // Invalidate queries for the affected client
        if (messageClientId) {
          queryClient.invalidateQueries({ queryKey: ['social-credentials', messageClientId] });
          queryClient.invalidateQueries({ queryKey: ['client-platform-status', messageClientId] });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      cleanup();
    };
  }, [cleanup, queryClient, toast, platformNames]);

  const openOAuth = useCallback(async (platform: LatePlatform) => {
    try {
      setIsLoading(true);
      setCurrentPlatform(platform);
      
      // Store expected connection for correlation
      expectedConnectionRef.current = { clientId, platform };

      const { data, error } = await supabase.functions.invoke('late-oauth-start', {
        body: { clientId, platform }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.authUrl) {
        throw new Error("URL de autorização não recebida");
      }

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popupRef.current = window.open(
        data.authUrl,
        `${platform}_oauth`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popupRef.current) {
        throw new Error("Popup bloqueado. Por favor, permita popups para este site.");
      }

      // Set timeout for OAuth (5 minutes)
      timeoutRef.current = setTimeout(() => {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        cleanup();
        toast({
          title: "Tempo esgotado",
          description: "O processo de conexão expirou. Tente novamente.",
          variant: "destructive",
        });
      }, 5 * 60 * 1000);

      // Monitor popup
      intervalRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          cleanup();
          // Invalidate queries to refresh credentials
          queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
          queryClient.invalidateQueries({ queryKey: ['client-platform-status', clientId] });
        }
      }, 500);

    } catch (error) {
      cleanup();
      toast({
        title: "Erro na conexão",
        description: error instanceof Error ? error.message : "Falha ao iniciar conexão",
        variant: "destructive",
      });
    }
  }, [clientId, cleanup, queryClient, toast]);

  const publishContent = useCallback(async (
    platform: LatePlatform,
    content: string,
    options?: {
      mediaUrls?: string[];
      planningItemId?: string;
    }
  ) => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('late-post', {
        body: {
          clientId,
          platform,
          content,
          mediaUrls: options?.mediaUrls,
          planningItemId: options?.planningItemId,
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const displayName = platformNames[platform] || platform;
      
      toast({
        title: "Publicado!",
        description: `Conteúdo publicado no ${displayName} com sucesso.`,
      });

      // Invalidate planning and content library queries to refresh UI immediately
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      queryClient.invalidateQueries({ queryKey: ['planning-columns'] });
      queryClient.invalidateQueries({ queryKey: ['client-content-library', clientId] });
      queryClient.invalidateQueries({ queryKey: ['content-library', clientId] });

      return data;

    } catch (error) {
      const displayName = platformNames[platform] || platform;
      
      toast({
        title: "Falha na publicação",
        description: error instanceof Error ? error.message : `Falha ao publicar no ${displayName}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast, platformNames, queryClient]);

  const disconnect = useCallback(async (platform: LatePlatform) => {
    try {
      setIsLoading(true);
      setCurrentPlatform(platform);

      const { error } = await supabase
        .from('client_social_credentials')
        .delete()
        .eq('client_id', clientId)
        .eq('platform', platform);

      if (error) {
        throw new Error(error.message);
      }

      queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
      queryClient.invalidateQueries({ queryKey: ['client-platform-status', clientId] });

      const displayName = platformNames[platform];

      toast({
        title: "Desconectado",
        description: `${displayName} foi desconectado com sucesso.`,
      });

    } catch (error) {
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : "Falha ao desconectar",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setCurrentPlatform(null);
    }
  }, [clientId, queryClient, toast, platformNames]);

  return {
    openOAuth,
    publishContent,
    disconnect,
    isLoading,
    currentPlatform,
    isPopupOpen: popupRef.current !== null && !popupRef.current.closed,
  };
}
