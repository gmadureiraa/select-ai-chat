import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TwitterMetricRow {
  date?: string;
  data?: string;
  followers?: string;
  seguidores?: string;
  impressions?: string;
  impressoes?: string;
  engagements?: string;
  engajamentos?: string;
  likes?: string;
  curtidas?: string;
  retweets?: string;
  replies?: string;
  respostas?: string;
  profile_visits?: string;
  visitas_perfil?: string;
  engagement_rate?: string;
  taxa_engajamento?: string;
}

export const useImportTwitterCSV = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TwitterMetricRow[]) => {
      const metrics = data.map((row) => {
        const date = row.date || row.data || new Date().toISOString().split("T")[0];
        const followers = parseInt(row.followers || row.seguidores || "0") || null;
        const impressions = parseInt(row.impressions || row.impressoes || "0") || null;
        const engagements = parseInt(row.engagements || row.engajamentos || "0") || null;
        const likes = parseInt(row.likes || row.curtidas || "0") || null;
        const retweets = parseInt(row.retweets || "0") || null;
        const replies = parseInt(row.replies || row.respostas || "0") || null;
        const engagementRate = parseFloat(row.engagement_rate || row.taxa_engajamento || "0") || null;

        return {
          client_id: clientId,
          platform: "twitter",
          metric_date: date,
          subscribers: followers,
          views: impressions,
          likes,
          shares: retweets,
          comments: replies,
          engagement_rate: engagementRate,
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

      return metrics.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      toast({
        title: "Métricas importadas",
        description: `${count} registros do Twitter/X importados com sucesso.`,
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
