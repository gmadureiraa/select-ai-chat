import { useN8nExecution, N8nExecution } from "@/hooks/useN8nAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Timer,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileJson
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface N8nExecutionDetailsProps {
  executionId: string | null;
  execution?: N8nExecution;
}

export function N8nExecutionDetails({ executionId, execution: passedExecution }: N8nExecutionDetailsProps) {
  const { data: fetchedExecution, isLoading } = useN8nExecution(
    passedExecution ? null : executionId
  );
  
  const execution = passedExecution || fetchedExecution;
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeName: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeName)) {
      newExpanded.delete(nodeName);
    } else {
      newExpanded.add(nodeName);
    }
    setExpandedNodes(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!execution) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileJson className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Selecione uma execução para ver os detalhes</p>
        </CardContent>
      </Card>
    );
  }

  const runData = execution.data?.resultData?.runData || {};
  const executionError = execution.data?.resultData?.error;
  const nodeNames = Object.keys(runData);

  const getDuration = () => {
    if (!execution.stoppedAt) return null;
    const start = new Date(execution.startedAt).getTime();
    const end = new Date(execution.stoppedAt).getTime();
    const durationMs = end - start;
    
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}min`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Execução #{execution.id.slice(0, 8)}
            </CardTitle>
            <Badge variant={execution.status === 'success' ? 'default' : 'destructive'}>
              {execution.status === 'success' ? (
                <><CheckCircle2 className="mr-1 h-3 w-3" /> Sucesso</>
              ) : execution.status === 'error' ? (
                <><XCircle className="mr-1 h-3 w-3" /> Erro</>
              ) : execution.status === 'running' ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Executando</>
              ) : (
                <><Clock className="mr-1 h-3 w-3" /> {execution.status}</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Início:</span>
              <p className="font-medium">
                {format(new Date(execution.startedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              </p>
            </div>
            {execution.stoppedAt && (
              <div>
                <span className="text-muted-foreground">Fim:</span>
                <p className="font-medium">
                  {format(new Date(execution.stoppedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground flex items-center gap-1">
                <Timer className="h-3 w-3" /> Duração:
              </span>
              <p className="font-medium">{getDuration() || 'Em andamento'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {executionError && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Erro na Execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-destructive/10 p-3 rounded-lg overflow-x-auto">
              {executionError.message}
            </pre>
            {executionError.stack && (
              <details className="mt-2">
                <summary className="text-sm text-muted-foreground cursor-pointer">
                  Stack trace
                </summary>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                  {executionError.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="nodes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="nodes">Nodes ({nodeNames.length})</TabsTrigger>
          <TabsTrigger value="raw">JSON Completo</TabsTrigger>
        </TabsList>

        <TabsContent value="nodes">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {nodeNames.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-center text-muted-foreground">
                    Nenhum dado de execução disponível
                  </CardContent>
                </Card>
              ) : (
                nodeNames.map((nodeName) => {
                  const nodeExecutions = runData[nodeName];
                  const isExpanded = expandedNodes.has(nodeName);
                  const lastExecution = nodeExecutions[nodeExecutions.length - 1];
                  const hasError = lastExecution?.error;
                  const outputItems = lastExecution?.data?.main?.[0]?.length || 0;

                  return (
                    <Card 
                      key={nodeName}
                      className={cn(
                        "cursor-pointer transition-colors",
                        hasError && "border-destructive/50"
                      )}
                      onClick={() => toggleNode(nodeName)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium">{nodeName}</span>
                            {hasError ? (
                              <Badge variant="destructive">Erro</Badge>
                            ) : (
                              <Badge variant="secondary">{outputItems} items</Badge>
                            )}
                          </div>
                          {lastExecution?.executionTime && (
                            <span className="text-xs text-muted-foreground">
                              {lastExecution.executionTime}ms
                            </span>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            {hasError ? (
                              <pre className="text-sm bg-destructive/10 p-2 rounded overflow-x-auto">
                                {lastExecution.error?.message}
                              </pre>
                            ) : (
                              <Tabs defaultValue="output" className="w-full">
                                <TabsList className="h-8">
                                  <TabsTrigger value="output" className="text-xs">
                                    Output
                                  </TabsTrigger>
                                  <TabsTrigger value="input" className="text-xs">
                                    Input
                                  </TabsTrigger>
                                </TabsList>
                                <TabsContent value="output">
                                  <ScrollArea className="h-[200px]">
                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                      {JSON.stringify(
                                        lastExecution?.data?.main?.[0]?.map(item => item.json) || [],
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </ScrollArea>
                                </TabsContent>
                                <TabsContent value="input">
                                  <ScrollArea className="h-[200px]">
                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                      {JSON.stringify(lastExecution?.source || [], null, 2)}
                                    </pre>
                                  </ScrollArea>
                                </TabsContent>
                              </Tabs>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="raw">
          <ScrollArea className="h-[400px]">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
              {JSON.stringify(execution, null, 2)}
            </pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
