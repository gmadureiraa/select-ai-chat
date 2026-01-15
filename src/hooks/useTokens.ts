import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export interface TokenBalance {
  balance: number;
  tokensUsedThisPeriod: number;
  periodEnd: string;
}

export interface TokenTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export const useTokens = () => {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  // Fetch token balance
  const { data: tokenData, isLoading, refetch } = useQuery({
    queryKey: ["tokens", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;

      const { data, error } = await supabase
        .from("workspace_tokens")
        .select("balance, tokens_used_this_period, period_end")
        .eq("workspace_id", workspace.id)
        .single();

      if (error) return null;

      return {
        balance: data.balance,
        tokensUsedThisPeriod: data.tokens_used_this_period,
        periodEnd: data.period_end,
      } as TokenBalance;
    },
    enabled: !!workspace?.id,
  });

  // Fetch transaction history
  const { data: transactions } = useQuery({
    queryKey: ["token-transactions", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      const { data, error } = await supabase
        .from("token_transactions")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) return [];
      return data as TokenTransaction[];
    },
    enabled: !!workspace?.id,
  });

  // Fetch current plan
  const { data: plan } = useQuery({
    queryKey: ["subscription-plan", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;

      const { data, error } = await supabase
        .from("workspace_subscriptions")
        .select(`
          id,
          status,
          stripe_subscription_id,
          subscription_plans (
            id,
            name,
            type,
            tokens_monthly,
            max_clients,
            max_members,
            features
          )
        `)
        .eq("workspace_id", workspace.id)
        .single();

      if (error) return null;

      // Access the nested plan data
      const planData = data.subscription_plans as unknown as {
        id: string;
        name: string;
        type: string;
        tokens_monthly: number;
        max_clients: number;
        max_members: number;
        features: string[];
      };

      return {
        ...planData,
        status: data.status,
        hasStripeSubscription: !!data.stripe_subscription_id,
      };
    },
    enabled: !!workspace?.id,
  });

  // Check if has enough tokens
  const hasTokens = (amount: number): boolean => {
    if (!tokenData) return false;
    // Enterprise plans (tokens_monthly = 0) have unlimited
    if (plan?.type === "enterprise") return true;
    return tokenData.balance >= amount;
  };

  // Formatted balance
  const formattedBalance = tokenData?.balance 
    ? new Intl.NumberFormat("pt-BR").format(tokenData.balance)
    : "0";

  // Is enterprise (unlimited)
  const isUnlimited = plan?.type === "enterprise";

  return {
    balance: tokenData?.balance ?? 0,
    tokensUsedThisPeriod: tokenData?.tokensUsedThisPeriod ?? 0,
    periodEnd: tokenData?.periodEnd,
    transactions: transactions ?? [],
    plan,
    isLoading,
    hasTokens,
    formattedBalance,
    isUnlimited,
    refetch,
  };
};
