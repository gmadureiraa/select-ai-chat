import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export interface PlanFeatures {
  isEnterprise: boolean;
  isPro: boolean;
  isCanvas: boolean;
  hasPlanning: boolean;
  hasCalendar: boolean;
  hasKanban: boolean;
  hasSocialPublishing: boolean;
  canAccessProfiles: boolean;
  canAccessPerformance: boolean;
  canAccessLibrary: boolean;
  canAccessKaiChat: boolean;
  canCreateProfiles: boolean;
  planType: string | null;
  isLoading: boolean;
}

export function usePlanFeatures(): PlanFeatures {
  const { workspace } = useWorkspaceContext();

  const { data, isLoading } = useQuery({
    queryKey: ['plan-features', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;

      const { data: subscription, error } = await supabase
        .from('workspace_subscriptions')
        .select(`
          *,
          subscription_plans (
            type,
            name,
            features
          )
        `)
        .eq('workspace_id', workspace.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error fetching plan features:', error);
        return null;
      }

      return subscription;
    },
    enabled: !!workspace?.id,
  });

  const planType = data?.subscription_plans?.type || null;
  const isEnterprise = planType === 'enterprise';
  const isPro = planType === 'pro' || isEnterprise;
  // Canvas plan is "starter" in the database (legacy name)
  const isCanvas = planType === 'starter' || (!isPro && !isEnterprise && planType !== null);

  // Planning features are only available on Pro and Enterprise
  const hasPlanning = isPro;

  // Profile, Performance, Library, and Kai Chat access - only Pro and Enterprise
  const canAccessProfiles = isPro;
  const canAccessPerformance = isPro;
  const canAccessLibrary = isPro;
  const canAccessKaiChat = isPro;
  const canCreateProfiles = isPro;

  return {
    isEnterprise,
    isPro,
    isCanvas,
    hasPlanning,
    hasCalendar: isPro,
    hasKanban: isPro,
    hasSocialPublishing: isPro,
    canAccessProfiles,
    canAccessPerformance,
    canAccessLibrary,
    canAccessKaiChat,
    canCreateProfiles,
    planType,
    isLoading,
  };
}
