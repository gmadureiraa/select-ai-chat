import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InstagramMetricRow {
  date?: string;
  data?: string;
  followers?: string;
  seguidores?: string;
  reach?: string;
  alcance?: string;
  impressions?: string;
  impressoes?: string;
  views?: string;
  visualizacoes?: string;
  likes?: string;
  curtidas?: string;
  comments?: string;
  comentarios?: string;
  shares?: string;
  compartilhamentos?: string;
  engagement_rate?: string;
  taxa_engajamento?: string;
}

export const useImportInstagramCSV = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InstagramMetricRow[]) => {
      const metrics = data.map((row) => {
        const date = row.date || row.data || new Date().toISOString().split("T")[0];
        const followers = parseInt(row.followers || row.seguidores || "0") || null;
        const views = parseInt(row.views || row.visualizacoes || row.reach || row.alcance || "0") || null;
        const likes = parseInt(row.likes || row.curtidas || "0") || null;
        const comments = parseInt(row.comments || row.comentarios || "0") || null;
        const shares = parseInt(row.shares || row.compartilhamentos || "0") || null;
        const engagementRate = parseFloat(row.engagement_rate || row.taxa_engajamento || "0") || null;

        return {
          client_id: clientId,
          platform: "instagram",
          metric_date: date,
          subscribers: followers,
          views,
          likes,
          comments,
          shares,
          engagement_rate: engagementRate,
        };
      });

      // Upsert metrics (update if same date exists)
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
        description: `${count} registros do Instagram importados com sucesso.`,
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
