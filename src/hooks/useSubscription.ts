import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipos do schema (subscription_plans + workspace_subscriptions + workspace_tokens)
 */
export type PlanType = "free" | "starter" | "pro" | "enterprise";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

export interface SubscriptionPlan {
  id: string;
  name: string;
  type: PlanType;
  price_monthly: number;
  price_yearly: number;
  tokens_monthly: number;
  max_clients: number;
  max_members: number;
  features: Record<string, unknown> | unknown[];
  is_active: boolean;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  trial_days: number | null;
  created_at: string;
}

export interface WorkspaceSubscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  subscription_plans?: SubscriptionPlan | null;
}

export interface WorkspaceTokens {
  id: string;
  workspace_id: string;
  balance: number;
  tokens_used_this_period: number;
  period_start: string;
  period_end: string;
}

export interface TokenTransaction {
  id: string;
  workspace_id: string;
  user_id: string | null;
  type:
    | "subscription_credit"
    | "purchase"
    | "usage"
    | "refund"
    | "bonus"
    | "adjustment";
  amount: number;
  balance_after: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Subscription atual do workspace + plano embeded.
 */
export function useSubscription(workspaceId: string | null | undefined) {
  return useQuery<WorkspaceSubscription | null>({
    queryKey: ["workspace-subscription", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("workspace_subscriptions")
        .select("*, subscription_plans(*)")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WorkspaceSubscription | null;
    },
  });
}

/**
 * Saldo de tokens do workspace + uso no período.
 */
export function useWorkspaceTokens(workspaceId: string | null | undefined) {
  return useQuery<WorkspaceTokens | null>({
    queryKey: ["workspace-tokens", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("workspace_tokens")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WorkspaceTokens | null;
    },
  });
}

/**
 * Lista de planos ativos pra exibição na tela de upgrade.
 */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SubscriptionPlan[];
    },
  });
}

/**
 * Histórico de transações de token (últimas N).
 */
export function useTokenTransactions(
  workspaceId: string | null | undefined,
  limit = 20,
) {
  return useQuery<TokenTransaction[]>({
    queryKey: ["token-transactions", workspaceId, limit],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("token_transactions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as TokenTransaction[];
    },
  });
}
