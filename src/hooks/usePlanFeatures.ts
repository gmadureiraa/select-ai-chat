import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface PlanFeatures {
  isEnterprise: boolean;
  hasCalendar: boolean;
  hasKanban: boolean;
  hasSocialPublishing: boolean;
  planType: string | null;
  isLoading: boolean;
}

export function usePlanFeatures(): PlanFeatures {
  const { currentWorkspace } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: ['plan-features', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

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
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Error fetching plan features:', error);
        return null;
      }

      return subscription;
    },
    enabled: !!currentWorkspace?.id,
  });

  const planType = data?.subscription_plans?.type || null;
  const isEnterprise = planType === 'enterprise';

  return {
    isEnterprise,
    hasCalendar: isEnterprise,
    hasKanban: isEnterprise,
    hasSocialPublishing: isEnterprise,
    planType,
    isLoading,
  };
}
