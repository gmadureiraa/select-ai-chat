import { useEffect, useState } from 'react';
import { Calendar, Rss, Webhook, Sparkles, Send, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  usePlanningAutomations, 
  PlanningAutomation, 
  TriggerType,
  ScheduleConfig,
  RSSConfig,
} from '@/hooks/usePlanningAutomations';
import { useClients } from '@/hooks/useClients';
import { usePlanningItems } from '@/hooks/usePlanningItems';
import { supabase } from '@/integrations/supabase/client';

interface AutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: PlanningAutomation | null;
}

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'newsletter', label: 'Newsletter' },
];

const CONTENT_TYPES = [
  { value: 'social_post', label: 'Post Social' },
  { value: 'carousel', label: 'Carrossel' },
  { value: 'reels', label: 'Reels/Vídeo Curto' },
  { value: 'stories', label: 'Stories' },
  { value: 'thread', label: 'Thread' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'blog', label: 'Blog Post' },
];

interface FeedTestResult {
  success: boolean;
  feedTitle?: string;
  itemCount?: number;
  latestItem?: { title: string; pubDate?: string };
  error?: string;
}

export function AutomationDialog({ open, onOpenChange, automation }: AutomationDialogProps) {
  const { createAutomation, updateAutomation } = usePlanningAutomations();
  const { clients } = useClients();
  const { columns } = usePlanningItems();
  
  const isEditing = !!automation;

  // Form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('schedule');
  const [clientId, setClientId] = useState<string>('');
  const [columnId, setColumnId] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [contentType, setContentType] = useState('social_post');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState('');

  // Schedule config
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1]); // Monday by default
  const [scheduleTime, setScheduleTime] = useState('10:00');

  // RSS config
  const [rssUrl, setRssUrl] = useState('');
  const [testingFeed, setTestingFeed] = useState(false);
  const [feedTestResult, setFeedTestResult] = useState<FeedTestResult | null>(null);

  // Auto publish
  const [autoPublish, setAutoPublish] = useState(false);

  // Reset form when dialog opens/closes or automation changes
  useEffect(() => {
    if (open && automation) {
      setName(automation.name);
      setTriggerType(automation.trigger_type);
      setClientId(automation.client_id || '');
      setColumnId(automation.target_column_id || '');
      setPlatform(automation.platform || '');
      setContentType(automation.content_type || 'social_post');
      setAutoGenerate(automation.auto_generate_content);
      setPromptTemplate(automation.prompt_template || '');

      setAutoPublish((automation as any).auto_publish || false);

      if (automation.trigger_type === 'schedule') {
        const config = automation.trigger_config as ScheduleConfig;
        setScheduleType(config.type || 'weekly');
        setScheduleDays(config.days || [1]);
        setScheduleTime(config.time || '10:00');
      } else if (automation.trigger_type === 'rss') {
        const config = automation.trigger_config as RSSConfig;
        setRssUrl(config.url || '');
      }
      
      // Reset test result when editing
      setFeedTestResult(null);
    } else if (open) {
      // Reset to defaults for new automation
      setName('');
      setTriggerType('schedule');
      setClientId('');
      setColumnId('');
      setPlatform('');
      setContentType('social_post');
      setAutoGenerate(false);
      setPromptTemplate('');
      setScheduleType('weekly');
      setScheduleDays([1]);
      setScheduleTime('10:00');
      setRssUrl('');
      setAutoPublish(false);
      setFeedTestResult(null);
    }
  }, [open, automation]);

  const handleDayToggle = (day: number) => {
    setScheduleDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleTestFeed = async () => {
    if (!rssUrl.trim()) return;
    
    setTestingFeed(true);
    setFeedTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-rss-feed', {
        body: { rssUrl, limit: 5 }
      });
      
      if (error) throw error;
      
      if (data.success && data.items?.length > 0) {
        setFeedTestResult({
          success: true,
          feedTitle: data.feedTitle || 'Feed RSS',
          itemCount: data.totalItems || data.items.length,
          latestItem: {
            title: data.items[0].title,
            pubDate: data.items[0].pubDate,
          },
        });
      } else {
        setFeedTestResult({
          success: false,
          error: data.error || 'Nenhum item encontrado no feed',
        });
      }
    } catch (err) {
      setFeedTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erro ao testar feed',
      });
    } finally {
      setTestingFeed(false);
    }
  };

  const handleSubmit = () => {
    let triggerConfig;
    
    switch (triggerType) {
      case 'schedule':
        triggerConfig = {
          type: scheduleType,
          days: scheduleDays,
          time: scheduleTime,
        };
        break;
      case 'rss':
        triggerConfig = {
          url: rssUrl,
        };
        break;
      case 'webhook':
        triggerConfig = {
          secret: crypto.randomUUID().slice(0, 8),
        };
        break;
    }

    const data = {
      name,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      client_id: clientId || null,
      target_column_id: columnId || null,
      platform: platform || null,
      content_type: contentType,
      auto_generate_content: autoGenerate,
      prompt_template: autoGenerate ? promptTemplate : null,
      auto_publish: autoPublish,
    };

    if (isEditing && automation) {
      updateAutomation.mutate({ id: automation.id, ...data });
    } else {
      createAutomation.mutate(data);
    }

    onOpenChange(false);
  };

  const isValid = name.trim() && (
    (triggerType === 'schedule' && scheduleDays.length > 0) ||
    (triggerType === 'rss' && rssUrl.trim()) ||
    triggerType === 'webhook'
  );

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'hoje';
      if (diffDays === 1) return 'há 1 dia';
      if (diffDays < 7) return `há ${diffDays} dias`;
      if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semana(s)`;
      return `há ${Math.floor(diffDays / 30)} mês(es)`;
    } catch {
      return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Automação' : 'Nova Automação'}
          </DialogTitle>
          <DialogDescription>
            Configure quando e como criar cards de planejamento automaticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome da automação</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Dica semanal de produtividade"
            />
          </div>

          {/* Tipo de gatilho */}
          <div className="space-y-2">
            <Label>Gatilho</Label>
            <Tabs value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="schedule" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Agendamento
                </TabsTrigger>
                <TabsTrigger value="rss" className="flex items-center gap-2">
                  <Rss className="h-4 w-4" />
                  RSS Feed
                </TabsTrigger>
                <TabsTrigger value="webhook" className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Webhook
                </TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as 'daily' | 'weekly' | 'monthly')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scheduleType === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Dias da semana</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={scheduleDays.includes(day.value)}
                            onCheckedChange={() => handleDayToggle(day.value)}
                          />
                          <label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {scheduleType === 'monthly' && (
                  <div className="space-y-2">
                    <Label>Dias do mês (separados por vírgula)</Label>
                    <Input
                      value={scheduleDays.join(', ')}
                      onChange={(e) => {
                        const days = e.target.value
                          .split(',')
                          .map(d => parseInt(d.trim()))
                          .filter(d => !isNaN(d) && d >= 1 && d <= 31);
                        setScheduleDays(days);
                      }}
                      placeholder="1, 15"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="rss" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>URL do RSS Feed</Label>
                  <div className="flex gap-2">
                    <Input
                      value={rssUrl}
                      onChange={(e) => {
                        setRssUrl(e.target.value);
                        setFeedTestResult(null);
                      }}
                      placeholder="https://exemplo.com/feed.xml"
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleTestFeed}
                      disabled={!rssUrl.trim() || testingFeed}
                    >
                      {testingFeed ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Testar Feed'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Um novo card será criado quando um item aparecer no feed
                  </p>
                  
                  {/* Feed test result */}
                  {feedTestResult && (
                    <div className={`p-3 rounded-lg text-sm ${
                      feedTestResult.success 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                      {feedTestResult.success ? (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-green-700 dark:text-green-400">
                              Feed válido: {feedTestResult.itemCount} itens encontrados
                            </p>
                            {feedTestResult.latestItem && (
                              <p className="text-green-600 dark:text-green-500 mt-1">
                                Último: "{feedTestResult.latestItem.title}" 
                                {feedTestResult.latestItem.pubDate && (
                                  <span className="text-muted-foreground"> ({formatRelativeTime(feedTestResult.latestItem.pubDate)})</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <p className="text-red-700 dark:text-red-400">
                            {feedTestResult.error}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="webhook" className="space-y-4 mt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Um webhook será gerado após salvar. Use-o para criar cards a partir de 
                    ferramentas externas como Zapier, Make ou outras integrações.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Cliente e Coluna */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={clientId || "all"} onValueChange={(v) => setClientId(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os perfis</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Coluna de destino</Label>
              <Select value={columnId || "default"} onValueChange={(v) => setColumnId(v === "default" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Coluna padrão</SelectItem>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Plataforma e Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platform || "none"} onValueChange={(v) => setPlatform(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Geração automática de conteúdo */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <Label className="text-base">Gerar conteúdo automaticamente</Label>
                  <p className="text-sm text-muted-foreground">
                    Use IA para criar o conteúdo ao criar o card
                  </p>
                </div>
              </div>
              <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
            </div>

            {autoGenerate && (
              <div className="space-y-2">
                <Label>Prompt template</Label>
                <Textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  placeholder="Ex: Crie uma dica sobre {{title}} focando em produtividade..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{title}}"} e {"{{description}}"} para incluir dados do gatilho
                </p>
              </div>
            )}
          </div>

          {/* Publicação automática */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-green-500" />
                <div>
                  <Label className="text-base">Publicar automaticamente</Label>
                  <p className="text-sm text-muted-foreground">
                    Publica direto na plataforma após a IA gerar
                  </p>
                </div>
              </div>
              <Switch 
                checked={autoPublish} 
                onCheckedChange={setAutoPublish}
                disabled={!autoGenerate || !platform || !clientId}
              />
            </div>

            {autoPublish && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Requer conta conectada (Late API) para a plataforma selecionada.
                  Certifique-se de que as credenciais estão configuradas no perfil.
                </p>
              </div>
            )}

            {(!autoGenerate || !platform || !clientId) && (
              <p className="text-xs text-muted-foreground">
                {!autoGenerate && "Ative a geração de conteúdo para habilitar. "}
                {!platform && "Selecione uma plataforma. "}
                {!clientId && "Selecione um perfil."}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {isEditing ? 'Salvar' : 'Criar Automação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
