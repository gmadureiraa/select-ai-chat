import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AIUsageLog {
  id: string;
  model_name: string;
  provider: string;
  edge_function: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  created_at: string;
}

export interface AIUsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { calls: number; tokens: number; cost: number }>;
  byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
  byFunction: Record<string, { calls: number; tokens: number; cost: number }>;
  recentLogs: AIUsageLog[];
}

export function useAIUsage(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ai-usage", user?.id, days],
    queryFn: async () => {
      if (!user?.id) return null;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const logs = data as AIUsageLog[];

      // Agregar estatísticas
      const stats: AIUsageStats = {
        totalCalls: logs.length,
        totalTokens: 0,
        totalCost: 0,
        byModel: {},
        byProvider: {},
        byFunction: {},
        recentLogs: logs.slice(0, 10),
      };

      logs.forEach((log) => {
        const tokens = log.total_tokens || 0;
        const cost = Number(log.estimated_cost_usd) || 0;

        stats.totalTokens += tokens;
        stats.totalCost += cost;

        // Por modelo
        if (!stats.byModel[log.model_name]) {
          stats.byModel[log.model_name] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byModel[log.model_name].calls += 1;
        stats.byModel[log.model_name].tokens += tokens;
        stats.byModel[log.model_name].cost += cost;

        // Por provider
        if (!stats.byProvider[log.provider]) {
          stats.byProvider[log.provider] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byProvider[log.provider].calls += 1;
        stats.byProvider[log.provider].tokens += tokens;
        stats.byProvider[log.provider].cost += cost;

        // Por função
        if (!stats.byFunction[log.edge_function]) {
          stats.byFunction[log.edge_function] = { calls: 0, tokens: 0, cost: 0 };
        }
        stats.byFunction[log.edge_function].calls += 1;
        stats.byFunction[log.edge_function].tokens += tokens;
        stats.byFunction[log.edge_function].cost += cost;
      });

      return stats;
    },
    enabled: !!user?.id,
  });
}
