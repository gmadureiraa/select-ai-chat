import { useMemo } from "react";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DataCompletenessWarningProps {
  platform: string;
  data: {
    total: number;
    withThumbnails?: number;
    withLikes?: number;
    withReach?: number;
    withViews?: number;
    withEngagement?: number;
  };
}

export function DataCompletenessWarning({ platform, data }: DataCompletenessWarningProps) {
  const { completeness, issues, status } = useMemo(() => {
    const checks: { name: string; complete: number; total: number }[] = [];
    
    if (data.withThumbnails !== undefined) {
      checks.push({ name: "Thumbnails", complete: data.withThumbnails, total: data.total });
    }
    if (data.withLikes !== undefined) {
      checks.push({ name: "Likes", complete: data.withLikes, total: data.total });
    }
    if (data.withReach !== undefined) {
      checks.push({ name: "Alcance", complete: data.withReach, total: data.total });
    }
    if (data.withViews !== undefined) {
      checks.push({ name: "Views", complete: data.withViews, total: data.total });
    }
    if (data.withEngagement !== undefined) {
      checks.push({ name: "Engajamento", complete: data.withEngagement, total: data.total });
    }

    if (checks.length === 0 || data.total === 0) {
      return { completeness: 100, issues: [], status: "complete" as const };
    }

    const avgCompleteness = checks.reduce((sum, c) => sum + (c.complete / c.total) * 100, 0) / checks.length;
    const incompleteFields = checks.filter(c => c.complete < c.total);

    const issues = incompleteFields.map(c => ({
      name: c.name,
      percentage: Math.round((c.complete / c.total) * 100),
      missing: c.total - c.complete,
    }));

    let status: "complete" | "warning" | "incomplete";
    if (avgCompleteness >= 95) status = "complete";
    else if (avgCompleteness >= 70) status = "warning";
    else status = "incomplete";

    return { completeness: Math.round(avgCompleteness), issues, status };
  }, [data]);

  if (data.total === 0) {
    return null;
  }

  if (status === "complete") {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <CheckCircle className="h-3.5 w-3.5" />
        <span>Dados completos</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-help">
          {status === "warning" ? (
            <Info className="h-3.5 w-3.5 text-yellow-500" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
          )}
          <div className="flex items-center gap-2">
            <Progress value={completeness} className="w-16 h-1.5" />
            <span className="text-xs text-muted-foreground">{completeness}%</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-2">
          <p className="font-medium">Completude dos Dados</p>
          <div className="space-y-1 text-xs">
            {issues.map((issue) => (
              <div key={issue.name} className="flex items-center justify-between gap-4">
                <span>{issue.name}:</span>
                <span className={issue.percentage < 50 ? "text-orange-500" : "text-yellow-500"}>
                  {issue.percentage}% ({issue.missing} sem dados)
                </span>
              </div>
            ))}
          </div>
          {status === "incomplete" && (
            <p className="text-xs text-muted-foreground pt-1 border-t">
              Importe CSVs atualizados para completar os dados faltantes.
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface DataWarningBannerProps {
  issues: string[];
  onDismiss?: () => void;
}

export function DataWarningBanner({ issues, onDismiss }: DataWarningBannerProps) {
  if (issues.length === 0) return null;

  return (
    <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/20">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-700 dark:text-yellow-400">Dados Incompletos</AlertTitle>
      <AlertDescription className="text-yellow-600 dark:text-yellow-300/80">
        <ul className="list-disc list-inside mt-1 space-y-0.5 text-sm">
          {issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs">
          Importe CSVs atualizados ou conecte APIs para obter dados completos.
        </p>
      </AlertDescription>
    </Alert>
  );
}
