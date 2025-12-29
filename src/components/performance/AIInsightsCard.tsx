import { useState } from "react";
import { Lightbulb, Sparkles, Loader2, RefreshCw, MessageSquare, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIInsightsCardProps {
  clientId: string;
  clientName?: string;
  posts: InstagramPost[];
  metrics: PerformanceMetrics[];
  periodLabel?: string;
  platform?: string;
  startDate?: Date;
  endDate?: Date;
}

export function AIInsightsCard({ 
  clientId, 
  clientName,
  posts, 
  metrics,
  periodLabel,
  platform = "instagram",
  startDate,
  endDate,
}: AIInsightsCardProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const formattedPeriod = startDate && endDate
    ? `${format(startDate, "dd MMM", { locale: ptBR })} - ${format(endDate, "dd MMM yyyy", { locale: ptBR })}`
    : periodLabel || "Período selecionado";

  const generateInsights = async () => {
    if (posts.length === 0 && metrics.length === 0) {
      toast({
        title: "Dados insuficientes",
        description: "Importe dados antes de gerar insights.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Build context for AI
      const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
      const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
      const totalSaves = posts.reduce((sum, p) => sum + (p.saves || 0), 0);
      const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);
      const totalReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0);
      
      const avgEngagement = posts.length > 0
        ? posts.filter(p => p.engagement_rate).reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / 
          posts.filter(p => p.engagement_rate).length
        : 0;

      const topPosts = [...posts]
        .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
        .slice(0, 5)
        .map(p => ({
          caption: p.caption?.slice(0, 100),
          likes: p.likes,
          comments: p.comments,
          saves: p.saves,
          shares: p.shares,
          engagement: p.engagement_rate,
          type: p.post_type,
        }));

      const context = {
        instagram: {
          totalPosts: posts.length,
          totalLikes,
          totalComments,
          totalSaves,
          totalShares,
          totalReach,
          avgEngagement,
          topPosts,
        },
      };

      const { data, error } = await supabase.functions.invoke('generate-performance-insights', {
        body: { 
          clientId, 
          clientName: clientName || "Cliente",
          context,
          periodLabel: formattedPeriod,
          platform,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        }
      });

      if (error) throw error;

      if (data?.insights) {
        setInsights(data.insights);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Error generating insights:", error);
      
      // Check for token-related errors
      if (error.message?.includes("402") || error.message?.includes("tokens")) {
        toast({
          title: "Tokens insuficientes",
          description: "Adicione mais créditos para continuar gerando insights.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao gerar insights",
          description: error.message || "Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInAssistant = () => {
    // Truncate insights to prevent exceeding message limits
    const truncatedInsights = insights && insights.length > 3000 
      ? insights.slice(0, 3000) + "..."
      : insights;
    
    const message = `Baseado nesses insights de performance do ${platform === "instagram" ? "Instagram" : "YouTube"} (${formattedPeriod}):\n\n${truncatedInsights}\n\nGere 5 ideias de conteúdo criativas para melhorar nosso engajamento.`;
    
    navigate(`/kaleidos?client=${clientId}&tab=assistant`, {
      state: { pendingMessage: message }
    });
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Insights com IA</span>
          </div>
          {insights && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={generateInsights}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
              Atualizar
            </Button>
          )}
        </div>
      </div>
      <div className="p-4">
        {!insights && !isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-amber-500" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Analise seus dados com IA para descobrir padrões e oportunidades de crescimento.
            </p>
            <Button 
              onClick={generateInsights}
              disabled={isLoading || (posts.length === 0 && metrics.length === 0)}
              className="mt-2"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Insights
            </Button>
            {posts.length === 0 && metrics.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Importe dados para habilitar esta funcionalidade
              </p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">Analisando seus dados...</p>
          </div>
        )}

        {insights && !isLoading && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {platform === "instagram" ? "Instagram" : "YouTube"} • {formattedPeriod}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-sm text-foreground/90 mb-3">{children}</p>,
                  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 text-sm">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 text-sm">{children}</ol>,
                  li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {children}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ),
                }}
              >
                {insights}
              </ReactMarkdown>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenInAssistant}
              className="w-full gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Gerar ideias com IA
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}