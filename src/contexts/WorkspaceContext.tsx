import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface SubscriptionData {
  id: string;
  plan: {
    id: string;
    name: string;
    type: string;
    tokens_monthly: number;
    max_clients: number;
    max_members: number;
    features: string[];
  };
  status: string;
  current_period_end: string;
}

export interface TokensData {
  balance: number;
  tokens_used_this_period: number;
  period_end: string;
}

interface WorkspaceContextType {
  workspace: WorkspaceData | null;
  subscription: SubscriptionData | null;
  tokens: TokensData | null;
  isLoading: boolean;
  error: string | null;
  slug: string | null;
  setSlug: (slug: string) => void;
  refetchTokens: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Sistema interno Kaleidos: slug fixo
const KALEIDOS_SLUG = "kaleidos";

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  // Slug fixo para Kaleidos - mantido para compatibilidade com código existente
  const [slug, setSlug] = useState<string | null>(KALEIDOS_SLUG);

  // Fetch workspace - sempre usa Kaleidos
  const { 
    data: workspace, 
    isLoading: isLoadingWorkspace,
    error: workspaceError 
  } = useQuery({
    queryKey: ["workspace", KALEIDOS_SLUG],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("slug", KALEIDOS_SLUG)
        .single();

      if (error) throw error;
      return data as WorkspaceData;
    },
    enabled: true, // Sempre carrega o workspace Kaleidos
  });

  // Fetch subscription
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ["workspace-subscription", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;

      const { data, error } = await supabase
        .from("workspace_subscriptions")
        .select(`
          id,
          status,
          current_period_end,
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

      // Access the nested plan data correctly
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
        id: data.id,
        plan: planData,
        status: data.status,
        current_period_end: data.current_period_end,
      } as SubscriptionData;
    },
    enabled: !!workspace?.id,
  });

  // Fetch tokens
  const { 
    data: tokens, 
    isLoading: isLoadingTokens,
    refetch: refetchTokens 
  } = useQuery({
    queryKey: ["workspace-tokens", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;

      const { data, error } = await supabase
        .from("workspace_tokens")
        .select("balance, tokens_used_this_period, period_end")
        .eq("workspace_id", workspace.id)
        .single();

      if (error) return null;
      return data as TokensData;
    },
    enabled: !!workspace?.id,
  });

  const isLoading = isLoadingWorkspace || isLoadingSubscription || isLoadingTokens;
  const error = workspaceError ? "Workspace não encontrado" : null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        subscription,
        tokens,
        isLoading,
        error,
        slug,
        setSlug,
        refetchTokens,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
  }
  return context;
};
