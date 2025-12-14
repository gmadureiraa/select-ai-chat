import { useMemo } from "react";
import { Lightbulb, Calendar, TrendingUp, TrendingDown, Clock, Sparkles, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { getDay, parseISO, format } from "date-fns";

interface NewsletterMetric {
  id: string;
  metric_date: string;
  views?: number | null;
  subscribers?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  metadata?: {
    delivered?: number;
    opens?: number;
    clicks?: number;
    unsubscribes?: number;
    spamReports?: number;
    newSubscribers?: number;
    subject?: string;
  } | null;
}

interface NewsletterInsightsCardProps {
  metrics: NewsletterMetric[];
}

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function NewsletterInsightsCard({ metrics }: NewsletterInsightsCardProps) {
  const insights = useMemo(() => {
    const result: { icon: any; text: string; type: "success" | "info" | "warning" }[] = [];

    if (!metrics.length) {
      return [{ icon: Lightbulb, text: "Importe dados para gerar insights automáticos", type: "info" as const }];
    }

    // Best day of week for open rate
    const dayOpenRate: Record<number, { total: number; count: number }> = {};
    
    metrics.forEach(m => {
      if (m.metric_date && m.open_rate) {
        const day = getDay(parseISO(m.metric_date));
        if (!dayOpenRate[day]) dayOpenRate[day] = { total: 0, count: 0 };
        dayOpenRate[day].total += m.open_rate;
        dayOpenRate[day].count += 1;
      }
    });

    let bestDay = -1;
    let bestAvg = 0;
    Object.entries(dayOpenRate).forEach(([day, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestDay = parseInt(day);
      }
    });

    if (bestDay >= 0) {
      result.push({
        icon: Calendar,
        text: `${dayNames[bestDay]} é o melhor dia para envio (${bestAvg.toFixed(1)}% abertura)`,
        type: "success",
      });
    }

    // Open rate trend
    if (metrics.length >= 4) {
      const recent = metrics.slice(0, 4);
      const older = metrics.slice(4, 8);
      
      const recentAvg = recent.reduce((sum, m) => sum + (m.open_rate || 0), 0) / recent.length;
      const olderAvg = older.length > 0 
        ? older.reduce((sum, m) => sum + (m.open_rate || 0), 0) / older.length 
        : recentAvg;

      if (olderAvg > 0) {
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        if (Math.abs(change) > 5) {
          result.push({
            icon: change > 0 ? TrendingUp : TrendingDown,
            text: change > 0 
              ? `Taxa de abertura +${change.toFixed(0)}% últimas edições`
              : `Taxa de abertura ${change.toFixed(0)}% últimas edições`,
            type: change > 0 ? "success" : "warning",
          });
        }
      }
    }

    // Click rate analysis
    const avgClickRate = metrics.reduce((sum, m) => sum + (m.click_rate || 0), 0) / metrics.length;
    if (avgClickRate > 3) {
      result.push({
        icon: Sparkles,
        text: `Excelente CTR médio: ${avgClickRate.toFixed(1)}% (acima da média)`,
        type: "success",
      });
    } else if (avgClickRate < 1 && avgClickRate > 0) {
      result.push({
        icon: AlertTriangle,
        text: `CTR de ${avgClickRate.toFixed(1)}% abaixo do ideal (2-3%)`,
        type: "warning",
      });
    }

    // Subscriber growth trend
    const firstMetric = [...metrics].sort((a, b) => a.metric_date.localeCompare(b.metric_date))[0];
    const lastMetric = [...metrics].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0];
    
    if (firstMetric && lastMetric && firstMetric.subscribers && lastMetric.subscribers) {
      const growth = lastMetric.subscribers - firstMetric.subscribers;
      if (growth > 0) {
        result.push({
          icon: Mail,
          text: `+${growth.toLocaleString()} novos inscritos no período`,
          type: "success",
        });
      }
    }

    // Unsubscribe warning
    const totalUnsubscribes = metrics.reduce((sum, m) => sum + (m.metadata?.unsubscribes || 0), 0);
    const totalDelivered = metrics.reduce((sum, m) => sum + (m.views || m.metadata?.delivered || 0), 0);
    if (totalDelivered > 0) {
      const unsubRate = (totalUnsubscribes / totalDelivered) * 100;
      if (unsubRate > 0.5) {
        result.push({
          icon: AlertTriangle,
          text: `Taxa de descadastro de ${unsubRate.toFixed(2)}% - considere revisar conteúdo`,
          type: "warning",
        });
      }
    }

    return result.length > 0 ? result : [{ icon: Lightbulb, text: "Continue enviando para gerar mais insights", type: "info" as const }];
  }, [metrics]);

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
