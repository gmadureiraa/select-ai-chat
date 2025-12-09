import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SentimentResult {
  score: number;
  label: string;
  totalComments: number;
  insights: string[];
  lastUpdated?: string;
}

export function useYouTubeSentiment(clientId: string) {
  return useQuery({
    queryKey: ["youtube-sentiment", clientId],
    queryFn: async () => {
      // Get the latest metric with sentiment data
      const { data, error } = await supabase
        .from("platform_metrics")
        .select("metadata")
        .eq("client_id", clientId)
        .eq("platform", "youtube")
        .order("metric_date", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      const metadata = data.metadata as any;
      if (!metadata?.sentiment_score) {
        return null;
      }

      return {
        score: metadata.sentiment_score,
        label: metadata.sentiment_label || "Neutro",
        totalComments: metadata.comments_analyzed || 0,
        insights: metadata.sentiment_insights || [],
        lastUpdated: metadata.sentiment_updated_at,
      } as SentimentResult;
    },
    enabled: !!clientId,
  });
}

export function useAnalyzeYouTubeSentiment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ clientId, comments }: { clientId: string; comments: string[] }) => {
      const { data, error } = await supabase.functions.invoke("analyze-youtube-sentiment", {
        body: { clientId, comments },
      });

      if (error) throw error;
      return data as SentimentResult;
    },
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["youtube-sentiment", clientId] });
    },
  });
}