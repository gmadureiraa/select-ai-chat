import { useState } from 'react';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkflowRunsPanelProps {
  workflowId: string;
}

export function WorkflowRunsPanel({ workflowId }: WorkflowRunsPanelProps) {
  const { runs, isLoadingRuns, deleteRun } = useWorkflowExecution(workflowId);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const toggleExpanded = (runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Concluído</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Falhou</Badge>;
      case 'running':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Executando</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Histórico
          {runs && runs.length > 0 && (
            <Badge variant="secondary" className="ml-1">{runs.length}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Histórico de Execuções</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
          {isLoadingRuns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs && runs.length > 0 ? (
            <div className="space-y-3">
              {runs.map((run) => (
                <Collapsible
                  key={run.id}
                  open={expandedRuns.has(run.id)}
                  onOpenChange={() => toggleExpanded(run.id)}
                >
                  <div className="border rounded-lg p-3 bg-card">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(run.status)}
                          <div>
                            <div className="text-sm font-medium">
                              {format(new Date(run.started_at), "dd MMM, HH:mm:ss", { locale: ptBR })}
                            </div>
                            {run.completed_at && (
                              <div className="text-xs text-muted-foreground">
                                Duração: {Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(run.status)}
                          {expandedRuns.has(run.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {/* Input */}
                        {run.trigger_data && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(run.trigger_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {/* Result */}
                        {run.result && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">Resultado</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
                              {typeof run.result === 'string' 
                                ? run.result 
                                : JSON.stringify(run.result, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {/* Error */}
                        {run.error && (
                          <div>
                            <div className="text-xs font-medium text-red-500 mb-1">Erro</div>
                            <pre className="text-xs bg-red-500/10 text-red-500 p-2 rounded overflow-x-auto">
                              {run.error}
                            </pre>
                          </div>
                        )}
                        
                        {/* Execution Log */}
                        {run.execution_log && run.execution_log.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Log de Execução ({run.execution_log.length} passos)
                            </div>
                            <div className="space-y-2">
                              {run.execution_log.map((log: any, idx: number) => (
                                <div key={idx} className="text-xs bg-muted/50 p-2 rounded">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-[10px]">
                                      {log.nodeType}
                                    </Badge>
                                    {log.agentName && (
                                      <span className="text-muted-foreground">{log.agentName}</span>
                                    )}
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] ${
                                        log.status === 'success' ? 'bg-green-500/10 text-green-500' :
                                        log.status === 'error' ? 'bg-red-500/10 text-red-500' :
                                        'bg-muted'
                                      }`}
                                    >
                                      {log.status}
                                    </Badge>
                                  </div>
                                  {log.output && (
                                    <pre className="text-[10px] mt-1 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                                      {typeof log.output === 'string' 
                                        ? log.output.substring(0, 200) + (log.output.length > 200 ? '...' : '')
                                        : JSON.stringify(log.output, null, 2).substring(0, 200)}
                                    </pre>
                                  )}
                                  {log.error && (
                                    <div className="text-red-500 text-[10px] mt-1">{log.error}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => deleteRun(run.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma execução ainda</p>
              <p className="text-xs mt-1">Execute o workflow para ver o histórico</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
