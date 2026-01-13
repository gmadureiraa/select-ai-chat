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
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    setIsLoading(false);
    setCurrentPlatform(null);
  }, []);

  useEffect(() => {
    // Listen for postMessage from OAuth callback popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'late_oauth_success') {
        cleanup();
        queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
        queryClient.invalidateQueries({ queryKey: ['client-platform-status', clientId] });
        toast({
          title: "Connected!",
          description: `${event.data.platform} connected successfully.`,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      cleanup();
    };
  }, [cleanup, clientId, queryClient, toast]);

  const openOAuth = useCallback(async (platform: LatePlatform) => {
    try {
      setIsLoading(true);
      setCurrentPlatform(platform);

      const { data, error } = await supabase.functions.invoke('late-oauth-start', {
        body: { clientId, platform }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.authUrl) {
        throw new Error("No authorization URL received");
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
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      // Set timeout for OAuth (5 minutes)
      timeoutRef.current = setTimeout(() => {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        cleanup();
        toast({
          title: "Timeout",
          description: "OAuth process timed out. Please try again.",
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
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Failed to start OAuth",
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

      toast({
        title: "Published!",
        description: `Content published to ${platform} successfully.`,
      });

      return data;

    } catch (error) {
      toast({
        title: "Publication Failed",
        description: error instanceof Error ? error.message : "Failed to publish content",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast]);

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

      const platformNames: Record<LatePlatform, string> = {
        twitter: 'Twitter',
        linkedin: 'LinkedIn',
        instagram: 'Instagram',
        facebook: 'Facebook',
        threads: 'Threads',
        tiktok: 'TikTok',
        youtube: 'YouTube'
      };

      toast({
        title: "Desconectado",
        description: `${platformNames[platform]} foi desconectado com sucesso.`,
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
  }, [clientId, queryClient, toast]);

  return {
    openOAuth,
    publishContent,
    disconnect,
    isLoading,
    currentPlatform,
    isPopupOpen: popupRef.current !== null && !popupRef.current.closed,
  };
}
