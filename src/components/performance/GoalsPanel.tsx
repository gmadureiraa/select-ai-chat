import { useState } from "react";
import { Target, Plus, Trash2, TrendingUp } from "lucide-react";
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
  };
}

const METRIC_OPTIONS: Record<string, { label: string; value: string }[]> = {
  instagram: [
    { label: "Seguidores", value: "followers" },
    { label: "Visualizações", value: "views" },
    { label: "Alcance", value: "reach" },
    { label: "Engajamento (%)", value: "engagement" },
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
  const metricOptions = METRIC_OPTIONS[platform] || [];

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
      if (goal.metric_name === "followers" && currentMetrics.followers) {
        currentValue = currentMetrics.followers;
      } else if (goal.metric_name === "views" && currentMetrics.views) {
        currentValue = currentMetrics.views;
      }
    }

    const progress = Math.min((currentValue / goal.target_value) * 100, 100);
    return { currentValue, progress };
  };

  if (platformGoals.length === 0 && !isDialogOpen) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-6">
          <Target className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Nenhuma meta definida</p>
          <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Meta
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Metas
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {platformGoals.map((goal) => {
            const { currentValue, progress } = calculateProgress(goal);
            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{getMetricLabel(goal.metric_name)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {currentValue.toLocaleString()} / {goal.target_value.toLocaleString()}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => deleteGoal.mutate(goal.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="flex-1" />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {progress.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Meta</DialogTitle>
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
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createGoal.isPending}>
              Criar Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
