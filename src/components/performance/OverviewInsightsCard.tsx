import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Users, Heart, Eye, Clock } from "lucide-react";
import { usePerformanceContext } from "@/hooks/usePerformanceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OverviewInsightsCardProps {
  clientId: string;
  clientName: string;
}

export function OverviewInsightsCard({ clientId, clientName }: OverviewInsightsCardProps) {
  const { data: context, isLoading: contextLoading } = usePerformanceContext(clientId);
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateInsights = async () => {
    if (!context) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-performance-insights", {
        body: { clientId, clientName, context },
      });

      if (error) throw error;
      setInsights(data.insights);
      toast.success("Insights gerados com sucesso");
    } catch (error) {
      console.error("Error generating insights:", error);
      toast.error("Erro ao gerar insights");
    } finally {
      setIsGenerating(false);
    }
  };

  if (contextLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalFollowers = (context?.instagram.followers || 0) + (context?.youtube.subscribers || 0);
  const totalViews = context?.youtube.totalViews || 0;
  const avgEngagement = context?.instagram.avgEngagement || 0;
  const watchHours = context?.youtube.watchHours || 0;

  const quickStats = [
    {
      label: "Total Seguidores",
      value: totalFollowers.toLocaleString(),
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Total Views (YT)",
      value: totalViews.toLocaleString(),
      icon: Eye,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Engajamento (IG)",
      value: `${avgEngagement.toFixed(1)}%`,
      icon: Heart,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      label: "Watch Hours",
      value: watchHours.toLocaleString(),
      icon: Clock,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Insights AI
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateInsights}
              disabled={isGenerating || !context}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Insights
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {insights ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm text-foreground whitespace-pre-wrap">{insights}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pre-generated quick insights from context */}
              {context?.insights && context.insights.length > 0 ? (
                <div className="space-y-2">
                  {context.insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Clique em "Gerar Insights" para uma análise detalhada com AI
                </p>
              )}

              {/* Top Performers */}
              {(context?.instagram.topPosts.length || context?.youtube.topVideos.length) ? (
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                  {context?.instagram.topPosts[0] && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">Instagram</Badge>
                        <span className="text-xs text-muted-foreground">Top Post</span>
                      </div>
                      <p className="text-sm line-clamp-2">{context.instagram.topPosts[0].caption || "Sem legenda"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {context.instagram.topPosts[0].likes.toLocaleString()} likes
                      </p>
                    </div>
                  )}
                  {context?.youtube.topVideos[0] && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">YouTube</Badge>
                        <span className="text-xs text-muted-foreground">Top Vídeo</span>
                      </div>
                      <p className="text-sm line-clamp-2">{context.youtube.topVideos[0].title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {context.youtube.topVideos[0].views.toLocaleString()} views
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
