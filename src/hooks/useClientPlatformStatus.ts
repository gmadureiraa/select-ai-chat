import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef } from 'react';

export type SupportedPlatform = 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'newsletter' | 'blog' | 'tiktok' | 'facebook' | 'threads' | 'other';

export interface PlatformStatus {
  platform: SupportedPlatform;
  hasApi: boolean;
  isValid: boolean;
  accountName: string | null;
  lastValidated: string | null;
  error: string | null;
  isLateApi: boolean;
}

export interface ClientPlatformStatuses {
  [key: string]: PlatformStatus;
}

// Platforms that support auto-publishing via Late API
const LATE_API_PLATFORMS: SupportedPlatform[] = ['twitter', 'linkedin', 'instagram', 'facebook', 'threads', 'tiktok', 'youtube'];

export function useClientPlatformStatus(clientId: string | null | undefined) {
  const queryClient = useQueryClient();
  const lastVerifiedRef = useRef<string | null>(null);
  
  const { data: statuses, isLoading } = useQuery({
    queryKey: ['client-platform-status', clientId],
    queryFn: async (): Promise<ClientPlatformStatuses> => {
      if (!clientId) return {};

      const { data: credentials, error } = await supabase
        .from('client_social_credentials')
        .select('platform, is_valid, account_name, last_validated_at, validation_error, metadata')
        .eq('client_id', clientId);

      if (error) throw error;

      const statusMap: ClientPlatformStatuses = {};

      // Initialize all platforms with default status
      const allPlatforms: SupportedPlatform[] = ['twitter', 'linkedin', 'instagram', 'youtube', 'newsletter', 'blog', 'tiktok', 'facebook', 'threads', 'other'];
      
      for (const platform of allPlatforms) {
        statusMap[platform] = {
          platform,
          hasApi: false,
          isValid: false,
          accountName: null,
          lastValidated: null,
          error: null,
          isLateApi: false,
        };
      }

      // Update with actual credentials
      for (const cred of credentials || []) {
        const platform = cred.platform as SupportedPlatform;
        const metadata = cred.metadata as Record<string, unknown> | null;
        const isLateApi = !!(metadata?.late_account_id || metadata?.late_profile_id);
        
        if (statusMap[platform]) {
          statusMap[platform] = {
            platform,
            hasApi: true,
            isValid: cred.is_valid || false,
            accountName: cred.account_name,
            lastValidated: cred.last_validated_at,
            error: cred.validation_error,
            isLateApi,
          };
        }
      }

      return statusMap;
    },
    enabled: !!clientId,
    staleTime: 30000, // Cache for 30 seconds
  });

  const getPlatformStatus = (platform: SupportedPlatform | null): PlatformStatus | null => {
    if (!platform || !statuses) return null;
    return statuses[platform] || null;
  };

  const canAutoPublish = (platform: SupportedPlatform | null): boolean => {
    if (!platform) return false;
    if (!LATE_API_PLATFORMS.includes(platform)) return false;
    const status = getPlatformStatus(platform);
    return status?.hasApi === true && status?.isValid === true;
  };

  const getPublicationMode = (platform: SupportedPlatform | null): 'auto' | 'manual' => {
    return canAutoPublish(platform) ? 'auto' : 'manual';
  };

  // Mutation to verify accounts with Late API
  const verifyAccountsMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase.functions.invoke('late-verify-accounts', {
        body: { clientId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.deletedCount > 0 || data?.invalidCount > 0) {
        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['client-platform-status', clientId] });
        queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
      }
    },
  });

  // Auto-verify accounts on mount (with 5 minute stale time)
  useEffect(() => {
    if (!clientId || !statuses) return;
    
    // Check if we have any Late API connected platforms
    const hasLateConnections = Object.values(statuses).some(s => s.isLateApi && s.hasApi);
    if (!hasLateConnections) return;
    
    // Only verify once per 5 minutes per client
    const now = Date.now();
    const lastVerifiedKey = `late-verify-${clientId}`;
    const lastVerified = localStorage.getItem(lastVerifiedKey);
    const staleTime = 5 * 60 * 1000; // 5 minutes
    
    if (lastVerified && (now - parseInt(lastVerified)) < staleTime) {
      return;
    }
    
    // Prevent duplicate verifications
    if (lastVerifiedRef.current === clientId) return;
    lastVerifiedRef.current = clientId;
    
    localStorage.setItem(lastVerifiedKey, now.toString());
    verifyAccountsMutation.mutate();
  }, [clientId, statuses, verifyAccountsMutation]);

  return {
    statuses: statuses || {},
    isLoading,
    getPlatformStatus,
    canAutoPublish,
    getPublicationMode,
    supportedAutoPublishPlatforms: LATE_API_PLATFORMS,
    verifyAccounts: verifyAccountsMutation,
    isVerifying: verifyAccountsMutation.isPending,
  };
}
