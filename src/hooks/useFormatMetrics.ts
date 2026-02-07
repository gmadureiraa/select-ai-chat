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
  repairedCount: number;
  repairRate: number;
}

export interface FormatMetricsSummary {
  totalGenerations: number;
  totalSuccess: number;
  overallSuccessRate: number;
  totalRepaired: number;
  overallRepairRate: number;
  topFormats: FormatUsageMetric[];
  formatBreakdown: FormatUsageMetric[];
}

export interface ClientFormatMetrics {
  clientId: string;
  clientName: string;
  totalGenerations: number;
  approvalRate: number;
  topFormats: string[];
}

// Map format categories to display names
const formatDisplayNames: Record<string, string> = {
  tweet: "Tweet",
  thread: "Thread",
  x_article: "Artigo X",
  linkedin_post: "Post LinkedIn",
  linkedin: "Post LinkedIn",
  carousel: "Carrossel",
  stories: "Stories",
  instagram_post: "Post Instagram",
  post: "Post Estático",
  short_video: "Reels/Shorts",
  reels: "Reels",
  long_video: "Vídeo Longo",
  newsletter: "Newsletter",
  email_marketing: "E-mail Marketing",
  blog_post: "Blog Post",
  case_study: "Estudo de Caso",
  report: "Relatório",
  ideias: "Ideias",
  imagem: "Gerar Imagem",
};

export const useFormatMetrics = () => {
  return useQuery({
    queryKey: ["admin-format-metrics"],
    queryFn: async () => {
      // Fetch AI usage logs with the new format tracking columns
      const { data: usageLogs, error } = await supabase
        .from("ai_usage_logs")
        .select("id, metadata, created_at, edge_function, format_type, validation_passed, was_repaired, client_id")
        .in("edge_function", ["kai-content-agent", "generate-content-v2", "kai-simple-chat", "unified-content-api"])
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) {
        console.error("Error fetching usage logs:", error);
        return null;
      }

      // Aggregate by format
      const formatStats: Record<string, {
        count: number;
        successCount: number;
        repairedCount: number;
        ratings: number[];
        lastUsed: string | null;
      }> = {};

      for (const log of usageLogs || []) {
        // Prioritize the new format_type column, fallback to metadata
        let format = log.format_type;
        if (!format) {
          const metadata = log.metadata as Record<string, unknown> | null;
          if (metadata) {
            format = (metadata.format || metadata.content_format || metadata.output_format) as string | undefined;
          }
        }
        if (!format) continue;

        const normalizedFormat = format.toLowerCase().replace(/[\s-]/g, "_");

        if (!formatStats[normalizedFormat]) {
          formatStats[normalizedFormat] = {
            count: 0,
            successCount: 0,
            repairedCount: 0,
            ratings: [],
            lastUsed: null,
          };
        }

        formatStats[normalizedFormat].count++;
        
        // Use new column if available, fallback to metadata check
        const validationPassed = log.validation_passed ?? true;
        const wasRepaired = log.was_repaired ?? false;
        
        if (validationPassed) {
          formatStats[normalizedFormat].successCount++;
        }
        
        if (wasRepaired) {
          formatStats[normalizedFormat].repairedCount++;
        }

        // Track rating if available in metadata
        const metadata = log.metadata as Record<string, unknown> | null;
        if (metadata?.rating) {
          formatStats[normalizedFormat].ratings.push(metadata.rating as number);
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
          repairedCount: stats.repairedCount,
          repairRate: stats.count > 0 ? (stats.repairedCount / stats.count) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      const totalGenerations = formatBreakdown.reduce((sum, f) => sum + f.count, 0);
      const totalSuccess = formatBreakdown.reduce((sum, f) => sum + f.successCount, 0);
      const totalRepaired = formatBreakdown.reduce((sum, f) => sum + f.repairedCount, 0);

      const summary: FormatMetricsSummary = {
        totalGenerations,
        totalSuccess,
        overallSuccessRate: totalGenerations > 0 ? (totalSuccess / totalGenerations) * 100 : 0,
        totalRepaired,
        overallRepairRate: totalGenerations > 0 ? (totalRepaired / totalGenerations) * 100 : 0,
        topFormats: formatBreakdown.slice(0, 5),
        formatBreakdown,
      };

      return summary;
    },
    staleTime: 60000, // Cache for 1 minute
  });
};

// Hook to get metrics by client
export const useClientFormatMetrics = (clientId?: string) => {
  return useQuery({
    queryKey: ["client-format-metrics", clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // Get feedback data for this client
      const { data: feedback, error: feedbackError } = await supabase
        .from("content_feedback")
        .select("id, format_type, feedback_type, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (feedbackError) {
        console.error("Error fetching client feedback:", feedbackError);
        return null;
      }

      // Calculate approval rate
      const totalFeedback = feedback?.length || 0;
      const approvedCount = feedback?.filter(f => f.feedback_type === "approved" || f.feedback_type === "saved_to_library").length || 0;
      const approvalRate = totalFeedback > 0 ? (approvedCount / totalFeedback) * 100 : 0;

      // Get format breakdown for this client
      const formatCounts: Record<string, number> = {};
      for (const item of feedback || []) {
        if (item.format_type) {
          formatCounts[item.format_type] = (formatCounts[item.format_type] || 0) + 1;
        }
      }

      const topFormats = Object.entries(formatCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([format]) => formatDisplayNames[format] || format);

      return {
        clientId,
        totalFeedback,
        approvalRate,
        topFormats,
        feedbackBreakdown: {
          approved: feedback?.filter(f => f.feedback_type === "approved").length || 0,
          edited: feedback?.filter(f => f.feedback_type === "edited").length || 0,
          regenerated: feedback?.filter(f => f.feedback_type === "regenerated").length || 0,
          savedToLibrary: feedback?.filter(f => f.feedback_type === "saved_to_library").length || 0,
        },
      };
    },
    enabled: !!clientId,
    staleTime: 60000,
  });
};
