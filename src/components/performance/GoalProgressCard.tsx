import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Target, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PerformanceGoal } from "@/hooks/usePerformanceGoals";

interface GoalProgressCardProps {
  goal: PerformanceGoal;
  currentValue: number;
  onDelete?: (goalId: string) => void;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('pt-BR');
};

const metricLabels: Record<string, { label: string; isPercent?: boolean }> = {
  followers: { label: "Novos Seguidores" },
  views: { label: "Visualizações" },
  reach: { label: "Alcance" },
  posts: { label: "Número de Posts" },
  engagement_rate: { label: "Engajamento Médio", isPercent: true },
  likes: { label: "Curtidas" },
  comments: { label: "Comentários" },
  shares: { label: "Compartilhamentos" },
  saves: { label: "Salvamentos" },
  link_clicks: { label: "Cliques no Link" },
};

const periodLabels: Record<string, string> = {
  weekly: "Esta semana",
  monthly: "Este mês",
  quarterly: "Este trimestre",
  yearly: "Este ano",
};

export function GoalProgressCard({ goal, currentValue, onDelete }: GoalProgressCardProps) {
  const progress = Math.min((currentValue / goal.target_value) * 100, 100);
  const metricInfo = metricLabels[goal.metric_name] || { label: goal.metric_name };
  const metricLabel = metricInfo.label;
  const isPercent = metricInfo.isPercent;
  const periodLabel = periodLabels[goal.period] || goal.period;
  
  const displayValue = isPercent ? `${currentValue.toFixed(2)}%` : formatNumber(currentValue);
  const displayTarget = isPercent ? `${goal.target_value}%` : formatNumber(goal.target_value);
  const remaining = isPercent 
    ? `${(goal.target_value - currentValue).toFixed(2)}%` 
    : formatNumber(goal.target_value - currentValue);
  
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{metricLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-normal">
              {periodLabel}
            </Badge>
            {onDelete && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(goal.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold">{displayValue}</span>
          <span className="text-sm text-muted-foreground">
            / {displayTarget}
          </span>
          <span className={cn(
            "text-sm font-semibold ml-auto",
            progress >= 100 ? "text-primary" :
            progress >= 50 ? "text-primary/70" : "text-muted-foreground"
          )}>
            {progress.toFixed(0)}%
          </span>
        </div>
        
        <Progress 
          value={progress} 
          className={cn(
            "h-2",
            progress >= 100 && "[&>div]:bg-primary",
            progress >= 50 && progress < 100 && "[&>div]:bg-primary/70",
            progress < 50 && "[&>div]:bg-primary/40"
          )}
        />
        
        <p className="text-xs text-muted-foreground mt-2">
          {progress >= 100 
            ? "✅ Meta atingida!" 
            : `Faltam ${remaining} para atingir a meta`
          }
        </p>
      </CardContent>
    </Card>
  );
}
