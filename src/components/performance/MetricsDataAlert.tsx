import { AlertTriangle, Upload, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MetricStatus {
  name: string;
  key: string;
  hasData: boolean;
  count: number;
  csvName?: string;
}

interface MetricsDataAlertProps {
  metrics: MetricStatus[];
  platform: string;
  onShowUpload?: () => void;
}

export function MetricsDataAlert({ metrics, platform, onShowUpload }: MetricsDataAlertProps) {
  const missingMetrics = metrics.filter(m => !m.hasData);
  
  if (missingMetrics.length === 0) {
    return null;
  }

  return (
    <Alert variant="default" className="bg-yellow-500/5 border-yellow-500/20">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-yellow-700 dark:text-yellow-400">
            Métricas faltando
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingMetrics.map((metric) => (
              <Badge 
                key={metric.key} 
                variant="outline" 
                className="text-xs border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
              >
                {metric.name}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Importe os CSVs correspondentes para ver esses dados.
          </p>
        </div>
        {onShowUpload && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onShowUpload}
            className="shrink-0 border-yellow-500/30 hover:bg-yellow-500/10"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Importar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface DataStatusBadgeProps {
  hasData: boolean;
  label: string;
}

export function DataStatusBadge({ hasData, label }: DataStatusBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={hasData 
        ? "text-green-600 border-green-500/30 bg-green-500/10" 
        : "text-yellow-600 border-yellow-500/30 bg-yellow-500/10"
      }
    >
      {hasData ? (
        <CheckCircle className="h-3 w-3 mr-1" />
      ) : (
        <AlertTriangle className="h-3 w-3 mr-1" />
      )}
      {label}
    </Badge>
  );
}
