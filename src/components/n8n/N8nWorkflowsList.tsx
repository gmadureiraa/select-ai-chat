import { useState } from "react";
import { 
  useN8nWorkflows, 
  useActivateWorkflow, 
  useDeactivateWorkflow, 
  useExecuteWorkflow 
} from "@/hooks/useN8nAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Play, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  Zap,
  AlertCircle,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface N8nWorkflowsListProps {
  onViewExecutions?: (workflowId: string, workflowName: string) => void;
  n8nBaseUrl?: string;
}

export function N8nWorkflowsList({ onViewExecutions, n8nBaseUrl }: N8nWorkflowsListProps) {
  const { data: workflows, isLoading, error, refetch } = useN8nWorkflows();
  const activateWorkflow = useActivateWorkflow();
  const deactivateWorkflow = useDeactivateWorkflow();
  const executeWorkflow = useExecuteWorkflow();
  const [executingId, setExecutingId] = useState<string | null>(null);

  const handleToggleActive = async (workflowId: string, currentActive: boolean) => {
    if (currentActive) {
      await deactivateWorkflow.mutateAsync(workflowId);
    } else {
      await activateWorkflow.mutateAsync(workflowId);
    }
  };

  const handleExecute = async (workflowId: string) => {
    setExecutingId(workflowId);
    try {
      await executeWorkflow.mutateAsync({ workflowId });
    } finally {
      setExecutingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Erro ao carregar workflows</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!workflows || workflows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum workflow encontrado no n8n</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Recarregar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Workflows n8n ({workflows.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="space-y-3">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{workflow.name}</h3>
                    <Badge variant={workflow.active ? "default" : "secondary"}>
                      {workflow.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Atualizado: {format(new Date(workflow.updatedAt), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    {workflow.tags && workflow.tags.length > 0 && (
                      <div className="flex gap-1">
                        {workflow.tags.map(tag => (
                          <Badge key={tag.id} variant="outline" className="text-xs py-0">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={workflow.active}
                    onCheckedChange={() => handleToggleActive(workflow.id, workflow.active)}
                    disabled={activateWorkflow.isPending || deactivateWorkflow.isPending}
                  />
                  
                  {onViewExecutions && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewExecutions(workflow.id, workflow.name)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExecute(workflow.id)}
                    disabled={executingId === workflow.id}
                  >
                    {executingId === workflow.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>

                  {n8nBaseUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a 
                        href={`${n8nBaseUrl}/workflow/${workflow.id}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
