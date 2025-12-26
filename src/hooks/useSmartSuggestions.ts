import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  Lightbulb, 
  BarChart3, 
  MessageSquare, 
  Sparkles,
  Instagram,
  Youtube,
  Mail,
  Calendar,
  FileText,
  Image,
  Repeat,
  Target,
  LucideIcon
} from "lucide-react";

export interface SmartSuggestion {
  text: string;
  icon: LucideIcon;
  priority: number;
  category: "metrics" | "content" | "analysis" | "action";
}

interface ClientData {
  hasInstagramData: boolean;
  hasYouTubeData: boolean;
  hasNewsletterData: boolean;
  contentLibraryCount: number;
  referenceLibraryCount: number;
  lastContentDaysAgo: number | null;
  topPerformingType: string | null;
  hasMetrics: boolean;
  lastImportDaysAgo: number | null;
}

export const useSmartSuggestions = (clientId: string | undefined, isContentTemplate: boolean) => {
  // Fetch client data for smart suggestions
  const { data: clientData, isLoading } = useQuery({
    queryKey: ["smart-suggestions-data", clientId],
    queryFn: async (): Promise<ClientData> => {
      if (!clientId) {
        return {
          hasInstagramData: false,
          hasYouTubeData: false,
          hasNewsletterData: false,
          contentLibraryCount: 0,
          referenceLibraryCount: 0,
          lastContentDaysAgo: null,
          topPerformingType: null,
          hasMetrics: false,
          lastImportDaysAgo: null,
        };
      }

      // Fetch all data in parallel
      const [
        instagramResult,
        youtubeResult,
        metricsResult,
        contentLibraryResult,
        referenceLibraryResult,
        importHistoryResult,
      ] = await Promise.all([
        supabase
          .from("instagram_posts")
          .select("id, posted_at")
          .eq("client_id", clientId)
          .limit(1),
        supabase
          .from("youtube_videos")
          .select("id")
          .eq("client_id", clientId)
          .limit(1),
        supabase
          .from("platform_metrics")
          .select("platform, metric_date")
          .eq("client_id", clientId)
          .order("metric_date", { ascending: false })
          .limit(5),
        supabase
          .from("client_content_library")
          .select("id, content_type, created_at, metadata")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("client_reference_library")
          .select("id")
          .eq("client_id", clientId)
          .limit(1),
        supabase
          .from("import_history")
          .select("imported_at")
          .eq("client_id", clientId)
          .order("imported_at", { ascending: false })
          .limit(1),
      ]);

      // Calculate last content days ago
      let lastContentDaysAgo: number | null = null;
      if (contentLibraryResult.data && contentLibraryResult.data.length > 0) {
        const lastContent = new Date(contentLibraryResult.data[0].created_at);
        lastContentDaysAgo = Math.floor((Date.now() - lastContent.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Find top performing content type by frequency
      let topPerformingType: string | null = null;
      if (contentLibraryResult.data && contentLibraryResult.data.length > 0) {
        const typeCounts: Record<string, number> = {};
        contentLibraryResult.data.forEach(c => {
          const type = c.content_type || "other";
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        const sortedTypes = Object.entries(typeCounts).sort(([, a], [, b]) => b - a);
        if (sortedTypes.length > 0) {
          topPerformingType = sortedTypes[0][0];
        }
      }

      // Check for newsletter data in metrics
      const hasNewsletterData = metricsResult.data?.some(m => 
        m.platform === "newsletter" || m.platform === "beehiiv"
      ) || false;

      // Calculate last import days ago
      let lastImportDaysAgo: number | null = null;
      if (importHistoryResult.data && importHistoryResult.data.length > 0) {
        const lastImport = new Date(importHistoryResult.data[0].imported_at);
        lastImportDaysAgo = Math.floor((Date.now() - lastImport.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        hasInstagramData: (instagramResult.data?.length || 0) > 0,
        hasYouTubeData: (youtubeResult.data?.length || 0) > 0,
        hasNewsletterData,
        contentLibraryCount: contentLibraryResult.data?.length || 0,
        referenceLibraryCount: referenceLibraryResult.data?.length || 0,
        lastContentDaysAgo,
        topPerformingType,
        hasMetrics: (metricsResult.data?.length || 0) > 0,
        lastImportDaysAgo,
      };
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Generate smart suggestions based on client data
  const suggestions = useMemo((): SmartSuggestion[] => {
    if (!clientData) {
      // Return default suggestions while loading
      return isContentTemplate ? [
        { text: "Crie um conteúdo sobre tendências", icon: TrendingUp, priority: 1, category: "content" },
        { text: "Gere ideias criativas", icon: Lightbulb, priority: 2, category: "content" },
      ] : [
        { text: "Resumo do cliente", icon: MessageSquare, priority: 1, category: "analysis" },
        { text: "Ideias de conteúdo", icon: Lightbulb, priority: 2, category: "content" },
      ];
    }

    const smartSuggestions: SmartSuggestion[] = [];

    // Content template mode suggestions
    if (isContentTemplate) {
      // If they have content, suggest creating similar
      if (clientData.topPerformingType) {
        const typeLabels: Record<string, string> = {
          carousel: "carrossel",
          newsletter: "newsletter",
          stories: "stories",
          static_post: "post estático",
          reels: "reels",
          thread: "thread",
        };
        const typeLabel = typeLabels[clientData.topPerformingType] || clientData.topPerformingType;
        smartSuggestions.push({
          text: `Criar novo ${typeLabel}`,
          icon: Repeat,
          priority: 1,
          category: "content",
        });
      }

      // If no content yet, suggest first creation
      if (clientData.contentLibraryCount === 0) {
        smartSuggestions.push({
          text: "Criar primeiro conteúdo do cliente",
          icon: Sparkles,
          priority: 1,
          category: "content",
        });
      }

      // If they have references, suggest using them
      if (clientData.referenceLibraryCount > 0) {
        smartSuggestions.push({
          text: "Criar conteúdo usando referências salvas",
          icon: FileText,
          priority: 2,
          category: "content",
        });
      }

      // Always add creative suggestions
      smartSuggestions.push({
        text: "Gere 5 ideias criativas",
        icon: Lightbulb,
        priority: 3,
        category: "content",
      });

      smartSuggestions.push({
        text: "Sugerir melhorias no último conteúdo",
        icon: Sparkles,
        priority: 4,
        category: "content",
      });

    } else {
      // Free chat mode - focus on metrics and analysis

      // Urgency: No recent content
      if (clientData.lastContentDaysAgo !== null && clientData.lastContentDaysAgo > 7) {
        smartSuggestions.push({
          text: `Criar conteúdo urgente (${clientData.lastContentDaysAgo} dias sem publicar)`,
          icon: Calendar,
          priority: 1,
          category: "action",
        });
      }

      // Metrics analysis if data exists
      if (clientData.hasInstagramData) {
        smartSuggestions.push({
          text: "Analisar performance do Instagram",
          icon: Instagram,
          priority: 2,
          category: "metrics",
        });
      }

      if (clientData.hasYouTubeData) {
        smartSuggestions.push({
          text: "Métricas do YouTube desta semana",
          icon: Youtube,
          priority: 2,
          category: "metrics",
        });
      }

      if (clientData.hasNewsletterData) {
        smartSuggestions.push({
          text: "Análise de newsletter",
          icon: Mail,
          priority: 2,
          category: "metrics",
        });
      }

      // If no metrics at all, suggest importing
      if (!clientData.hasMetrics && !clientData.hasInstagramData && !clientData.hasYouTubeData) {
        smartSuggestions.push({
          text: "Importar dados de métricas",
          icon: TrendingUp,
          priority: 1,
          category: "action",
        });
      }

      // General analysis
      if (clientData.hasMetrics) {
        smartSuggestions.push({
          text: "Resumo de performance geral",
          icon: BarChart3,
          priority: 3,
          category: "metrics",
        });
      }

      // Content suggestions
      if (clientData.contentLibraryCount > 5) {
        smartSuggestions.push({
          text: "Qual conteúdo performou melhor?",
          icon: Target,
          priority: 3,
          category: "analysis",
        });
      }

      // Always have at least one idea suggestion
      smartSuggestions.push({
        text: "Ideias de conteúdo para próxima semana",
        icon: Lightbulb,
        priority: 4,
        category: "content",
      });

      // Client overview
      smartSuggestions.push({
        text: "Resumo do cliente",
        icon: MessageSquare,
        priority: 5,
        category: "analysis",
      });
    }

    // Sort by priority and limit to 4
    return smartSuggestions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4);
  }, [clientData, isContentTemplate]);

  return {
    suggestions,
    isLoading,
    clientData,
  };
};
