import { useState } from 'react';
import { Plus, Zap, Calendar, Rss, Webhook, MoreVertical, Pause, Play, Trash2, Pencil, TestTube2, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { AutomationDialog } from '@/components/planning/AutomationDialog';
import { AutomationHistoryDialog } from './AutomationHistoryDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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

const contentTypeLabels: Record<string, string> = {
  'tweet': 'Tweet',
  'thread': 'Thread',
  'x_article': 'Artigo X',
  'linkedin_post': 'LinkedIn',
  'carousel': 'Carrossel',
  'stories': 'Stories',
  'instagram_post': 'Instagram',
  'static_image': 'Imagem',
  'short_video': 'Reels',
  'long_video': 'Vídeo',
  'newsletter': 'Newsletter',
  'blog_post': 'Blog',
  'social_post': 'Post',
};

export function AutomationsTab() {
  const { automations, isLoading, toggleAutomation, deleteAutomation, triggerAutomation } = usePlanningAutomations();
  const { clients } = useClients();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<PlanningAutomation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

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

  const handleTest = async (automation: PlanningAutomation) => {
    if (testingId) return; // Already testing
    
    setTestingId(automation.id);
    toast.info(`Executando "${automation.name}"...`, { duration: 3000 });
    
    try {
      const { data, error } = await supabase.functions.invoke('process-automations', {
        body: { automationId: automation.id }
      });

      if (error) throw error;

      if (data.triggered > 0) {
        toast.success(`Automação executada! Card criado no planejamento.`, { duration: 5000 });
      } else {
        toast.info(`Automação executada, mas nenhum card foi criado.`, { duration: 4000 });
      }
    } catch (err) {
      console.error('Error testing automation:', err);
      toast.error('Erro ao executar automação. Verifique os logs.');
    } finally {
      setTestingId(null);
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Todos os perfis';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Perfil desconhecido';
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

  const activeAutomations = automations.filter(a => a.is_active);
  const pausedAutomations = automations.filter(a => !a.is_active);

  if (isLoading) {
    return (
      <div className="p-6 h-full overflow-auto">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Carregando automações...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Automações
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure fluxos automáticos: RSS → IA → Publicação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            Histórico
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Automação
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{automations.length}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{activeAutomations.length}</div>
            <p className="text-sm text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-muted-foreground">{pausedAutomations.length}</div>
            <p className="text-sm text-muted-foreground">Pausadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Automations */}
      {activeAutomations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              Automações Ativas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAutomations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteId(id)}
                onToggle={(id, active) => toggleAutomation.mutate({ id, is_active: active })}
                onTest={handleTest}
                getClientName={getClientName}
                getTriggerDescription={getTriggerDescription}
                isTesting={testingId === automation.id}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paused Automations */}
      {pausedAutomations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
              <Pause className="h-4 w-4" />
              Automações Pausadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pausedAutomations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteId(id)}
                onToggle={(id, active) => toggleAutomation.mutate({ id, is_active: active })}
                onTest={handleTest}
                getClientName={getClientName}
                getTriggerDescription={getTriggerDescription}
                isTesting={testingId === automation.id}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {automations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Nenhuma automação configurada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira automação para gerar conteúdo automaticamente
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Automação
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <AutomationDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        automation={editingAutomation}
      />

      <AutomationHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
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
    </div>
  );
}

interface AutomationCardProps {
  automation: PlanningAutomation;
  onEdit: (automation: PlanningAutomation) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onTest: (automation: PlanningAutomation) => void;
  getClientName: (clientId: string | null) => string;
  getTriggerDescription: (automation: PlanningAutomation) => string;
  isTesting?: boolean;
}

function AutomationCard({
  automation,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  getClientName,
  getTriggerDescription,
  isTesting,
}: AutomationCardProps) {
  const TriggerIcon = triggerIcons[automation.trigger_type];
  const contentLabel = contentTypeLabels[automation.content_type] || automation.content_type;
  
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 border rounded-lg transition-colors",
        automation.is_active ? "hover:bg-muted/50" : "opacity-60 bg-muted/20"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "p-2.5 rounded-lg",
          automation.is_active ? "bg-primary/10" : "bg-muted"
        )}>
          <TriggerIcon className={cn(
            "h-5 w-5",
            automation.is_active ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{automation.name}</h4>
            <Badge variant={automation.is_active ? 'default' : 'secondary'}>
              {automation.is_active ? 'Ativa' : 'Pausada'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {contentLabel}
            </Badge>
            {automation.auto_generate_content && (
              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">IA</Badge>
            )}
            {(automation as any).auto_publish && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                Auto-publish
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{triggerLabels[automation.trigger_type]}: {getTriggerDescription(automation)}</span>
            <span>•</span>
            <span>{getClientName(automation.client_id)}</span>
            {automation.platform && (
              <>
                <span>•</span>
                <span className="capitalize">{automation.platform}</span>
              </>
            )}
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
          onCheckedChange={(checked) => onToggle(automation.id, checked)}
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onTest(automation)} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube2 className="h-4 w-4 mr-2" />
              )}
              {isTesting ? 'Executando...' : 'Testar Agora'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(automation)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onToggle(automation.id, !automation.is_active)}
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
              onClick={() => onDelete(automation.id)}
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
}
