import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Loader2, SkipForward, ExternalLink, Image, Zap, AlertTriangle, Eye, ChevronRight, Filter } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AutomationRunDetailDialog } from './AutomationRunDetailDialog';

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
  trigger_data: { 
    title?: string; 
    link?: string; 
    images_count?: number;
    published?: boolean;
    external_post_id?: string;
    publish_error?: string;
    item_id?: string;
  } | null;
  planning_automations?: {
    id: string;
    name: string;
    content_type?: string;
    platform?: string;
  };
}

export function AutomationHistoryDialog({ open, onOpenChange }: AutomationHistoryDialogProps) {
  const { workspace } = useWorkspace();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [automationFilter, setAutomationFilter] = useState<string>('all');

  const { data: runs, isLoading } = useQuery({
    queryKey: ['planning-automation-runs', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const { data, error } = await supabase
        .from('planning_automation_runs')
        .select(`
          *,
          planning_automations (
            id,
            name,
            content_type,
            platform
          )
        `)
        .eq('workspace_id', workspace.id)
        .order('started_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      return (data || []) as PlanningAutomationRun[];
    },
    enabled: !!workspace?.id && open,
  });

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
      'social_post': 'Post',
    };
    return contentType ? labels[contentType] || contentType : null;
  };

  // Get unique automation names for filter
  const automationOptions = runs
    ? Array.from(new Set(runs.map(r => r.planning_automations?.name).filter(Boolean)))
    : [];

  // Filter runs
  const filteredRuns = runs?.filter(run => {
    if (statusFilter !== 'all' && run.status !== statusFilter) return false;
    if (automationFilter !== 'all' && run.planning_automations?.name !== automationFilter) return false;
    return true;
  }) || [];

  // Group runs by date
  const groupedRuns = filteredRuns.reduce((acc, run) => {
    const date = format(new Date(run.started_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(run);
    return acc;
  }, {} as Record<string, PlanningAutomationRun[]>);

  const stats = {
    total: runs?.length || 0,
    completed: runs?.filter(r => r.status === 'completed').length || 0,
    failed: runs?.filter(r => r.status === 'failed').length || 0,
    skipped: runs?.filter(r => r.status === 'skipped').length || 0,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Histórico de Execuções
            </DialogTitle>
            <DialogDescription>
              Últimas 100 execuções • Clique para ver detalhes
            </DialogDescription>
          </DialogHeader>

          {/* Stats summary */}
          {runs && runs.length > 0 && (
            <div className="flex items-center justify-between border-b pb-3 mb-2">
              <div className="flex gap-4 text-sm">
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

              {/* Filters */}
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="completed">Sucesso</SelectItem>
                    <SelectItem value="failed">Erro</SelectItem>
                    <SelectItem value="skipped">Pulado</SelectItem>
                  </SelectContent>
                </Select>
                
                {automationOptions.length > 1 && (
                  <Select value={automationFilter} onValueChange={setAutomationFilter}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue placeholder="Automação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {automationOptions.map(name => (
                        <SelectItem key={name} value={name!}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRuns.length > 0 ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {Object.entries(groupedRuns).map(([date, dateRuns]) => (
                  <div key={date}>
                    <div className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1 z-10">
                      {format(new Date(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </div>
                    <div className="space-y-1.5">
                      {dateRuns.map((run) => (
                        <button
                          key={run.id}
                          onClick={() => setSelectedRunId(run.id)}
                          className={cn(
                            "w-full text-left border rounded-lg p-3 transition-all hover:bg-muted/50 hover:border-primary/30 group",
                            run.status === 'failed' && "border-red-500/30 bg-red-500/5",
                            run.status === 'completed' && "border-green-500/20"
                          )}
                        >
                          <div className="flex items-start gap-3">
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

                              {/* Quick preview of error or title */}
                              {run.error && (
                                <p className="text-xs text-red-500 truncate mt-1">
                                  {run.error}
                                </p>
                              )}
                              {run.trigger_data?.title && !run.error && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  📰 {run.trigger_data.title}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-muted-foreground">Ver detalhes</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : runs && runs.length > 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma execução encontrada com os filtros selecionados</p>
              <Button 
                variant="link" 
                onClick={() => { setStatusFilter('all'); setAutomationFilter('all'); }}
                className="mt-2"
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma execução registrada</p>
              <p className="text-sm">As execuções aparecerão aqui quando as automações forem disparadas</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <AutomationRunDetailDialog
        open={!!selectedRunId}
        onOpenChange={(open) => !open && setSelectedRunId(null)}
        runId={selectedRunId}
      />
    </>
  );
}