import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  ExternalLink, 
  Image, 
  FileText, 
  Calendar,
  User,
  Tag,
  Zap,
  AlertTriangle,
  Copy,
  Twitter,
  Linkedin,
  Instagram,
  Globe,
  ArrowRight,
  Sparkles,
  Eye
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AutomationRunDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string | null;
}

interface PlanningItem {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  platform: string | null;
  content_type: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  error_message: string | null;
  media_urls: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  clients?: { name: string } | null;
  kanban_columns?: { name: string } | null;
}

interface AutomationRunDetail {
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
    generated_content?: string;
    generated_image?: string;
    source_content?: string;
    item_id?: string;
  } | null;
  planning_automations: {
    id: string;
    name: string;
    content_type: string;
    platform: string | null;
    auto_generate_content: boolean;
    auto_generate_image: boolean;
    auto_publish: boolean;
    prompt_template: string | null;
    image_prompt_template: string | null;
    clients?: { name: string } | null;
  } | null;
}

const platformIcons: Record<string, typeof Twitter> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
};

const contentTypeLabels: Record<string, string> = {
  'tweet': 'Tweet',
  'thread': 'Thread',
  'x_article': 'Artigo X',
  'linkedin_post': 'Post LinkedIn',
  'carousel': 'Carrossel',
  'stories': 'Stories',
  'instagram_post': 'Post Instagram',
  'static_image': 'Imagem',
  'short_video': 'Reels',
  'long_video': 'Vídeo',
  'newsletter': 'Newsletter',
  'blog_post': 'Blog',
  'social_post': 'Post Social',
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completed: { label: 'Sucesso', color: 'text-green-600 bg-green-500/10 border-green-500/30', icon: CheckCircle2 },
  failed: { label: 'Erro', color: 'text-red-600 bg-red-500/10 border-red-500/30', icon: XCircle },
  running: { label: 'Executando', color: 'text-blue-600 bg-blue-500/10 border-blue-500/30', icon: Loader2 },
  skipped: { label: 'Pulado', color: 'text-muted-foreground bg-muted border-muted', icon: Clock },
};

