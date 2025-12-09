import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle, Trophy, Target } from "lucide-react";

interface Insight {
  type: "success" | "warning" | "info" | "highlight";
  title: string;
  value?: string | number;
  change?: number;
  description?: string;
}

interface InsightsCardProps {
  insights: Insight[];
  bestContent?: {
    title: string;
    metric: string;
    value: number;
    type?: string;
  };
  periodComparison?: {
    label: string;
    current: number;
    previous: number;
  };
}

function InsightItem({ insight }: { insight: Insight }) {
  const iconMap = {
    success: <TrendingUp className="h-4 w-4 text-emerald-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    info: <Sparkles className="h-4 w-4 text-primary" />,
    highlight: <Trophy className="h-4 w-4 text-secondary" />,
  };

  const bgMap = {
    success: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    info: "bg-primary/10 border-primary/20",
    highlight: "bg-secondary/10 border-secondary/20",
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bgMap[insight.type]}`}>
      <div className="mt-0.5">{iconMap[insight.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{insight.title}</span>
          {insight.value && (
            <Badge variant="secondary" className="text-xs">
              {typeof insight.value === "number" ? insight.value.toLocaleString("pt-BR") : insight.value}
            </Badge>
          )}
        </div>
        {insight.description && (
          <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
        )}
        {insight.change !== undefined && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${
            insight.change >= 0 ? "text-emerald-500" : "text-red-500"
          }`}>
            {insight.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {insight.change >= 0 ? "+" : ""}{insight.change.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

export function InsightsCard({ insights, bestContent, periodComparison }: InsightsCardProps) {
  const comparisonChange = periodComparison 
    ? ((periodComparison.current - periodComparison.previous) / periodComparison.previous) * 100
    : 0;

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Insights do Período</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Best Content Highlight */}
        {bestContent && (
          <div className="bg-gradient-to-r from-secondary/20 via-secondary/10 to-transparent p-4 rounded-xl border border-secondary/20">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-secondary" />
              <span className="text-xs font-medium text-secondary uppercase tracking-wide">
                Melhor Performance
              </span>
            </div>
            <h4 className="font-semibold text-sm line-clamp-2 mb-2">{bestContent.title}</h4>
            <div className="flex items-center gap-3">
              {bestContent.type && (
                <Badge variant="outline" className="text-xs">
                  {bestContent.type}
                </Badge>
              )}
              <span className="text-lg font-bold text-secondary">
                {bestContent.value.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs text-muted-foreground">{bestContent.metric}</span>
            </div>
          </div>
        )}

        {/* Period Comparison */}
        {periodComparison && (
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{periodComparison.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Anterior</div>
                <div className="text-sm font-medium">{periodComparison.previous.toLocaleString("pt-BR")}</div>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                comparisonChange >= 0 ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
              }`}>
                {comparisonChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span className="text-xs font-medium">
                  {comparisonChange >= 0 ? "+" : ""}{comparisonChange.toFixed(1)}%
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Atual</div>
                <div className="text-sm font-bold">{periodComparison.current.toLocaleString("pt-BR")}</div>
              </div>
            </div>
          </div>
        )}

        {/* Insights List */}
        {insights.length > 0 && (
          <div className="grid gap-2">
            {insights.map((insight, index) => (
              <InsightItem key={index} insight={insight} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
