import { useState, useMemo } from 'react';
import { Plus, Zap, Calendar, Rss, Webhook, MoreVertical, Pause, Play, Trash2, Pencil, TestTube2, History, Loader2, Filter, Users, Twitter, Linkedin, Instagram, Youtube, Facebook, AtSign, Video, Mail, FileText, Globe, Sparkles, ListChecks, Brain, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { apiInvoke } from '../../lib/apiInvoke';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePlanningAutomations, PlanningAutomation, ScheduleConfig, RSSConfig } from '@/hooks/usePlanningAutomations';
import { useAiWorkflows, AiWorkflow, describeCron, estimateNextRun } from '@/hooks/useAiWorkflows';
import { useAiWorkflowRuns, useLatestRunsByWorkflow, AiWorkflowRun } from '@/hooks/useAiWorkflowRuns';
import { useClients } from '@/hooks/useClients';
import { AutomationDialog } from '@/components/planning/AutomationDialog';
import { AutomationHistoryDialog } from './AutomationHistoryDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { PLATFORM_COLOR_MAP, ALL_PUBLISH_PLATFORMS } from '@/types/contentTypes';
import { TabHeader } from '@/components/kai/TabHeader';

const platformLucideIcons: Record<string, React.ElementType> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  threads: AtSign,
  tiktok: Video,
  youtube: Youtube,
  facebook: Facebook,
  newsletter: Mail,
  blog: FileText,
};