export function AutomationRunDetailDialog({ 
  open, 
  onOpenChange, 
  runId 
}: AutomationRunDetailDialogProps) {
  // Fetch run details
  const { data: run, isLoading: isLoadingRun } = useQuery({
    queryKey: ['automation-run-detail', runId],
    queryFn: async () => {
      if (!runId) return null;
      
      const { data, error } = await supabase
        .from('planning_automation_runs')
        .select(`
          *,
          planning_automations (
            id,
            name,
            content_type,
            platform,
            auto_generate_content,
            auto_generate_image,
            auto_publish,
            prompt_template,
            image_prompt_template,
            clients (name)
          )
        `)
        .eq('id', runId)
        .single();
      
      if (error) throw error;
      return data as unknown as AutomationRunDetail;
    },
    enabled: !!runId && open,
  });

  // Fetch created planning item if exists
  const { data: createdItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ['automation-run-item', runId, run?.trigger_data?.item_id],
    queryFn: async () => {
      const itemId = run?.trigger_data?.item_id;
      if (!itemId) return null;
      
      const { data, error } = await supabase
        .from('planning_items')
        .select(`
          *,
          clients (name),
          kanban_columns (name)
        `)
        .eq('id', itemId)
        .single();
      
      if (error) return null;
      return data as unknown as PlanningItem;
    },
    enabled: !!run?.trigger_data?.item_id && open,
  });

  const formatDuration = (ms: number | null) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const getPostUrl = (platform: string | null, externalId: string) => {
    switch (platform) {
      case 'twitter':
        return `https://twitter.com/i/status/${externalId}`;
      case 'linkedin':
        return `https://linkedin.com/feed/update/${externalId}`;
      case 'instagram':
        return `https://instagram.com/p/${externalId}`;
      default:
        return null;
    }
  };

  const isLoading = isLoadingRun || isLoadingItem;
  const status = run ? statusConfig[run.status] || statusConfig.skipped : null;
  const PlatformIcon = run?.planning_automations?.platform 
    ? platformIcons[run.planning_automations.platform] || Globe 
    : Globe;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Detalhes da Execução
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : run ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Header Summary */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg truncate">
                      {run.planning_automations?.name || 'Automação removida'}
                    </h3>
                    {status && (
                      <Badge variant="outline" className={cn("shrink-0", status.color)}>
                        <status.icon className={cn("h-3 w-3 mr-1", run.status === 'running' && "animate-spin")} />
                        {status.label}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(run.started_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </span>
                    {run.duration_ms && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(run.duration_ms)}
                      </span>
                    )}
                    {run.planning_automations?.platform && (
                      <span className="flex items-center gap-1">
                        <PlatformIcon className="h-3.5 w-3.5" />
                        <span className="capitalize">{run.planning_automations.platform}</span>
                      </span>
                    )}
                    {run.planning_automations?.content_type && (
                      <Badge variant="secondary" className="text-xs">
                        {contentTypeLabels[run.planning_automations.content_type] || run.planning_automations.content_type}
                      </Badge>
                    )}
                  </div>

                  {run.planning_automations?.clients?.name && (
                    <div className="flex items-center gap-1 mt-2 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{run.planning_automations.clients.name}</span>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex flex-col items-end gap-2 text-sm">
                  {run.items_created > 0 && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      +{run.items_created} card{run.items_created > 1 ? 's' : ''} criado{run.items_created > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {run.trigger_data?.images_count && run.trigger_data.images_count > 0 && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                      <Image className="h-3 w-3 mr-1" />
                      {run.trigger_data.images_count} imagem{run.trigger_data.images_count > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {run.error && (
                <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-600 mb-1">Erro na Execução</h4>
                      <p className="text-sm text-red-600/80 whitespace-pre-wrap">{run.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Publish Error */}
              {run.trigger_data?.publish_error && (
                <div className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-600 mb-1">Erro na Publicação</h4>
                      <p className="text-sm text-orange-600/80">{run.trigger_data.publish_error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Source Content */}
              {run.trigger_data?.link && (
                <div className="p-4 rounded-lg border bg-muted/30">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    Fonte Original
                  </h4>
                  <div className="space-y-2">
                    {run.trigger_data.title && (
                      <p className="text-sm font-medium">{run.trigger_data.title}</p>
                    )}
                    <a 
                      href={run.trigger_data.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {run.trigger_data.link}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Generated Content Section */}
              {createdItem && (
                <div className="space-y-4">
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Conteúdo Gerado
                    </h4>

                    {/* Item Card */}
                    <div className="p-4 rounded-lg border bg-card space-y-4">
                      {/* Title */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-medium">{createdItem.title}</h5>
                          <Badge variant="outline" className={cn(
                            createdItem.status === 'published' && "bg-green-500/10 text-green-600 border-green-500/30",
                            createdItem.status === 'failed' && "bg-red-500/10 text-red-600 border-red-500/30",
                            createdItem.status === 'scheduled' && "bg-blue-500/10 text-blue-600 border-blue-500/30"
                          )}>
                            {createdItem.status}
                          </Badge>
                        </div>
                        {createdItem.kanban_columns?.name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Coluna: {createdItem.kanban_columns.name}
                          </p>
                        )}
                      </div>

                      {/* Description/Content */}
                      {(createdItem.description || createdItem.content) && (
                        <div className="relative">
                          <div className="p-3 rounded-md bg-muted/50 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {createdItem.content || createdItem.description}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => copyToClipboard(createdItem.content || createdItem.description || '')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {/* Media */}
                      {createdItem.media_urls && createdItem.media_urls.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Image className="h-3 w-3" />
                            {createdItem.media_urls.length} mídia{createdItem.media_urls.length > 1 ? 's' : ''}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {createdItem.media_urls.slice(0, 4).map((url, idx) => (
                              <a 
                                key={idx} 
                                href={url as string} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block w-20 h-20 rounded-md overflow-hidden border hover:ring-2 ring-primary transition-all"
                              >
                                <img 
                                  src={url as string} 
                                  alt={`Mídia ${idx + 1}`} 
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                            {createdItem.media_urls.length > 4 && (
                              <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center text-sm text-muted-foreground">
                                +{createdItem.media_urls.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Published Link */}
                      {createdItem.external_post_id && createdItem.platform && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 font-medium">Publicado com sucesso</span>
                          {getPostUrl(createdItem.platform, createdItem.external_post_id) && (
                            <a
                              href={getPostUrl(createdItem.platform, createdItem.external_post_id)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              Ver publicação
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Error */}
                      {createdItem.error_message && (
                        <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-red-600">{createdItem.error_message}</span>
                        </div>
                      )}

                      {/* Scheduling */}
                      {createdItem.scheduled_at && !createdItem.published_at && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Agendado para {format(new Date(createdItem.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Automation Config Info */}
              {run.planning_automations && (
                <div className="p-4 rounded-lg border bg-muted/20">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Configuração da Automação
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Geração IA:</span>
                      <Badge variant={run.planning_automations.auto_generate_content ? "default" : "secondary"}>
                        {run.planning_automations.auto_generate_content ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Imagem IA:</span>
                      <Badge variant={run.planning_automations.auto_generate_image ? "default" : "secondary"}>
                        {run.planning_automations.auto_generate_image ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Auto-publish:</span>
                      <Badge variant={run.planning_automations.auto_publish ? "default" : "secondary"}>
                        {run.planning_automations.auto_publish ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                  </div>

                  {run.planning_automations.prompt_template && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Prompt de Texto:</p>
                      <p className="text-sm bg-background p-2 rounded border max-h-24 overflow-y-auto">
                        {run.planning_automations.prompt_template}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Result Message */}
              {run.result && run.status !== 'skipped' && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Resultado:</p>
                  <p>{run.result}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Execução não encontrada</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
