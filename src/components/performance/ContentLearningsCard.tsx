import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, Lightbulb, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface ContentLearningsCardProps {
  clientId: string;
  posts: Array<{
    id: string;
    caption?: string | null;
    post_type?: string | null;
    likes?: number | null;
    comments?: number | null;
    saves?: number | null;
    shares?: number | null;
    engagement_rate?: number | null;
    reach?: number | null;
    content_library_id?: string | null;
  }>;
  libraryContent?: Map<string, { content: string; title: string }>;
}

export function ContentLearningsCard({ clientId, posts, libraryContent }: ContentLearningsCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [learnings, setLearnings] = useState<string | null>(null);
  const { toast } = useToast();

  const generateLearnings = async () => {
    setIsLoading(true);

    try {
      // Sort posts by engagement
      const sortedPosts = [...posts]
        .filter(p => p.engagement_rate && p.engagement_rate > 0)
        .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));

      const topPosts = sortedPosts.slice(0, 5);
      const bottomPosts = sortedPosts.slice(-3);

      // Build context with full content from library when available
      const topPostsContext = topPosts.map((p, i) => {
        const fullContent = libraryContent?.get(p.id)?.content || p.caption;
        return `${i + 1}. [${p.post_type || 'post'}] Eng: ${p.engagement_rate?.toFixed(2)}%
   Likes: ${p.likes || 0} | Comments: ${p.comments || 0} | Saves: ${p.saves || 0} | Shares: ${p.shares || 0}
   Conteúdo: "${fullContent?.slice(0, 300) || 'Sem legenda'}..."`;
      }).join('\n\n');

      const bottomPostsContext = bottomPosts.map((p, i) => {
        const fullContent = libraryContent?.get(p.id)?.content || p.caption;
        return `${i + 1}. [${p.post_type || 'post'}] Eng: ${p.engagement_rate?.toFixed(2)}%
   Conteúdo: "${fullContent?.slice(0, 200) || 'Sem legenda'}..."`;
      }).join('\n\n');

      // Calculate averages by type
      const typeStats: Record<string, { count: number; totalEng: number }> = {};
      posts.forEach(p => {
        const type = p.post_type || 'post';
        if (!typeStats[type]) typeStats[type] = { count: 0, totalEng: 0 };
        typeStats[type].count++;
        typeStats[type].totalEng += p.engagement_rate || 0;
      });

      const typeAvgContext = Object.entries(typeStats)
        .map(([type, stats]) => `${type}: ${(stats.totalEng / stats.count).toFixed(2)}% média (${stats.count} posts)`)
        .join('\n');

      const { data: { session } } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke('generate-content-learnings', {
        body: {
          clientId,
          topPostsContext,
          bottomPostsContext,
          typeAvgContext,
          totalPosts: posts.length,
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao gerar aprendizados');
      }

      setLearnings(response.data.learnings);
    } catch (error) {
      console.error("[ContentLearnings] Error:", error);
      toast({
        title: "Erro ao gerar aprendizados",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate quick stats for preview
  const avgEngagement = posts.length > 0
    ? posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length
    : 0;

  const topType = (() => {
    const typeStats: Record<string, number[]> = {};
    posts.forEach(p => {
      const type = p.post_type || 'post';
      if (!typeStats[type]) typeStats[type] = [];
      if (p.engagement_rate) typeStats[type].push(p.engagement_rate);
    });
    
    let best = { type: '', avg: 0 };
    Object.entries(typeStats).forEach(([type, rates]) => {
      const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
      if (avg > best.avg) best = { type, avg };
    });
    return best;
  })();

  return (
    <Card className="bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-500" />
            Aprendizados de Conteúdo
          </CardTitle>
          <Button 
            size="sm" 
            onClick={generateLearnings}
            disabled={isLoading || posts.length < 5}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar Análise
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!learnings && !isLoading && (
          <div className="space-y-4">
            {/* Quick Stats Preview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Melhor Formato
                </div>
                <p className="font-medium text-sm capitalize">{topType.type || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">
                  {topType.avg.toFixed(2)}% eng. médio
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Lightbulb className="h-3 w-3" />
                  Engajamento Geral
                </div>
                <p className="font-medium text-sm">{avgEngagement.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">
                  Média de {posts.length} posts
                </p>
              </div>
            </div>

            {posts.length < 5 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                <AlertTriangle className="h-3 w-3" />
                Mínimo de 5 posts necessários para análise
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm text-muted-foreground">Analisando padrões de conteúdo...</p>
          </div>
        )}

        {learnings && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h4 className="text-sm font-semibold mt-4 mb-2 flex items-center gap-2">
                    {children}
                  </h4>
                ),
                ul: ({ children }) => (
                  <ul className="space-y-1 text-sm">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <Badge variant="secondary" className="font-medium text-xs">
                    {children}
                  </Badge>
                ),
              }}
            >
              {learnings}
            </ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
