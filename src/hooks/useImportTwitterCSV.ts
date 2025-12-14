import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TwitterMetricRow {
  // Standard format
  date?: string;
  data?: string;
  Date?: string;
  followers?: string;
  seguidores?: string;
  impressions?: string;
  impressoes?: string;
  Impressions?: string;
  engagements?: string;
  engajamentos?: string;
  Engagements?: string;
  likes?: string;
  curtidas?: string;
  Likes?: string;
  retweets?: string;
  Reposts?: string;
  replies?: string;
  respostas?: string;
  Replies?: string;
  profile_visits?: string;
  visitas_perfil?: string;
  "Profile visits"?: string;
  engagement_rate?: string;
  taxa_engajamento?: string;
  // X Analytics format
  "New follows"?: string;
  Unfollows?: string;
  Bookmarks?: string;
  Shares?: string;
  "Video views"?: string;
  "Media views"?: string;
}

// Parse X Analytics date format: "Sun, Dec 14, 2025" -> "2025-12-14"
const parseXDate = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  
  // Check if already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try parsing "Sun, Dec 14, 2025" format
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch {
    // Fall through
  }
  
  return new Date().toISOString().split("T")[0];
};

const parseNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
};

export const useImportTwitterCSV = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TwitterMetricRow[]) => {
      const metrics = data.map((row) => {
        // Handle different date column names
        const rawDate = row.Date || row.date || row.data || "";
        const date = parseXDate(rawDate);
        
        // Parse metrics with multiple possible column names
        const impressions = parseNumber(row.Impressions || row.impressions || row.impressoes);
        const likes = parseNumber(row.Likes || row.likes || row.curtidas);
        const engagements = parseNumber(row.Engagements || row.engagements || row.engajamentos);
        const reposts = parseNumber(row.Reposts || row.retweets);
        const replies = parseNumber(row.Replies || row.replies || row.respostas);
        const newFollows = parseNumber(row["New follows"] || row.followers || row.seguidores);
        const profileVisits = parseNumber(row["Profile visits"] || row.profile_visits || row.visitas_perfil);
        
        // Calculate engagement rate if we have impressions and engagements
        let engagementRate: number | null = null;
        if (impressions && impressions > 0 && engagements) {
          engagementRate = (engagements / impressions) * 100;
        }

        return {
          client_id: clientId,
          platform: "twitter",
          metric_date: date,
          subscribers: newFollows,
          views: impressions,
          likes,
          shares: reposts,
          comments: replies,
          engagement_rate: engagementRate,
          metadata: {
            profile_visits: profileVisits,
            total_engagements: engagements,
          },
        };
      });

      // Upsert metrics
      for (const metric of metrics) {
        const { error } = await supabase
          .from("platform_metrics")
          .upsert(metric, {
            onConflict: "client_id,platform,metric_date",
            ignoreDuplicates: false,
          });

        if (error) {
          console.error("Error upserting metric:", error);
          throw error;
        }
      }

      // Clear insights cache to regenerate
      localStorage.removeItem(`insights-${clientId}`);

      return metrics.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      toast({
        title: "Métricas importadas",
        description: `${count} registros do X/Twitter importados com sucesso.`,
      });
    },
    onError: (error) => {
      console.error("Import error:", error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível importar as métricas. Verifique o formato do CSV.",
        variant: "destructive",
      });
    },
  });
};
