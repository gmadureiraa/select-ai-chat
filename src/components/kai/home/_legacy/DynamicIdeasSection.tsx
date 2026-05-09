import { useState, useMemo } from "react";
import { Sparkles, Loader2, RefreshCw, ArrowRight, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTopPerformingContent } from "@/hooks/useUnifiedContent";

interface ContentIdea {
  id: string;
  title: string;
  description: string;
  format: string;
  icon: string;
  basedOn?: string;
}

// Default ideas when no data available
const DEFAULT_IDEAS: ContentIdea[] = [
  {
    id: "1",
    title: "Bastidores do processo",
    description: "Mostre como você trabalha e gere conexão com sua audiência",
    format: "Reels/Stories",
    icon: "🎬"
  },
  {
    id: "2",
    title: "Dica rápida da semana",
    description: "Compartilhe um insight valioso em formato carrossel",
    format: "Carrossel",
    icon: "💡"
  },
  {
    id: "3",
    title: "Resposta a pergunta frequente",
    description: "Transforme uma dúvida comum em conteúdo educativo",
    format: "Post/Thread",
    icon: "❓"
  },
];

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  twitter: "🐦",
  linkedin: "💼",
  content: "📝"
};

interface DynamicIdeasSectionProps {
  clientId?: string;
  clientName?: string;
  onSelectIdea: (idea: ContentIdea) => void;
}

export function DynamicIdeasSection({ clientId, clientName, onSelectIdea }: DynamicIdeasSectionProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fetch top performing content
  const { data: topContent, isLoading, refetch } = useTopPerformingContent(clientId || "", 5);

  // Generate ideas based on top performing content
  const ideas: ContentIdea[] = useMemo(() => {
    if (!topContent?.length) return DEFAULT_IDEAS;

    return topContent.slice(0, 3).map((post, index) => {
      const theme = extractTheme(post.content);
      const engagementLabel = post.engagement_rate 
        ? `${post.engagement_rate.toFixed(1)}% eng` 
        : `${post.metrics.likes} likes`;

      return {
        id: String(index + 1),
        title: theme,
        description: `Baseado em conteúdo com ${engagementLabel}. Explore mais deste tema!`,
        format: post.platform === 'instagram' ? 'Carrossel/Reels' : post.platform === 'twitter' ? 'Thread' : 'Post',
        icon: PLATFORM_ICONS[post.platform] || "📝",
        basedOn: post.title,
      };
    });
  }, [topContent]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Ideias para hoje</h3>
          {topContent && topContent.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
              <TrendingUp className="h-3 w-3" />
              Baseado em performance
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          {isRefreshing || isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Novas ideias
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ideas.map((idea, index) => (
          <motion.button
            key={idea.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelectIdea(idea)}
            className={cn(
              "group relative flex flex-col items-start gap-3 p-4 rounded-xl",
              "bg-card/50 backdrop-blur-sm border border-border/50",
              "hover:bg-card hover:border-primary/30 hover:shadow-lg",
              "transition-all duration-200 text-left"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-2xl">{idea.icon}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {idea.format}
              </span>
            </div>
            
            <div className="space-y-1">
              <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                {idea.title}
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {idea.description}
              </p>
            </div>

            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Helper function to extract theme from content
function extractTheme(content: string): string {
  if (!content) return "Criar mais conteúdo";
  
  // Simple theme extraction - get first meaningful phrase
  const cleaned = content
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/#\w+/g, '') // Remove hashtags
    .replace(/@\w+/g, '') // Remove mentions
    .replace(/\n+/g, ' ')
    .trim();
  
  const words = cleaned.split(' ').filter(w => w.length > 3);
  const theme = words.slice(0, 4).join(' ');
  
  if (theme.length < 10) {
    return "Explorar este formato";
  }
  
  return theme.length > 40 ? theme.slice(0, 40) + "..." : theme;
}
