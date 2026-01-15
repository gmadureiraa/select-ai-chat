import { useMemo } from "react";
import { TrendingUp, Heart, Eye, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WeekHighlightsProps {
  clientId?: string;
}

interface HighlightCard {
  label: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  color: string;
  thumbnail?: string;
}

export function WeekHighlights({ clientId }: WeekHighlightsProps) {
  // Fetch top posts from the last 7 days
  const { data: topPosts, isLoading } = useQuery({
    queryKey: ['week-highlights', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const weekAgo = subDays(new Date(), 7).toISOString();
      
      const { data } = await supabase
        .from('instagram_posts')
        .select('id, caption, likes, comments, reach, engagement_rate, thumbnail_url, posted_at')
        .eq('client_id', clientId)
        .gte('posted_at', weekAgo)
        .order('engagement_rate', { ascending: false })
        .limit(3);
      
      return data;
    },
    enabled: !!clientId,
  });

  const highlights = useMemo<HighlightCard[]>(() => {
    if (!topPosts || topPosts.length === 0) {
      // Return placeholder highlights
      return [
        {
          label: "Melhor Post",
          value: "—",
          subtext: "Nenhum post esta semana",
          icon: <TrendingUp className="h-4 w-4" />,
          color: "text-green-500",
        },
        {
          label: "Mais Curtido",
          value: "—",
          subtext: "Nenhum dado disponível",
          icon: <Heart className="h-4 w-4" />,
          color: "text-pink-500",
        },
        {
          label: "Maior Alcance",
          value: "—",
          subtext: "Nenhum dado disponível",
          icon: <Eye className="h-4 w-4" />,
          color: "text-blue-500",
        },
      ];
    }

    // Sort for different metrics
    const byEngagement = [...topPosts].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))[0];
    const byLikes = [...topPosts].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
    const byReach = [...topPosts].sort((a, b) => (b.reach || 0) - (a.reach || 0))[0];

    return [
      {
        label: "Melhor Engajamento",
        value: `${((byEngagement?.engagement_rate || 0) * 100).toFixed(1)}%`,
        subtext: byEngagement?.caption?.substring(0, 30) + '...' || 'Post da semana',
        icon: <TrendingUp className="h-4 w-4" />,
        color: "text-green-500",
        thumbnail: byEngagement?.thumbnail_url || undefined,
      },
      {
        label: "Mais Curtido",
        value: (byLikes?.likes || 0).toLocaleString('pt-BR'),
        subtext: `${byLikes?.comments || 0} comentários`,
        icon: <Heart className="h-4 w-4" />,
        color: "text-pink-500",
        thumbnail: byLikes?.thumbnail_url || undefined,
      },
      {
        label: "Maior Alcance",
        value: (byReach?.reach || 0).toLocaleString('pt-BR'),
        subtext: 'pessoas alcançadas',
        icon: <Eye className="h-4 w-4" />,
        color: "text-blue-500",
        thumbnail: byReach?.thumbnail_url || undefined,
      },
    ];
  }, [topPosts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Destaques da Semana
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        Destaques da Semana
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {highlights.map((highlight, index) => (
          <motion.div
            key={highlight.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "relative flex items-center gap-3 p-4 rounded-xl overflow-hidden",
              "bg-card/50 backdrop-blur-sm border border-border/50"
            )}
          >
            {/* Background thumbnail */}
            {highlight.thumbnail && (
              <div 
                className="absolute inset-0 opacity-10 bg-cover bg-center"
                style={{ backgroundImage: `url(${highlight.thumbnail})` }}
              />
            )}
            
            <div className={cn("flex-shrink-0 p-2 rounded-lg bg-muted/50", highlight.color)}>
              {highlight.icon}
            </div>
            
            <div className="relative z-10 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {highlight.label}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {highlight.value}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {highlight.subtext}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
