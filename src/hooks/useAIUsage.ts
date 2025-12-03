import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useWorkspace } from "./useWorkspace";

export interface AIUsageLog {
  id: string;
  user_id: string;
  model_name: string;
  provider: string;
  edge_function: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
}

export interface UserStats {
  calls: number;
  tokens: number;
  cost: number;
  email?: string;
  fullName?: string;
}

export interface AIUsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { calls: number; tokens: number; cost: number }>;
  byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
  byFunction: Record<string, { calls: number; tokens: number; cost: number }>;
  byUser: Record<string, UserStats>;
  recentLogs: AIUsageLog[];
}

export function useAIUsage(days: number = 30) {
  const { user } = useAuth();
  const { userRole, workspace } = useWorkspace();

  const isAdmin = userRole === "owner" || userRole === "admin";

  return useQuery({
    queryKey: ["ai-usage", user?.id, days, isAdmin, workspace?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch AI usage logs - RLS will handle filtering based on role
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const logs = data as AIUsageLog[];

      // Get unique user IDs for fetching profiles
      const userIds = [...new Set(logs.map(log => log.user_id))];

      // Fetch profiles for all users
      let profilesMap: Record<string, { email: string | null; full_name: string | null }> = {};
      if (isAdmin && userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = { email: p.email, full_name: p.full_name };
          });
        }
      }

      // Aggregate stats
      const stats: AIUsageStats = {
        totalCalls: logs.length,
        totalTokens: 0,
        totalCost: 0,
        byModel: {},
        byProvider: {},
        byFunction: {},
        byUser: {},
        recentLogs: logs.slice(0, 10),
      };

      logs.forEach((log) => {
        const tokens = log.total_tokens || 0;
        const cost = Number(log.estimated_cost_usd) || 0;

        stats.totalTokens += tokens;
        stats.totalCost += cost;

        // By model
        if (!stats.byModel[log.model_name]) {
          stats.byModel[log.model_name] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byModel[log.model_name].calls += 1;
        stats.byModel[log.model_name].tokens += tokens;
        stats.byModel[log.model_name].cost += cost;

        // By provider
        if (!stats.byProvider[log.provider]) {
          stats.byProvider[log.provider] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byProvider[log.provider].calls += 1;
        stats.byProvider[log.provider].tokens += tokens;
        stats.byProvider[log.provider].cost += cost;

        // By function
        if (!stats.byFunction[log.edge_function]) {
          stats.byFunction[log.edge_function] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byFunction[log.edge_function].calls += 1;
        stats.byFunction[log.edge_function].tokens += tokens;
        stats.byFunction[log.edge_function].cost += cost;

        // By user (for admins)
        if (!stats.byUser[log.user_id]) {
          const profile = profilesMap[log.user_id];
          stats.byUser[log.user_id] = { 
            calls: 0, 
            tokens: 0, 
            cost: 0,
            email: profile?.email || undefined,
            fullName: profile?.full_name || undefined
          };
        }
        stats.byUser[log.user_id].calls += 1;
        stats.byUser[log.user_id].tokens += tokens;
        stats.byUser[log.user_id].cost += cost;
      });

      return stats;
    },
    enabled: !!user?.id,
  });
}
