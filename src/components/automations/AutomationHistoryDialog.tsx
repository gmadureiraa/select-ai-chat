import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Loader2, SkipForward, ExternalLink, Image, Zap, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutomationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PlanningAutomationRun {
  id: string;
  automation_id: string;
  workspace_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  result: string | null;
  error: string | null;
  items_created: number;
  trigger_data: { title?: string; link?: string; images_count?: number } | null;
  planning_automations?: {
    name: string;
    content_type?: string;
  };
}

export function AutomationHistoryDialog({ open, onOpenChange }: AutomationHistoryDialogProps) {
  const { workspace } = useWorkspace();
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const { data: runs, isLoading } = useQuery({
    queryKey: ['planning-automation-runs', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const { data, error } = await supabase
        .from('planning_automation_runs')
        .select(`
          *,
          planning_automations (
            name,
            content_type
          )
        `)
        .eq('workspace_id', workspace.id)
        .order('started_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      return (data || []) as PlanningAutomationRun[];
    },
    enabled: !!workspace?.id && open,
  });

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
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Sucesso</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Erro</Badge>;
      case 'running':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Executando</Badge>;
      case 'skipped':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Pulado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const getContentTypeLabel = (contentType?: string) => {
    const labels: Record<string, string> = {
      'tweet': 'Tweet',
      'thread': 'Thread',
      'carousel': 'Carrossel',
      'linkedin_post': 'LinkedIn',
      'newsletter': 'Newsletter',
      'instagram_post': 'Instagram',
      'stories': 'Stories',
    };
    return contentType ? labels[contentType] || contentType : null;
  };

  // Group runs by date
  const groupedRuns = runs?.reduce((acc, run) => {
    const date = format(new Date(run.started_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(run);
    return acc;
  }, {} as Record<string, PlanningAutomationRun[]>) || {};

  const stats = {
    total: runs?.length || 0,
    completed: runs?.filter(r => r.status === 'completed').length || 0,
    failed: runs?.filter(r => r.status === 'failed').length || 0,
    skipped: runs?.filter(r => r.status === 'skipped').length || 0,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Histórico de Execuções
          </DialogTitle>
          <DialogDescription>
            Últimas 50 execuções de automações de planejamento
          </DialogDescription>
        </DialogHeader>

        {/* Stats summary */}
        {runs && runs.length > 0 && (
          <div className="flex gap-4 text-sm border-b pb-3 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="font-medium text-green-600">{stats.completed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="font-medium text-red-600">{stats.failed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">{stats.skipped}</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : runs && runs.length > 0 ? (
          <ScrollArea className="h-[450px] pr-4">
            <div className="space-y-4">
              {Object.entries(groupedRuns).map(([date, dateRuns]) => (
                <div key={date}>
                  <div className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                    {format(new Date(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="space-y-2">
                    {dateRuns.map((run) => {
                      const isExpanded = expandedRuns.has(run.id);
                      const hasDetails = run.error || run.result || run.trigger_data;
                      
                      return (
                        <Collapsible 
                          key={run.id} 
                          open={isExpanded} 
                          onOpenChange={() => hasDetails && toggleExpanded(run.id)}
                        >
                          <div
                            className={cn(
                              "border rounded-lg transition-colors",
                              run.status === 'failed' && "border-red-500/30 bg-red-500/5",
                              run.status === 'completed' && "border-green-500/20",
                              hasDetails && "cursor-pointer hover:bg-muted/50"
                            )}
                          >
                            <CollapsibleTrigger asChild disabled={!hasDetails}>
                              <div className="flex items-start gap-3 p-3">
                                <div className="mt-0.5">
                                  {getStatusIcon(run.status)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-medium truncate">
                                      {run.planning_automations?.name || 'Automação removida'}
                                    </span>
                                    {getStatusBadge(run.status)}
                                    {run.planning_automations?.content_type && (
                                      <Badge variant="secondary" className="text-xs">
                                        {getContentTypeLabel(run.planning_automations.content_type)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                                    <span>
                                      {format(new Date(run.started_at), "HH:mm:ss", { locale: ptBR })}
                                    </span>
                                    {run.duration_ms && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDuration(run.duration_ms)}
                                      </span>
                                    )}
                                    {run.items_created > 0 && (
                                      <span className="text-green-600 font-medium">
                                        +{run.items_created} card{run.items_created > 1 ? 's' : ''}
                                      </span>
                                    )}
                                    {run.trigger_data?.images_count && run.trigger_data.images_count > 0 && (
                                      <span className="flex items-center gap-1 text-blue-600">
                                        <Image className="h-3 w-3" />
                                        {run.trigger_data.images_count}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {hasDetails && (
                                  <ChevronDown 
                                    className={cn(
                                      "h-4 w-4 text-muted-foreground transition-transform",
                                      isExpanded && "transform rotate-180"
                                    )} 
                                  />
                                )}
                              </div>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <div className="px-3 pb-3 pt-0 space-y-2 border-t mt-1 pt-2">
                                {run.error && (
                                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-500/10 p-2 rounded">
                                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span className="break-words">{run.error}</span>
                                  </div>
                                )}
                                {run.result && run.status !== 'skipped' && (
                                  <p className="text-sm text-muted-foreground">
                                    {run.result}
                                  </p>
                                )}
                                {run.trigger_data && (
                                  <div className="text-xs space-y-1 bg-muted/50 p-2 rounded">
                                    {run.trigger_data.title && (
                                      <p className="font-medium truncate">
                                        📰 {run.trigger_data.title}
                                      </p>
                                    )}
                                    {run.trigger_data.link && (
                                      <a 
                                        href={run.trigger_data.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Ver fonte original
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma execução registrada</p>
            <p className="text-sm">As execuções aparecerão aqui quando as automações forem disparadas</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}