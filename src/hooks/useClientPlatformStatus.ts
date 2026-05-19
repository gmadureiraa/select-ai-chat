import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef } from 'react';
import { apiInvoke } from '../lib/apiInvoke';

export type SupportedPlatform = 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'newsletter' | 'blog' | 'tiktok' | 'facebook' | 'threads' | 'whatsapp' | 'other';

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

// Plataformas com autopublish via Late/Zernio (publisher único pós 2026-05-18 rev2).
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

      const allPlatforms: SupportedPlatform[] = ['twitter', 'linkedin', 'instagram', 'youtube', 'newsletter', 'blog', 'tiktok', 'facebook', 'threads', 'whatsapp', 'other'];

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

      for (const cred of credentials || []) {
        const platform = cred.platform as SupportedPlatform;
        const metadata = cred.metadata as Record<string, unknown> | null;
        // isLateApi true = autopublish via Late/Zernio (late_account_id ou late_profile_id presente)
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
    staleTime: 30000,
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

  // Verify accounts com Late/Zernio API (revalida tokens OAuth + remove órfãos)
  // 2026-05-19 P0 fix audit: invalidação era CONDICIONAL (só se deletedCount ou
  // invalidCount > 0), então quando o Late retornava `{ ok: true }` sem esses
  // campos, a UI nunca atualizava. Agora invalida sempre — query reusa cache se
  // statuses não mudou de fato.
  const verifyAccountsMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) return null;
      const { data, error } = await apiInvoke('late-verify-accounts', {
        body: { clientId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (!clientId) return;
      queryClient.invalidateQueries({ queryKey: ['client-platform-status', clientId] });
      queryClient.invalidateQueries({ queryKey: ['social-credentials', clientId] });
    },
  });

  // Auto-verify accounts on mount (com 5 min stale time).
  // 2026-05-19 P0 fix audit: deps include `verifyAccountsMutation` (objeto novo
  // a cada render) → loop. Agora extrai `mutate` (function ref estável) e tira
  // statuses das deps (gate é via lastVerifiedRef + localStorage).
  const verifyMutate = verifyAccountsMutation.mutate;
  useEffect(() => {
    if (!clientId || !statuses) return;

    const hasLateConnections = Object.values(statuses).some(s => s.isLateApi && s.hasApi);
    if (!hasLateConnections) return;

    const now = Date.now();
    const lastVerifiedKey = `late-verify-${clientId}`;
    const lastVerified = localStorage.getItem(lastVerifiedKey);
    const staleTime = 5 * 60 * 1000;

    if (lastVerified && (now - parseInt(lastVerified)) < staleTime) return;
    if (lastVerifiedRef.current === clientId) return;
    lastVerifiedRef.current = clientId;

    localStorage.setItem(lastVerifiedKey, now.toString());
    verifyMutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

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
