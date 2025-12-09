import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NewsletterMetricRow {
  date?: string;
  data?: string;
  subscribers?: string;
  assinantes?: string;
  open_rate?: string;
  taxa_abertura?: string;
  click_rate?: string;
  taxa_clique?: string;
  emails_sent?: string;
  emails_enviados?: string;
  opens?: string;
  aberturas?: string;
  clicks?: string;
  cliques?: string;
}

export const useImportNewsletterCSV = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: NewsletterMetricRow[]) => {
      const metrics = data.map((row) => {
        const date = row.date || row.data || new Date().toISOString().split("T")[0];
        const subscribers = parseInt(row.subscribers || row.assinantes || "0") || null;
        const openRateRaw = row.open_rate || row.taxa_abertura || "0";
        const clickRateRaw = row.click_rate || row.taxa_clique || "0";
        
        // Handle percentage strings like "45%" or decimal like "0.45"
        let openRate = parseFloat(openRateRaw.replace("%", ""));
        let clickRate = parseFloat(clickRateRaw.replace("%", ""));
        
        // If values are > 1, assume they're already percentages
        if (openRate > 1) openRate = openRate;
        else openRate = openRate * 100;
        
        if (clickRate > 1) clickRate = clickRate;
        else clickRate = clickRate * 100;

        const emailsSent = parseInt(row.emails_sent || row.emails_enviados || "0") || null;
        const opens = parseInt(row.opens || row.aberturas || "0") || null;
        const clicks = parseInt(row.clicks || row.cliques || "0") || null;

        return {
          client_id: clientId,
          platform: "newsletter",
          metric_date: date,
          subscribers,
          open_rate: openRate || null,
          click_rate: clickRate || null,
          views: emailsSent, // Using views for emails sent
          likes: opens, // Using likes for opens
          comments: clicks, // Using comments for clicks
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
        description: `${count} registros da Newsletter importados com sucesso.`,
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
