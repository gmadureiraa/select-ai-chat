import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Loader2, SkipForward, ExternalLink } from 'lucide-react';
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
  trigger_data: { title?: string; link?: string } | null;
  planning_automations?: {
    name: string;
  };
}

export function AutomationHistoryDialog({ open, onOpenChange }: AutomationHistoryDialogProps) {
  const { workspace } = useWorkspace();

  const { data: runs, isLoading } = useQuery({
    queryKey: ['planning-automation-runs', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const { data, error } = await supabase
        .from('planning_automation_runs')
        .select(`
          *,
          planning_automations (
            name
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
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Execuções</DialogTitle>
          <DialogDescription>
            Últimas 50 execuções de automações de planejamento
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : runs && runs.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className="mt-0.5">
                    {getStatusIcon(run.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">
                        {run.planning_automations?.name || 'Automação removida'}
                      </span>
                      {getStatusBadge(run.status)}
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>
                        {format(new Date(run.started_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {run.duration_ms && (
                        <span>• {formatDuration(run.duration_ms)}</span>
                      )}
                      {run.items_created > 0 && (
                        <span className="text-green-600">• {run.items_created} item criado</span>
                      )}
                    </div>
                    {run.error && (
                      <p className="text-sm text-red-500 mt-1 truncate">
                        {run.error}
                      </p>
                    )}
                    {run.result && run.status !== 'skipped' && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {run.result}
                      </p>
                    )}
                    {run.trigger_data?.link && (
                      <a 
                        href={run.trigger_data.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver fonte
                      </a>
                    )}
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
