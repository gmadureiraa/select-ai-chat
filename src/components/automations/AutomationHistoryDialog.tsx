import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
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

interface AutomationRun {
  id: string;
  automation_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  result: string | null;
  error: string | null;
  automation?: {
    name: string;
  };
}

export function AutomationHistoryDialog({ open, onOpenChange }: AutomationHistoryDialogProps) {
  const { workspace } = useWorkspace();

  const { data: runs, isLoading } = useQuery({
    queryKey: ['automation-runs', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const { data, error } = await supabase
        .from('automation_runs')
        .select(`
          *,
          automations!automation_runs_automation_id_fkey (
            name
          )
        `)
        .order('started_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      return (data || []).map(run => ({
        ...run,
        automation: run.automations,
      })) as AutomationRun[];
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
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Execuções</DialogTitle>
          <DialogDescription>
            Últimas 50 execuções de automações
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
                        {run.automation?.name || 'Automação removida'}
                      </span>
                      {getStatusBadge(run.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(run.started_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      {run.duration_ms && (
                        <span className="ml-2">• {run.duration_ms}ms</span>
                      )}
                    </div>
                    {run.error && (
                      <p className="text-sm text-red-500 mt-1 truncate">
                        {run.error}
                      </p>
                    )}
                    {run.result && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {run.result}
                      </p>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
