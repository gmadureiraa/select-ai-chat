import { useFormatMetrics, FormatUsageMetric } from "@/hooks/useFormatMetrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  CheckCircle2, 
  TrendingUp, 
  FileText,
  Sparkles,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const FormatMetricsDashboard = () => {
  const { data: metrics, isLoading } = useFormatMetrics();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Sem dados de métricas disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gerações Totais</p>
                <p className="text-2xl font-bold">{metrics.totalGenerations.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sucesso</p>
                <p className="text-2xl font-bold">{metrics.totalSuccess.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold">{metrics.overallSuccessRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Formats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Formatos Mais Usados
          </CardTitle>
          <CardDescription>
            Distribuição de uso e taxa de sucesso por formato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.formatBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum formato utilizado ainda
              </p>
            ) : (
              metrics.formatBreakdown.map((format) => (
                <FormatMetricRow key={format.format} metric={format} maxCount={metrics.formatBreakdown[0]?.count || 1} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface FormatMetricRowProps {
  metric: FormatUsageMetric;
  maxCount: number;
}

const FormatMetricRow = ({ metric, maxCount }: FormatMetricRowProps) => {
  const percentage = (metric.count / maxCount) * 100;
  
  const getSuccessColor = (rate: number) => {
    if (rate >= 90) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (rate >= 70) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-red-500/10 text-red-500 border-red-500/20";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{metric.formatName}</span>
          <Badge variant="outline" className="text-xs">
            {metric.count} usos
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {metric.lastUsed && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(metric.lastUsed), { addSuffix: true, locale: ptBR })}
            </span>
          )}
          <Badge variant="outline" className={getSuccessColor(metric.successRate)}>
            {metric.successRate.toFixed(0)}% sucesso
          </Badge>
        </div>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
};

export default FormatMetricsDashboard;
