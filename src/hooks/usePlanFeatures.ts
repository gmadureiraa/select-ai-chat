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

  return {
    isEnterprise,
    isPro,
    isCanvas,
    hasPlanning,
    hasCalendar: isPro,
    hasKanban: isPro,
    hasSocialPublishing: isPro,
    planType,
    isLoading,
  };
}