/** Strip redundant platform prefixes from automation names */
function cleanAutomationName(name: string): string {
  return name.replace(/^(LinkedIn|Twitter|Thread Twitter|Instagram|Threads|YouTube|Facebook|TikTok|Tweet|Newsletter|Blog)\s*[—–-]\s*/i, '').trim();
}

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
  const { workflows, agents, isLoading: workflowsLoading, toggleWorkflow } = useAiWorkflows();
  const workflowIds = useMemo(() => workflows.map(w => w.id), [workflows]);
  const { data: latestRunsByWorkflow = {} } = useLatestRunsByWorkflow(workflowIds);
  const { clients } = useClients();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<PlanningAutomation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');
  const [workflowRunsId, setWorkflowRunsId] = useState<string | null>(null);

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
    if (testingId) return;
    
    setTestingId(automation.id);
    toast.info(`Executando "${automation.name}"...`, { duration: 3000 });
    
    try {
      const { data, error } = await apiInvoke('process-automations', {
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

  // Filter automations
  const filteredAutomations = useMemo(() => {
    return automations.filter(a => {
      if (clientFilter !== 'all' && a.client_id !== clientFilter) return false;
      if (triggerFilter !== 'all' && a.trigger_type !== triggerFilter) return false;
      return true;
    });
  }, [automations, clientFilter, triggerFilter]);

  // Group by client with sorting: active first, then by last_triggered_at
  const groupedByClient = useMemo(() => {
    const sortAutomations = (list: PlanningAutomation[]) => {
      return [...list].sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });
    };
    const groups: Record<string, PlanningAutomation[]> = {};
    for (const a of filteredAutomations) {
      const key = a.client_id || '__none__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    // Sort within each group
    for (const key of Object.keys(groups)) {
      groups[key] = sortAutomations(groups[key]);
    }
    return groups;
  }, [filteredAutomations]);

  // Unique clients that have automations
  const clientsWithAutomations = useMemo(() => {
    const ids = new Set(automations.map(a => a.client_id).filter(Boolean));
    return clients.filter(c => ids.has(c.id));
  }, [automations, clients]);

  const activeCount = filteredAutomations.filter(a => a.is_active).length;
  const pausedCount = filteredAutomations.filter(a => !a.is_active).length;
  const rssCount = filteredAutomations.filter(a => a.trigger_type === 'rss').length;
  const scheduleCount = filteredAutomations.filter(a => a.trigger_type === 'schedule').length;

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Carregando automações"
        className="p-4 md:p-6 h-full overflow-auto space-y-6"
      >
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        {/* Filters skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[180px]" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        {/* List skeleton */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <span className="sr-only">Carregando automações…</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full overflow-auto space-y-4">
      <TabHeader
        icon={Zap}
        title="Automações"
        description="Configure fluxos automáticos: RSS → IA → Publicação."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="h-9">
              <History className="h-4 w-4 mr-2" />
              Histórico
            </Button>
            <Button size="sm" onClick={handleCreate} className="h-9">
              <Plus className="h-4 w-4 mr-2" />
              Nova automação
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientsWithAutomations.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Tipo de trigger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="schedule">Agendamento</SelectItem>
            <SelectItem value="rss">RSS Feed</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
        {(clientFilter !== 'all' || triggerFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setClientFilter('all'); setTriggerFilter('all'); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{filteredAutomations.length}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{activeCount}</div>
            <p className="text-sm text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500">{scheduleCount}</div>
            <p className="text-sm text-muted-foreground">Agendadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">{rssCount}</div>
            <p className="text-sm text-muted-foreground">RSS</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped by Client */}
      {Object.entries(groupedByClient).map(([clientId, clientAutomations]) => {
        const clientName = clientId === '__none__' ? 'Sem cliente' : getClientName(clientId);
        const client = clients.find(c => c.id === clientId);
        const activeInGroup = clientAutomations.filter(a => a.is_active);
        const pausedInGroup = clientAutomations.filter(a => !a.is_active);

        return (
          <Card key={clientId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {client?.avatar_url ? (
                    <img src={client.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <Users className="h-5 w-5 text-muted-foreground" />
                  )}
                  {clientName}
                  <Badge variant="secondary" className="text-xs ml-1">
                    {clientAutomations.length} automação{clientAutomations.length !== 1 ? 'ões' : ''}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {activeInGroup.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {activeInGroup.length} ativa{activeInGroup.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pausedInGroup.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                      {pausedInGroup.length} pausada{pausedInGroup.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {clientAutomations.map((automation) => (
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
                  showClient={false}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Empty State */}
      {filteredAutomations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              {automations.length === 0 ? 'Nenhuma automação configurada' : 'Nenhuma automação encontrada'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {automations.length === 0
                ? 'Crie sua primeira automação para gerar conteúdo automaticamente'
                : 'Tente ajustar os filtros'}
            </p>
            {automations.length === 0 && (
              <Button onClick={handleCreate} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Criar primeira automação
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Workflows AI (read-only por enquanto: madureira-redes etc) ─── */}
      <AiWorkflowsSection
        workflows={workflows}
        agents={agents}
        isLoading={workflowsLoading}
        latestRunsByWorkflow={latestRunsByWorkflow}
        onToggle={(id, is_active) => toggleWorkflow.mutate({ id, is_active })}
        onViewRuns={(id) => setWorkflowRunsId(id)}
      />

      {/* Modal de runs de um workflow */}
      <AiWorkflowRunsDialog
        workflowId={workflowRunsId}
        workflow={workflows.find(w => w.id === workflowRunsId) ?? null}
        open={!!workflowRunsId}
        onOpenChange={(open) => { if (!open) setWorkflowRunsId(null); }}
      />

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
  showClient?: boolean;
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
  showClient = true,
}: AutomationCardProps) {
  const TriggerIcon = triggerIcons[automation.trigger_type];
  const contentLabel = contentTypeLabels[automation.content_type] || automation.content_type;
  const displayName = cleanAutomationName(automation.name);

  // Collect all platforms to display
  const allPlatforms: string[] = automation.platforms?.length
    ? automation.platforms
    : automation.platform
      ? [automation.platform]
      : [];

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 border rounded-lg transition-colors",
        automation.is_active ? "hover:bg-muted/50" : "opacity-60 bg-muted/20"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "p-2 rounded-lg shrink-0",
          automation.is_active ? "bg-primary/10" : "bg-muted"
        )}>
          <TriggerIcon className={cn(
            "h-4 w-4",
            automation.is_active ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm truncate">{displayName}</h4>
            <Badge variant="outline" className="text-xs shrink-0">
              {contentLabel}
            </Badge>
            {/* Platform icons with brand colors */}
            {allPlatforms.map((p) => {
              const PIcon = platformLucideIcons[p] || Globe;
              const brandColor = PLATFORM_COLOR_MAP[p];
              return (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium shrink-0"
                  style={{
                    backgroundColor: brandColor ? `color-mix(in srgb, ${brandColor} 15%, transparent)` : undefined,
                    color: brandColor || undefined,
                    border: `1px solid color-mix(in srgb, ${brandColor || 'currentColor'} 30%, transparent)`,
                  }}
                >
                  <PIcon className="h-3 w-3" />
                  {ALL_PUBLISH_PLATFORMS.find(pp => pp.value === p)?.label || p}
                </span>
              );
            })}
            {automation.auto_generate_content && (
              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30 shrink-0">IA</Badge>
            )}
            {automation.auto_publish && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30 shrink-0">
                Auto-publish
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{triggerLabels[automation.trigger_type]}: {getTriggerDescription(automation)}</span>
            {showClient && (
              <>
                <span>•</span>
                <span>{getClientName(automation.client_id)}</span>
              </>
            )}
          </div>
          {automation.last_triggered_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Última: {formatDistanceToNow(new Date(automation.last_triggered_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
              {automation.items_created > 0 && ` • ${automation.items_created} cards`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={automation.is_active}
          onCheckedChange={(checked) => onToggle(automation.id, checked)}
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações">
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
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

// ────────────────────────────────────────────────────────────────────────
// AI Workflows section — read-only por enquanto (toggle is_active e ver runs).
// Mostra seedados Madureira (10 workflows). Plano futuro: criar/editar via UI.
// ────────────────────────────────────────────────────────────────────────

type WorkflowHealth = 'healthy' | 'stale' | 'paused';

function getWorkflowHealth(
  workflow: AiWorkflow,
  lastRun: AiWorkflowRun | undefined,
): { state: WorkflowHealth; label: string; description: string } {
  if (!workflow.is_active) {
    return { state: 'paused', label: 'Pausado', description: 'Workflow desativado, não roda no cron.' };
  }

  if (!lastRun) {
    return {
      state: 'stale',
      label: 'Sem execuções',
      description: 'Workflow ativo mas ainda nunca rodou. Espere o próximo cron ou teste manualmente.',
    };
  }

  const startedAt = new Date(lastRun.started_at).getTime();
  const ageHours = (Date.now() - startedAt) / (1000 * 60 * 60);

  const success = lastRun.status === 'success' || lastRun.status === 'partial';
  if (success && ageHours < 24) {
    return { state: 'healthy', label: 'OK', description: `Última execução com sucesso há ${formatHours(ageHours)}.` };
  }

  if (!success) {
    return {
      state: 'stale',
      label: 'Erro na última run',
      description: `Última run terminou em '${lastRun.status}'. Confira detalhes.`,
    };
  }

  return {
    state: 'stale',
    label: 'Sem run recente',
    description: `Última execução há ${formatHours(ageHours)}.`,
  };
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

const HEALTH_STYLES: Record<WorkflowHealth, { dot: string; bg: string; text: string }> = {
  healthy: { dot: 'bg-green-500', bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-600' },
  stale: { dot: 'bg-amber-500', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-600' },
  paused: { dot: 'bg-muted-foreground/40', bg: 'bg-muted/40 border-muted', text: 'text-muted-foreground' },
};

interface AiWorkflowsSectionProps {
  workflows: AiWorkflow[];
  agents: Array<{ id: string; name: string; model: string | null }>;
  isLoading: boolean;
  latestRunsByWorkflow: Record<string, AiWorkflowRun>;
  onToggle: (id: string, is_active: boolean) => void;
  onViewRuns: (id: string) => void;
}

function AiWorkflowsSection({
  workflows,
  agents,
  isLoading,
  latestRunsByWorkflow,
  onToggle,
  onViewRuns,
}: AiWorkflowsSectionProps) {
  // Hooks ANTES de qualquer return condicional (regra de hooks).
  const grouped = useMemo(() => {
    const out: Record<string, AiWorkflow[]> = {};
    for (const w of workflows) {
      const key = w.agent_id;
      if (!out[key]) out[key] = [];
      out[key].push(w);
    }
    return out;
  }, [workflows]);

  if (isLoading) return null;
  if (workflows.length === 0) return null;

  const healthyCount = workflows.filter((w) => {
    const h = getWorkflowHealth(w, latestRunsByWorkflow[w.id]);
    return h.state === 'healthy';
  }).length;
  const staleCount = workflows.filter((w) => {
    const h = getWorkflowHealth(w, latestRunsByWorkflow[w.id]);
    return h.state === 'stale';
  }).length;
  const pausedCount = workflows.filter((w) => !w.is_active).length;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Workflows AI
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agentes de conteúdo rodando em cron próprio (Madureira, etc). Read-only por enquanto, edição via SQL.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {healthyCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {healthyCount} saudável{healthyCount !== 1 ? 'eis' : ''}
            </span>
          )}
          {staleCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {staleCount} atenção
            </span>
          )}
          {pausedCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              {pausedCount} pausado{pausedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {Object.entries(grouped).map(([agentId, agentWorkflows]) => {
        const agent = agents.find(a => a.id === agentId);
        return (
          <Card key={agentId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  {agent?.name ?? 'Agent desconhecido'}
                  <Badge variant="secondary" className="text-xs">
                    {agentWorkflows.length} workflow{agentWorkflows.length !== 1 ? 's' : ''}
                  </Badge>
                  {agent?.model && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {agent.model}
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {agentWorkflows.map((workflow) => (
                <AiWorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  lastRun={latestRunsByWorkflow[workflow.id]}
                  onToggle={onToggle}
                  onViewRuns={onViewRuns}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface AiWorkflowCardProps {
  workflow: AiWorkflow;
  lastRun: AiWorkflowRun | undefined;
  onToggle: (id: string, is_active: boolean) => void;
  onViewRuns: (id: string) => void;
}

function AiWorkflowCard({ workflow, lastRun, onToggle, onViewRuns }: AiWorkflowCardProps) {
  const health = getWorkflowHealth(workflow, lastRun);
  const styles = HEALTH_STYLES[health.state];
  const cron = describeCron(workflow.schedule_cron);
  const nextRun = workflow.is_active ? estimateNextRun(workflow.schedule_cron) : null;
  const platform = workflow.config?.platform as string | undefined;
  const PIcon = platform ? (platformLucideIcons[platform] || Globe) : null;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 border rounded-lg transition-colors',
        workflow.is_active ? 'hover:bg-muted/50' : 'opacity-60 bg-muted/20',
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Health dot */}
        <div className={cn('flex flex-col items-center gap-1 shrink-0')}>
          <span
            className={cn('h-2.5 w-2.5 rounded-full', styles.dot)}
            title={health.description}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm truncate">{workflow.name}</h4>
            {PIcon && platform && (
              <Badge variant="outline" className="text-xs gap-1 shrink-0">
                <PIcon className="h-3 w-3" />
                {platform}
              </Badge>
            )}
            {workflow.config?.content_type && (
              <Badge variant="outline" className="text-xs shrink-0">
                {String(workflow.config.content_type)}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn('text-xs shrink-0', styles.bg, styles.text)}
            >
              {health.label}
            </Badge>
          </div>

          {workflow.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {workflow.description}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {cron}
            </span>
            {workflow.last_run_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última: {formatDistanceToNow(new Date(workflow.last_run_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
            {nextRun && (
              <span className="flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                Próxima: {formatDistanceToNow(nextRun, { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewRuns(workflow.id)}
          className="h-8"
          title="Ver últimas execuções"
        >
          <History className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Runs</span>
        </Button>
        <Switch
          checked={workflow.is_active}
          onCheckedChange={(checked) => onToggle(workflow.id, checked)}
        />
      </div>
    </div>
  );
}

interface AiWorkflowRunsDialogProps {
  workflowId: string | null;
  workflow: AiWorkflow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AiWorkflowRunsDialog({ workflowId, workflow, open, onOpenChange }: AiWorkflowRunsDialogProps) {
  const { data: runs = [], isLoading } = useAiWorkflowRuns(workflowId, 20);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-500" />
            {workflow?.name ?? 'Execuções do workflow'}
          </DialogTitle>
          <DialogDescription>
            Últimas 20 execuções do cron. Output = planning_items criados, violations = frames proibidos detectados.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando execuções...
          </div>
        )}

        {!isLoading && runs.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p>Nenhuma execução registrada ainda.</p>
          </div>
        )}

        {!isLoading && runs.length > 0 && (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-2">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RunRow({ run }: { run: AiWorkflowRun }) {
  const isSuccess = run.status === 'success' || run.status === 'partial';
  const isFailed = run.status === 'failed' || run.status === 'failed_validation';
  const StatusIcon = isSuccess ? CheckCircle2 : isFailed ? XCircle : Loader2;
  const iconColor = isSuccess ? 'text-green-500' : isFailed ? 'text-red-500' : 'text-amber-500';
  const itemsCreated = Array.isArray(run.output) ? run.output.length : 0;
  const violationsCount = Array.isArray(run.violations) ? run.violations.length : 0;

  return (
    <div className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={cn('h-4 w-4 shrink-0', iconColor, !isSuccess && !isFailed && 'animate-spin')} />
          <Badge variant="outline" className="text-xs">
            {run.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          {run.duration_ms !== null && (
            <span>{run.duration_ms}ms</span>
          )}
          {run.cost_usd !== null && (
            <span className="font-mono">${Number(run.cost_usd).toFixed(4)}</span>
          )}
          {run.attempts > 1 && (
            <span>{run.attempts} tentativas</span>
          )}
        </div>
      </div>

      {/* Itens criados */}
      {itemsCreated > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
          <span className="text-muted-foreground">
            {itemsCreated} planning_item{itemsCreated !== 1 ? 's' : ''} criado{itemsCreated !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Violations */}
      {violationsCount > 0 && (
        <div className="flex items-start gap-2 text-xs p-2 bg-amber-500/10 rounded">
          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-amber-700 dark:text-amber-400 font-medium">
              {violationsCount} violação{violationsCount !== 1 ? 'ões' : ''}
            </p>
            <ul className="text-muted-foreground mt-1 space-y-0.5">
              {run.violations.slice(0, 3).map((v, i) => (
                <li key={i} className="truncate">
                  {v.matched ? `"${v.matched}"` : ''}
                  {v.rule ? ` — ${v.rule}` : ''}
                  {v.message ? ` (${v.message})` : ''}
                </li>
              ))}
              {run.violations.length > 3 && (
                <li className="italic">+ {run.violations.length - 3} mais...</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Error message */}
      {run.error && (
        <div className="flex items-start gap-2 text-xs p-2 bg-red-500/10 rounded">
          <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-700 dark:text-red-400 break-all">
            {run.error}
          </p>
        </div>
      )}
    </div>
  );
}
