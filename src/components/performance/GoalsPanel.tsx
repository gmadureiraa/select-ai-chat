import { useState } from "react";
import { Target, Plus, Trash2, TrendingUp, Gauge, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { usePerformanceGoals, CreateGoalData } from "@/hooks/usePerformanceGoals";

interface GoalsPanelProps {
  clientId: string;
  platform: string;
  currentMetrics?: {
    followers?: number;
    views?: number;
    engagement?: number;
    reach?: number;
  };
}

const METRIC_OPTIONS: Record<string, { label: string; value: string }[]> = {
  instagram: [
    { label: "Novos Seguidores", value: "followers" },
    { label: "Visualizações", value: "views" },
    { label: "Alcance", value: "reach" },
    { label: "Número de Posts", value: "posts" },
    { label: "Engajamento Médio (%)", value: "engagement_rate" },
    { label: "Curtidas", value: "likes" },
    { label: "Comentários", value: "comments" },
    { label: "Salvamentos", value: "saves" },
    { label: "Compartilhamentos", value: "shares" },
    { label: "Cliques no Link", value: "link_clicks" },
  ],
  twitter: [
    { label: "Seguidores", value: "followers" },
    { label: "Impressões", value: "impressions" },
    { label: "Engajamentos", value: "engagements" },
  ],
  youtube: [
    { label: "Inscritos", value: "subscribers" },
    { label: "Visualizações", value: "views" },
    { label: "Horas Assistidas", value: "watch_hours" },
  ],
  newsletter: [
    { label: "Inscritos", value: "subscribers" },
    { label: "Taxa de Abertura (%)", value: "open_rate" },
    { label: "Taxa de Cliques (%)", value: "click_rate" },
  ],
  tiktok: [
    { label: "Seguidores", value: "followers" },
    { label: "Visualizações", value: "views" },
    { label: "Engajamento (%)", value: "engagement_rate" },
  ],
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('pt-BR');
};

export const GoalsPanel = ({ clientId, platform, currentMetrics }: GoalsPanelProps) => {
  const { goals, isLoading, createGoal, deleteGoal } = usePerformanceGoals(clientId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateGoalData>>({
    platform,
    metric_name: "",
    target_value: 0,
    period: "monthly",
  });

  const platformGoals = goals.filter((g) => g.platform === platform);
  const metricOptions = METRIC_OPTIONS[platform] || METRIC_OPTIONS.instagram;

  const handleCreate = async () => {
    if (!formData.metric_name || !formData.target_value) return;

    await createGoal.mutateAsync({
      client_id: clientId,
      platform,
      metric_name: formData.metric_name,
      target_value: formData.target_value,
      period: formData.period,
    });

    setIsDialogOpen(false);
    setFormData({ platform, metric_name: "", target_value: 0, period: "monthly" });
  };

  const getMetricLabel = (metricName: string) => {
    return metricOptions.find((m) => m.value === metricName)?.label || metricName;
  };

  const calculateProgress = (goal: any) => {
    let currentValue = goal.current_value || 0;
    
    // Try to get current value from metrics
    if (currentMetrics) {
      const metricKey = goal.metric_name as keyof typeof currentMetrics;
      if (currentMetrics[metricKey] !== undefined) {
        currentValue = currentMetrics[metricKey] as number;
      }
    }

    const progress = Math.min((currentValue / goal.target_value) * 100, 100);
    return { currentValue, progress };
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "bg-emerald-500";
    if (progress >= 75) return "bg-emerald-400";
    if (progress >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  if (platformGoals.length === 0 && !isDialogOpen) {
    return (
      <Card className="border-border/50 bg-card/50 h-full">
        <CardContent className="flex flex-col items-center justify-center py-10 h-full min-h-[300px]">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium mb-1">Nenhuma meta definida</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-[200px]">
            Defina metas para acompanhar seu progresso
          </p>
          <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Meta
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 bg-card/50 h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Metas
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setIsDialogOpen(true)} className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {platformGoals.map((goal) => {
            const { currentValue, progress } = calculateProgress(goal);
            const isPercentMetric = goal.metric_name === "engagement_rate" || goal.metric_name === "open_rate" || goal.metric_name === "click_rate";
            
            return (
              <div key={goal.id} className="relative p-4 rounded-xl border border-border/50 bg-background/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">{getMetricLabel(goal.metric_name)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{goal.period}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-50 hover:opacity-100"
                    onClick={() => deleteGoal.mutate(goal.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                
                {/* Visual Gauge */}
                <div className="flex items-end gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">
                        {isPercentMetric ? `${currentValue.toFixed(1)}%` : formatNumber(currentValue)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {isPercentMetric ? `${goal.target_value}%` : formatNumber(goal.target_value)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-semibold ${progress >= 100 ? 'text-emerald-500' : progress >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${getProgressColor(progress)}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                
                {/* Status */}
                <p className="text-xs text-muted-foreground mt-2">
                  {progress >= 100 
                    ? "✅ Meta atingida!" 
                    : `Faltam ${isPercentMetric 
                        ? `${(goal.target_value - currentValue).toFixed(1)}%` 
                        : formatNumber(goal.target_value - currentValue)}`
                  }
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Criar Nova Meta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Métrica</Label>
              <Select
                value={formData.metric_name}
                onValueChange={(v) => setFormData({ ...formData, metric_name: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma métrica" />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor Alvo</Label>
              <Input
                type="number"
                value={formData.target_value || ""}
                onChange={(e) => setFormData({ ...formData, target_value: Number(e.target.value) })}
                placeholder="Ex: 10000"
              />
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select
                value={formData.period}
                onValueChange={(v) => setFormData({ ...formData, period: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createGoal.isPending || !formData.metric_name || !formData.target_value}>
              Criar Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};