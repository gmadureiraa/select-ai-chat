import { useState } from 'react';
import { Plus, Zap, Calendar, Rss, Webhook, MoreVertical, Pause, Play, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePlanningAutomations, PlanningAutomation, ScheduleConfig, RSSConfig } from '@/hooks/usePlanningAutomations';
import { useClients } from '@/hooks/useClients';
import { AutomationDialog } from './AutomationDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const triggerIcons = {
  schedule: Calendar,
  rss: Rss,
  webhook: Webhook,
};

const triggerLabels = {
  schedule: 'Agendamento',
  rss: 'RSS Feed',
  webhook: 'Webhook',
};

export function PlanningAutomations() {
  const { automations, isLoading, toggleAutomation, deleteAutomation } = usePlanningAutomations();
  const { clients } = useClients();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<PlanningAutomation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (automation: PlanningAutomation) => {
    setEditingAutomation(automation);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingAutomation(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteAutomation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Todos os clientes';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente desconhecido';
  };

  const getScheduleDescription = (config: ScheduleConfig) => {
    const type = config.type;
    const time = config.time || '00:00';
    const days = config.days || [];
    
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    switch (type) {
      case 'daily':
        return `Diário às ${time}`;
      case 'weekly':
        const selectedDays = days.map(d => dayNames[d]).join(', ');
        return `Semanal (${selectedDays}) às ${time}`;
      case 'monthly':
        return `Mensal (dias ${days.join(', ')}) às ${time}`;
      default:
        return 'Configuração inválida';
    }
  };

  const getTriggerDescription = (automation: PlanningAutomation) => {
    switch (automation.trigger_type) {
      case 'schedule':
        return getScheduleDescription(automation.trigger_config as ScheduleConfig);
      case 'rss':
        const rssConfig = automation.trigger_config as RSSConfig;
        try {
          const url = new URL(rssConfig.url || '');
          return url.hostname;
        } catch {
          return rssConfig.url || 'URL inválida';
        }
      case 'webhook':
        return 'Aguardando chamada externa';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando automações...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Automações de Planejamento
            </CardTitle>
            <CardDescription>
              Crie cards automaticamente com base em gatilhos
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Automação
          </Button>
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma automação configurada</p>
              <p className="text-sm mt-1">Crie sua primeira automação para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map((automation) => {
                const TriggerIcon = triggerIcons[automation.trigger_type];
                
                return (
                  <div
                    key={automation.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${automation.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                        <TriggerIcon className={`h-5 w-5 ${automation.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{automation.name}</h4>
                          <Badge variant={automation.is_active ? 'default' : 'secondary'}>
                            {automation.is_active ? 'Ativa' : 'Pausada'}
                          </Badge>
                          {automation.auto_generate_content && (
                            <Badge variant="outline" className="text-xs">
                              IA
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{triggerLabels[automation.trigger_type]}: {getTriggerDescription(automation)}</span>
                          <span>•</span>
                          <span>{getClientName(automation.client_id)}</span>
                        </div>
                        {automation.last_triggered_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Última execução: {formatDistanceToNow(new Date(automation.last_triggered_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                            {automation.items_created > 0 && ` • ${automation.items_created} cards criados`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={(checked) => 
                          toggleAutomation.mutate({ id: automation.id, is_active: checked })
                        }
                      />
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(automation)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => toggleAutomation.mutate({ 
                              id: automation.id, 
                              is_active: !automation.is_active 
                            })}
                          >
                            {automation.is_active ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteId(automation.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AutomationDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        automation={editingAutomation}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A automação será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
