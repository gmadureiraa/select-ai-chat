import { useMemo } from "react";
import { Lightbulb, Calendar, TrendingUp, TrendingDown, Clock, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { getDay, parseISO, getHours } from "date-fns";

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
          text: `${dayNames[bestDay]} é o melhor dia para postar (${bestAvg.toFixed(1)}% engajamento)`,
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
        if (data.count >= 2) {
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
          icon: Sparkles,
          text: `${typeLabels[bestType] || bestType} têm melhor performance (${bestAvg.toFixed(1)}% eng.)`,
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
        const timeRange = `${bestHour.toString().padStart(2, '0')}h - ${(bestHour + 1).toString().padStart(2, '0')}h`;
        result.push({
          icon: Clock,
          text: `Melhor horário: ${timeRange}`,
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
            icon: change > 0 ? TrendingUp : TrendingDown,
            text: change > 0 
              ? `Visualizações +${change.toFixed(0)}% últimos 7 dias`
              : `Visualizações ${change.toFixed(0)}% últimos 7 dias`,
            type: change > 0 ? "success" : "warning",
          });
        }
      }
    }

    return result.length > 0 ? result : [{ icon: Lightbulb, text: "Continue postando para gerar mais insights", type: "info" as const }];
  }, [posts, metrics]);

  const getInsightIcon = (type: "success" | "info" | "warning") => {
    switch (type) {
      case "success":
        return CheckCircle2;
      case "warning":
        return AlertTriangle;
      default:
        return Lightbulb;
    }
  };

  const getInsightStyles = (type: "success" | "info" | "warning") => {
    switch (type) {
      case "success":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
          icon: "text-emerald-500",
          text: "text-emerald-700 dark:text-emerald-400",
        };
      case "warning":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
          icon: "text-amber-500",
          text: "text-amber-700 dark:text-amber-400",
        };
      default:
        return {
          bg: "bg-blue-500/10",
          border: "border-blue-500/20",
          icon: "text-blue-500",
          text: "text-blue-700 dark:text-blue-400",
        };
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Insights Automáticos</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {insights.map((insight, i) => {
          const styles = getInsightStyles(insight.type);
          return (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg border ${styles.bg} ${styles.border}`}
            >
              <insight.icon className={`h-4 w-4 shrink-0 ${styles.icon}`} />
              <p className={`text-sm font-medium ${styles.text}`}>{insight.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
