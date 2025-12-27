import { useState } from "react";
import { useN8nExecutions, useRetryExecution, useDeleteExecution, N8nExecution } from "@/hooks/useN8nAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Trash2,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  Timer
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface N8nExecutionsListProps {
  workflowId?: string;
  workflowName?: string;
  onSelectExecution?: (execution: N8nExecution) => void;
  selectedExecutionId?: string;
}

export function N8nExecutionsList({ 
  workflowId, 
  workflowName,
  onSelectExecution,
  selectedExecutionId
}: N8nExecutionsListProps) {
  const { data: executions, isLoading, error, refetch } = useN8nExecutions(workflowId);
  const retryExecution = useRetryExecution();
  const deleteExecution = useDeleteExecution();

  const getStatusIcon = (status: N8nExecution['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'waiting':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: N8nExecution['status']) => {
    const variants: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
      success: "default",
      error: "destructive",
      running: "secondary",
      waiting: "outline",
      canceled: "secondary"
    };
    const labels: Record<string, string> = {
      success: "Sucesso",
      error: "Erro",
      running: "Executando",
      waiting: "Aguardando",
      canceled: "Cancelado"
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getDuration = (startedAt: string, stoppedAt?: string) => {
    if (!stoppedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = new Date(stoppedAt).getTime();
    const durationMs = end - start;
    
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}min`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Erro ao carregar execuções</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Execuções {workflowName && `- ${workflowName}`}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {executions?.length || 0} execuções encontradas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {!executions || executions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma execução encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {executions.map((execution) => (
              <div
                key={execution.id}
                className={`
                  flex items-center gap-3 p-3 border rounded-lg cursor-pointer
                  hover:bg-muted/50 transition-colors
                  ${selectedExecutionId === execution.id ? 'border-primary bg-muted/30' : ''}
                `}
                onClick={() => onSelectExecution?.(execution)}
              >
                {getStatusIcon(execution.status)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">#{execution.id.slice(0, 8)}</span>
                    {getStatusBadge(execution.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>
                      {format(new Date(execution.startedAt), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(execution.startedAt), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                    {execution.stoppedAt && (
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {getDuration(execution.startedAt, execution.stoppedAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {execution.status === 'error' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        retryExecution.mutate(execution.id);
                      }}
                      disabled={retryExecution.isPending}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteExecution.mutate(execution.id);
                    }}
                    disabled={deleteExecution.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
