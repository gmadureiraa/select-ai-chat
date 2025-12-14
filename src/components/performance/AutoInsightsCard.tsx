import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Calendar, TrendingUp, Clock } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { format, parseISO, getDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AutoInsightsCardProps {
  posts: InstagramPost[];
  metrics: PerformanceMetrics[];
}

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function AutoInsightsCard({ posts, metrics }: AutoInsightsCardProps) {
  const insights = useMemo(() => {
    const result: { icon: any; text: string; type: "success" | "info" | "warning" }[] = [];

    if (!posts.length && !metrics.length) {
      return [{ icon: Lightbulb, text: "Importe dados para gerar insights automáticos", type: "info" as const }];
    }

    // Best day of week for engagement
    if (posts.length > 0) {
      const dayEngagement: Record<number, { total: number; count: number }> = {};
      
      posts.forEach(post => {
        if (post.posted_at && post.engagement_rate) {
          const day = getDay(parseISO(post.posted_at));
          if (!dayEngagement[day]) dayEngagement[day] = { total: 0, count: 0 };
          dayEngagement[day].total += post.engagement_rate;
          dayEngagement[day].count += 1;
        }
      });

      let bestDay = -1;
      let bestAvg = 0;
      Object.entries(dayEngagement).forEach(([day, data]) => {
        const avg = data.total / data.count;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestDay = parseInt(day);
        }
      });

      if (bestDay >= 0) {
        result.push({
          icon: Calendar,
          text: `${dayNames[bestDay]} é o melhor dia para postar (${bestAvg.toFixed(1)}% engajamento médio)`,
          type: "success",
        });
      }
    }

    // Best post type
    if (posts.length > 0) {
      const typeEngagement: Record<string, { total: number; count: number }> = {};
      
      posts.forEach(post => {
        const type = post.post_type || "image";
        if (post.engagement_rate) {
          if (!typeEngagement[type]) typeEngagement[type] = { total: 0, count: 0 };
          typeEngagement[type].total += post.engagement_rate;
          typeEngagement[type].count += 1;
        }
      });

      let bestType = "";
      let bestAvg = 0;
      Object.entries(typeEngagement).forEach(([type, data]) => {
        if (data.count >= 2) { // At least 2 posts of this type
          const avg = data.total / data.count;
          if (avg > bestAvg) {
            bestAvg = avg;
            bestType = type;
          }
        }
      });

      const typeLabels: Record<string, string> = {
        carousel: "Carrosseis",
        reel: "Reels",
        image: "Imagens",
        story: "Stories",
      };

      if (bestType) {
        result.push({
          icon: TrendingUp,
          text: `${typeLabels[bestType] || bestType} têm melhor performance (${bestAvg.toFixed(1)}% engajamento)`,
          type: "success",
        });
      }
    }

    // Best time to post
    if (posts.length > 0) {
      const hourEngagement: Record<number, { total: number; count: number }> = {};
      
      posts.forEach(post => {
        if (post.posted_at && post.engagement_rate) {
          const hour = getHours(parseISO(post.posted_at));
          if (!hourEngagement[hour]) hourEngagement[hour] = { total: 0, count: 0 };
          hourEngagement[hour].total += post.engagement_rate;
          hourEngagement[hour].count += 1;
        }
      });

      let bestHour = -1;
      let bestAvg = 0;
      Object.entries(hourEngagement).forEach(([hour, data]) => {
        if (data.count >= 2) {
          const avg = data.total / data.count;
          if (avg > bestAvg) {
            bestAvg = avg;
            bestHour = parseInt(hour);
          }
        }
      });

      if (bestHour >= 0) {
        const timeRange = `${bestHour.toString().padStart(2, '0')}:00 - ${(bestHour + 1).toString().padStart(2, '0')}:00`;
        result.push({
          icon: Clock,
          text: `Melhor horário para postar: ${timeRange}`,
          type: "info",
        });
      }
    }

    // Views trend
    if (metrics.length >= 7) {
      const recent = metrics.slice(0, 7);
      const older = metrics.slice(7, 14);
      
      const recentAvg = recent.reduce((sum, m) => sum + (m.views || 0), 0) / recent.length;
      const olderAvg = older.length > 0 
        ? older.reduce((sum, m) => sum + (m.views || 0), 0) / older.length 
        : recentAvg;

      if (olderAvg > 0) {
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        if (Math.abs(change) > 10) {
          result.push({
            icon: TrendingUp,
            text: change > 0 
              ? `Visualizações cresceram ${change.toFixed(0)}% nos últimos 7 dias`
              : `Atenção: Visualizações caíram ${Math.abs(change).toFixed(0)}% nos últimos 7 dias`,
            type: change > 0 ? "success" : "warning",
          });
        }
      }
    }

    return result.length > 0 ? result : [{ icon: Lightbulb, text: "Continue postando para gerar mais insights", type: "info" as const }];
  }, [posts, metrics]);

  const getInsightStyle = (type: "success" | "info" | "warning") => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400";
      case "warning":
        return "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400";
      default:
        return "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          💡 Insights Automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg border ${getInsightStyle(insight.type)}`}
          >
            <insight.icon className="h-4 w-4 shrink-0" />
            <p className="text-sm">{insight.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
