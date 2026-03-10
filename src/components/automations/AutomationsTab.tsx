import { useState, useMemo } from 'react';
import { Plus, Zap, Calendar, Rss, Webhook, MoreVertical, Pause, Play, Trash2, Pencil, TestTube2, History, Loader2, Filter, Users, Twitter, Linkedin, Instagram, Youtube, Facebook, AtSign, Video, Mail, FileText, Globe } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePlanningAutomations, PlanningAutomation, ScheduleConfig, RSSConfig } from '@/hooks/usePlanningAutomations';
import { useClients } from '@/hooks/useClients';
import { AutomationDialog } from '@/components/planning/AutomationDialog';
import { AutomationHistoryDialog } from './AutomationHistoryDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { PLATFORM_COLOR_MAP, ALL_PUBLISH_PLATFORMS } from '@/types/contentTypes';

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
  const { clients } = useClients();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<PlanningAutomation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');

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
        const aTime = a.last_triggered_at ? new Date(a.last_triggered_at).getTime() : 0;
        const bTime = b.last_triggered_at ? new Date(b.last_triggered_at).getTime() : 0;
        return bTime - aTime;
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
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Automação
              </Button>
            )}
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
            <Button variant="ghost" size="icon" className="h-8 w-8">
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
