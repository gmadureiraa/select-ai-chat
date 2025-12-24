import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SupportedPlatform = 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'newsletter' | 'blog' | 'tiktok' | 'other';

export interface PlatformStatus {
  platform: SupportedPlatform;
  hasApi: boolean;
  isValid: boolean;
  accountName: string | null;
  lastValidated: string | null;
  error: string | null;
}

export interface ClientPlatformStatuses {
  [key: string]: PlatformStatus;
}

// Platforms that support auto-publishing via API
const AUTO_PUBLISH_PLATFORMS: SupportedPlatform[] = ['twitter', 'linkedin'];

export function useClientPlatformStatus(clientId: string | null | undefined) {
  const { data: statuses, isLoading } = useQuery({
    queryKey: ['client-platform-status', clientId],
    queryFn: async (): Promise<ClientPlatformStatuses> => {
      if (!clientId) return {};

      const { data: credentials, error } = await supabase
        .from('client_social_credentials')
        .select('platform, is_valid, account_name, last_validated_at, validation_error')
        .eq('client_id', clientId);

      if (error) throw error;

      const statusMap: ClientPlatformStatuses = {};

      // Initialize all platforms with default status
      const allPlatforms: SupportedPlatform[] = ['twitter', 'linkedin', 'instagram', 'youtube', 'newsletter', 'blog', 'tiktok', 'other'];
      
      for (const platform of allPlatforms) {
        statusMap[platform] = {
          platform,
          hasApi: false,
          isValid: false,
          accountName: null,
          lastValidated: null,
          error: null,
        };
      }

      // Update with actual credentials
      for (const cred of credentials || []) {
        const platform = cred.platform as SupportedPlatform;
        if (statusMap[platform]) {
          statusMap[platform] = {
            platform,
            hasApi: true,
            isValid: cred.is_valid || false,
            accountName: cred.account_name,
            lastValidated: cred.last_validated_at,
            error: cred.validation_error,
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
    if (!AUTO_PUBLISH_PLATFORMS.includes(platform)) return false;
    const status = getPlatformStatus(platform);
    return status?.hasApi === true && status?.isValid === true;
  };

  const getPublicationMode = (platform: SupportedPlatform | null): 'auto' | 'manual' => {
    return canAutoPublish(platform) ? 'auto' : 'manual';
  };

  return {
    statuses: statuses || {},
    isLoading,
    getPlatformStatus,
    canAutoPublish,
    getPublicationMode,
    supportedAutoPublishPlatforms: AUTO_PUBLISH_PLATFORMS,
  };
}
