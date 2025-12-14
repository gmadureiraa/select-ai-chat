import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Eye, Users, Target, Heart } from "lucide-react";

interface PeriodComparisonCardProps {
  currentPeriod: string;
  currentMetrics: {
    views: number;
    followers: number;
    reach: number;
    interactions: number;
  };
  previousMetrics: {
    views: number;
    followers: number;
    reach: number;
    interactions: number;
  };
}

const periodLabels: Record<string, string> = {
  "7": "7 dias",
  "14": "14 dias",
  "30": "30 dias",
  "60": "60 dias",
  "90": "90 dias",
  "all": "todo período",
};

export function PeriodComparisonCard({
  currentPeriod,
  currentMetrics,
  previousMetrics,
}: PeriodComparisonCardProps) {
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const metrics = [
    {
      label: "Visualizações",
      icon: Eye,
      current: currentMetrics.views,
      previous: previousMetrics.views,
      change: calcChange(currentMetrics.views, previousMetrics.views),
    },
    {
      label: "Seguidores",
      icon: Users,
      current: currentMetrics.followers,
      previous: previousMetrics.followers,
      change: calcChange(currentMetrics.followers, previousMetrics.followers),
    },
    {
      label: "Alcance",
      icon: Target,
      current: currentMetrics.reach,
      previous: previousMetrics.reach,
      change: calcChange(currentMetrics.reach, previousMetrics.reach),
    },
    {
      label: "Interações",
      icon: Heart,
      current: currentMetrics.interactions,
      previous: previousMetrics.interactions,
      change: calcChange(currentMetrics.interactions, previousMetrics.interactions),
    },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4" />;
    if (change < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 5) return "text-green-500 bg-green-500/10";
    if (change < -5) return "text-red-500 bg-red-500/10";
    return "text-muted-foreground bg-muted/50";
  };

  if (currentPeriod === "all") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          📊 Comparativo vs Período Anterior
          <span className="text-xs font-normal text-muted-foreground">
            ({periodLabels[currentPeriod] || currentPeriod})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <metric.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="font-semibold">{formatNumber(metric.current)}</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(
                  metric.change
                )}`}
              >
                {getTrendIcon(metric.change)}
                <span>{metric.change > 0 ? "+" : ""}{metric.change.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
