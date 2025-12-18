import { Bot, CheckCircle2, XCircle, Loader2, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WorkflowExecutionCardProps {
  workflowName: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string | null;
  error?: string | null;
}

export function WorkflowExecutionCard({
  workflowName,
  status,
  result,
  error,
}: WorkflowExecutionCardProps) {
  const statusConfig = {
    pending: {
      icon: Workflow,
      label: "Aguardando",
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
    },
    running: {
      icon: Loader2,
      label: "Executando",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      animate: true,
    },
    completed: {
      icon: CheckCircle2,
      label: "Concluído",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    failed: {
      icon: XCircle,
      label: "Falhou",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card className={cn("border-l-4", config.bgColor, {
      "border-l-muted-foreground": status === "pending",
      "border-l-blue-500": status === "running",
      "border-l-green-500": status === "completed",
      "border-l-destructive": status === "failed",
    })}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Workflow: {workflowName}</CardTitle>
          </div>
          <Badge variant="outline" className={cn("gap-1", config.color)}>
            <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      
      {(result || error) && (
        <CardContent className="pt-0">
          {error ? (
            <div className="text-sm text-destructive bg-destructive/5 p-3 rounded-md">
              {error}
            </div>
          ) : result ? (
            <div className="text-sm text-foreground/80 bg-muted/30 p-3 rounded-md whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {result}
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
