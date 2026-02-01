import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FormatUsageMetric {
  format: string;
  formatName: string;
  count: number;
  successCount: number;
  successRate: number;
  avgRating: number | null;
  lastUsed: string | null;
}

export interface FormatMetricsSummary {
  totalGenerations: number;
  totalSuccess: number;
  overallSuccessRate: number;
  topFormats: FormatUsageMetric[];
  formatBreakdown: FormatUsageMetric[];
}

// Map format categories to display names
const formatDisplayNames: Record<string, string> = {
  tweet: "Tweet",
  thread: "Thread",
  x_article: "Artigo X",
  linkedin_post: "Post LinkedIn",
  carousel: "Carrossel",
  stories: "Stories",
  instagram_post: "Post Instagram",
  short_video: "Reels/Shorts",
  long_video: "Vídeo Longo",
  newsletter: "Newsletter",
  blog_post: "Blog Post",
  ideias: "Ideias",
  imagem: "Gerar Imagem",
  email_marketing: "E-mail Marketing",
};

export const useFormatMetrics = () => {
  return useQuery({
    queryKey: ["admin-format-metrics"],
    queryFn: async () => {
      // Fetch AI usage logs with metadata containing format info
      const { data: usageLogs, error } = await supabase
        .from("ai_usage_logs")
        .select("id, metadata, created_at, edge_function")
        .in("edge_function", ["kai-content-agent", "generate-content-v2", "kai-simple-chat"])
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.error("Error fetching usage logs:", error);
        return null;
      }

      // Aggregate by format
      const formatStats: Record<string, {
        count: number;
        successCount: number;
        ratings: number[];
        lastUsed: string | null;
      }> = {};

      for (const log of usageLogs || []) {
        const metadata = log.metadata as Record<string, unknown> | null;
        if (!metadata) continue;

        const format = (metadata.format || metadata.content_format || metadata.output_format) as string | undefined;
        if (!format) continue;

        const normalizedFormat = format.toLowerCase().replace(/[\s-]/g, "_");

        if (!formatStats[normalizedFormat]) {
          formatStats[normalizedFormat] = {
            count: 0,
            successCount: 0,
            ratings: [],
            lastUsed: null,
          };
        }

        formatStats[normalizedFormat].count++;
        
        // Consider success if no error in metadata
        const hasError = metadata.error || metadata.failed;
        if (!hasError) {
          formatStats[normalizedFormat].successCount++;
        }

        // Track rating if available
        const rating = metadata.rating as number | undefined;
        if (rating) {
          formatStats[normalizedFormat].ratings.push(rating);
        }

        // Track last used
        if (!formatStats[normalizedFormat].lastUsed || log.created_at > formatStats[normalizedFormat].lastUsed!) {
          formatStats[normalizedFormat].lastUsed = log.created_at;
        }
      }

      // Convert to array and calculate metrics
      const formatBreakdown: FormatUsageMetric[] = Object.entries(formatStats)
        .map(([format, stats]) => ({
          format,
          formatName: formatDisplayNames[format] || format,
          count: stats.count,
          successCount: stats.successCount,
          successRate: stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0,
          avgRating: stats.ratings.length > 0 
            ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length 
            : null,
          lastUsed: stats.lastUsed,
        }))
        .sort((a, b) => b.count - a.count);

      const totalGenerations = formatBreakdown.reduce((sum, f) => sum + f.count, 0);
      const totalSuccess = formatBreakdown.reduce((sum, f) => sum + f.successCount, 0);

      const summary: FormatMetricsSummary = {
        totalGenerations,
        totalSuccess,
        overallSuccessRate: totalGenerations > 0 ? (totalSuccess / totalGenerations) * 100 : 0,
        topFormats: formatBreakdown.slice(0, 5),
        formatBreakdown,
      };

      return summary;
    },
    staleTime: 60000, // Cache for 1 minute
  });
};
