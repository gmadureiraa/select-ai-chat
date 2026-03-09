import { useEffect, useState } from 'react';
import { Calendar, Rss, Webhook, Sparkles, Send, AlertCircle, Loader2, CheckCircle2, XCircle, Image, ExternalLink, Copy, ChevronDown, ChevronUp, Palette, Twitter, Linkedin, Instagram, AtSign, Video, Youtube, Facebook, Mail, FileText, Check } from 'lucide-react';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  usePlanningAutomations, 
  PlanningAutomation, 
  TriggerType,
  ScheduleConfig,
  RSSConfig,
  ImageStyle,
} from '@/hooks/usePlanningAutomations';
import { useClients } from '@/hooks/useClients';
import { usePlanningItems } from '@/hooks/usePlanningItems';
import { supabase } from '@/integrations/supabase/client';
import { CONTENT_TYPE_OPTIONS, CONTENT_TO_PLATFORM, ALL_PUBLISH_PLATFORMS } from '@/types/contentTypes';
import { useClientPlatformStatus } from '@/hooks/useClientPlatformStatus';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// Template variables that can be used in prompts
const TEMPLATE_VARIABLES = [
  { key: '{{title}}', description: 'Título do item do RSS' },
  { key: '{{description}}', description: 'Descrição/resumo do item' },
  { key: '{{link}}', description: 'URL do conteúdo original' },
  { key: '{{content}}', description: 'Conteúdo completo (até 3000 chars)' },
  { key: '{{images}}', description: 'Quantidade de imagens detectadas' },
];

// Template variables for image prompts
const IMAGE_TEMPLATE_VARIABLES = [
  { key: '{{title}}', description: 'Título do item' },
  { key: '{{content}}', description: 'Resumo do conteúdo' },
  { key: '{{time_of_day}}', description: 'manhã, tarde ou noite (horário execução)' },
];

// Image style options
const IMAGE_STYLES: { value: ImageStyle; label: string; description: string }[] = [
  { value: 'photographic', label: 'Fotográfico', description: 'Estilo realista, iluminação natural' },
  { value: 'illustration', label: 'Ilustração', description: 'Arte digital, estilo vetorial' },
  { value: 'minimalist', label: 'Minimalista', description: 'Composição clean, muito espaço negativo' },
  { value: 'vibrant', label: 'Vibrante', description: 'Cores intensas, alto contraste' },
];

interface RSSItemPreview {
  title: string;
  description?: string;
  link?: string;
  pubDate?: string;
  imageUrl?: string;
  allImages?: string[];
  content?: string;
}

interface FeedTestResult {
  success: boolean;
  feedTitle?: string;
  itemCount?: number;
  latestItems?: RSSItemPreview[];
  availableFields?: string[];
  error?: string;
}

export function AutomationDialog({ open, onOpenChange, automation }: AutomationDialogProps) {
  const { createAutomation, updateAutomation } = usePlanningAutomations();
  const { clients } = useClients();
  const { columns } = usePlanningItems();
  const [clientId, setClientId] = useState<string>('');
  const { getPlatformStatus, canAutoPublish } = useClientPlatformStatus(clientId || null);
  
  const isEditing = !!automation;

  // Form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('schedule');
  const [columnId, setColumnId] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [contentType, setContentType] = useState('tweet');
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
  const [expandedPreview, setExpandedPreview] = useState(false);

  // Auto publish
  const [autoPublish, setAutoPublish] = useState(false);

  // Image generation
  const [autoGenerateImage, setAutoGenerateImage] = useState(false);
  const [imagePromptTemplate, setImagePromptTemplate] = useState('');
  const [imageStyle, setImageStyle] = useState<ImageStyle>('photographic');

  // Auto-derive platform from content type
  useEffect(() => {
    const derivedPlatform = CONTENT_TO_PLATFORM[contentType as keyof typeof CONTENT_TO_PLATFORM];
    if (derivedPlatform && derivedPlatform !== 'other' && derivedPlatform !== 'document') {
      // Map content platform to our PLATFORMS values
      const platformMap: Record<string, string> = {
        'twitter': 'twitter',
        'instagram': 'instagram',
        'linkedin': 'linkedin',
        'youtube': 'youtube',
        'tiktok': 'tiktok',
        'newsletter': 'newsletter',
        'blog': 'blog',
      };
      const mappedPlatform = platformMap[derivedPlatform];
      if (mappedPlatform) {
        setPlatform(mappedPlatform);
      }
    }
  }, [contentType]);

  // Reset form when dialog opens/closes or automation changes
  useEffect(() => {
    if (open && automation) {
      setName(automation.name);
      setTriggerType(automation.trigger_type);
      setClientId(automation.client_id || '');
      setColumnId(automation.target_column_id || '');
      setPlatform(automation.platform || '');
      setSelectedPlatforms((automation as any).platforms || []);
      setContentType(automation.content_type || 'tweet');
      setAutoGenerate(automation.auto_generate_content);
      setPromptTemplate(automation.prompt_template || '');

      setAutoPublish((automation as any).auto_publish || false);
      
      // Image generation fields
      setAutoGenerateImage(automation.auto_generate_image || false);
      setImagePromptTemplate(automation.image_prompt_template || '');
      setImageStyle((automation.image_style as ImageStyle) || 'photographic');

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
      setExpandedPreview(false);
    } else if (open) {
      // Reset to defaults for new automation
      setName('');
      setTriggerType('schedule');
      setClientId('');
      setColumnId('');
      setPlatform('');
      setSelectedPlatforms([]);
      setContentType('tweet');
      setAutoGenerate(false);
      setPromptTemplate('');
      setScheduleType('weekly');
      setScheduleDays([1]);
      setScheduleTime('10:00');
      setRssUrl('');
      setAutoPublish(false);
      // Image generation defaults
      setAutoGenerateImage(false);
      setImagePromptTemplate('');
      setImageStyle('photographic');
      setFeedTestResult(null);
      setExpandedPreview(false);
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
        body: { rssUrl, limit: 3, includeContent: true }
      });
      
      if (error) throw error;
      
      if (data.success && data.items?.length > 0) {
        const items: RSSItemPreview[] = data.items.map((item: any) => ({
          title: item.title,
          description: item.description,
          link: item.link,
          pubDate: item.pubDate,
          imageUrl: item.imageUrl,
          allImages: item.allImages || [],
          content: item.content,
        }));

        // Determine available fields
        const availableFields: string[] = ['title'];
        if (items[0].description) availableFields.push('description');
        if (items[0].link) availableFields.push('link');
        if (items[0].content) availableFields.push('content');
        if (items.some(i => i.allImages && i.allImages.length > 0)) availableFields.push('images');

        setFeedTestResult({
          success: true,
          feedTitle: data.feedTitle || 'Feed RSS',
          itemCount: data.totalItems || data.items.length,
          latestItems: items,
          availableFields,
        });
        setExpandedPreview(true);
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

  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast.success(`${variable} copiado!`);
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
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : null,
      content_type: contentType,
      auto_generate_content: autoGenerate,
      prompt_template: autoGenerate ? promptTemplate : null,
      auto_publish: autoPublish,
      // Image generation
      auto_generate_image: autoGenerateImage,
      image_prompt_template: autoGenerateImage ? imagePromptTemplate : null,
      image_style: autoGenerateImage ? imageStyle : null,
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

  // Group content types by category
  const contentTypesByCategory = CONTENT_TYPE_OPTIONS.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, typeof CONTENT_TYPE_OPTIONS>);

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
              placeholder="Ex: Thread semanal sobre newsletters"
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
                  
                  {/* Rich Feed test result */}
                  {feedTestResult && (
                    <div className={`rounded-lg text-sm ${
                      feedTestResult.success 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                      {feedTestResult.success ? (
                        <div className="p-3 space-y-3">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-green-700 dark:text-green-400">
                                Feed válido: {feedTestResult.itemCount} itens encontrados
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {feedTestResult.feedTitle}
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setExpandedPreview(!expandedPreview)}
                              className="h-8 w-8 p-0"
                            >
                              {expandedPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>

                          {expandedPreview && feedTestResult.latestItems && (
                            <>
                              {/* Available fields */}
                              <div className="border-t pt-3">
                                <p className="text-xs font-medium mb-2">Variáveis disponíveis no prompt:</p>
                                <div className="flex flex-wrap gap-1">
                                  {TEMPLATE_VARIABLES.filter(v => 
                                    feedTestResult.availableFields?.includes(v.key.replace(/[{}]/g, ''))
                                  ).map(variable => (
                                    <Button
                                      key={variable.key}
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-xs gap-1"
                                      onClick={() => copyVariable(variable.key)}
                                    >
                                      <Copy className="h-3 w-3" />
                                      {variable.key}
                                    </Button>
                                  ))}
                                </div>
                              </div>

                              {/* Latest items preview */}
                              <div className="border-t pt-3 space-y-2">
                                <p className="text-xs font-medium">Últimos itens do feed:</p>
                                <ScrollArea className="max-h-48">
                                  <div className="space-y-2">
                                    {feedTestResult.latestItems.map((item, idx) => (
                                      <div key={idx} className="p-2 bg-background/50 rounded border">
                                        <div className="flex gap-2">
                                          {item.allImages && item.allImages.length > 0 && (
                                            <div className="flex-shrink-0">
                                              <img 
                                                src={item.allImages[0]} 
                                                alt="" 
                                                className="w-16 h-16 object-cover rounded"
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                              />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{item.title}</p>
                                            {item.description && (
                                              <p className="text-xs text-muted-foreground line-clamp-2">
                                                {item.description.replace(/<[^>]*>/g, '').substring(0, 100)}...
                                              </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1">
                                              {item.pubDate && (
                                                <span className="text-xs text-muted-foreground">
                                                  {formatRelativeTime(item.pubDate)}
                                                </span>
                                              )}
                                              {item.allImages && item.allImages.length > 0 && (
                                                <Badge variant="outline" className="text-xs h-5">
                                                  <Image className="h-3 w-3 mr-1" />
                                                  {item.allImages.length} imagens
                                                </Badge>
                                              )}
                                              {item.link && (
                                                <a 
                                                  href={item.link} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                  Ver original
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 flex items-start gap-2">
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

          {/* Tipo de conteúdo com todos os tipos do sistema */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(contentTypesByCategory).map(([category, types]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {types.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Publicar em:</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {ALL_PUBLISH_PLATFORMS.map((p) => {
                  const status = getPlatformStatus(p.value as any);
                  const isConnected = status?.hasApi && status?.isValid;
                  const isSelected = selectedPlatforms.includes(p.value);
                  const IconComponent = platformLucideIcons[p.value];
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPlatforms(prev => prev.filter(v => v !== p.value));
                        } else {
                          setSelectedPlatforms(prev => [...prev, p.value]);
                          if (!platform) setPlatform(p.value);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-accent/50",
                        !isConnected && "opacity-40"
                      )}
                      style={isSelected ? { borderColor: p.brandColor, backgroundColor: `${p.brandColor}15` } : undefined}
                    >
                      {IconComponent && (
                        <IconComponent
                          className="h-3.5 w-3.5 shrink-0"
                          style={isSelected ? { color: p.brandColor } : undefined}
                        />
                      )}
                      <span className="truncate">{p.label}</span>
                      {isSelected && (
                        <Check className="h-3 w-3 ml-auto shrink-0 text-primary" style={{ color: p.brandColor }} />
                      )}
                      {!isSelected && isConnected && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedPlatforms.length > 0 && clientId && (
                <p className="text-[10px] text-muted-foreground">
                  {selectedPlatforms.filter(p => canAutoPublish(p as any)).length} de {selectedPlatforms.length} conectada(s) para auto-publish
                </p>
              )}
              {!clientId && (
                <p className="text-[10px] text-muted-foreground">
                  Selecione um perfil para ver status de conexão
                </p>
              )}
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
                  placeholder={`Ex: Com base no conteúdo "{{title}}", crie uma thread para Twitter analisando os principais pontos. Use as {{images}} imagens do artigo original para ilustrar cada tweet.`}
                  rows={4}
                  className="min-h-[100px]"
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis (clique para copiar):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {TEMPLATE_VARIABLES.map(variable => (
                      <Button
                        key={variable.key}
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => copyVariable(variable.key)}
                        title={variable.description}
                      >
                        <Copy className="h-3 w-3" />
                        {variable.key}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Para threads com imagens: as imagens extraídas do RSS serão automaticamente 
                    anexadas aos tweets após a geração do texto.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Geração automática de imagem */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-purple-500" />
                <div>
                  <Label className="text-base">Gerar imagem automaticamente</Label>
                  <p className="text-sm text-muted-foreground">
                    Cria uma imagem com IA junto do conteúdo
                  </p>
                </div>
              </div>
              <Switch 
                checked={autoGenerateImage} 
                onCheckedChange={setAutoGenerateImage}
                disabled={!clientId}
              />
            </div>

            {autoGenerateImage && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Briefing da imagem</Label>
                  <Textarea
                    value={imagePromptTemplate}
                    onChange={(e) => setImagePromptTemplate(e.target.value)}
                    placeholder="Ex: Imagem minimalista de café e teclado ao amanhecer. Cores quentes, luz suave. Tema: {{time_of_day}}"
                    rows={3}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Variáveis disponíveis:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {IMAGE_TEMPLATE_VARIABLES.map(variable => (
                        <Button
                          key={variable.key}
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          onClick={() => copyVariable(variable.key)}
                          title={variable.description}
                        >
                          <Copy className="h-3 w-3" />
                          {variable.key}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Estilo visual</Label>
                  <RadioGroup
                    value={imageStyle}
                    onValueChange={(v) => setImageStyle(v as ImageStyle)}
                    className="grid grid-cols-2 gap-2"
                  >
                    {IMAGE_STYLES.map(style => (
                      <div key={style.value} className="flex items-start space-x-2">
                        <RadioGroupItem value={style.value} id={`style-${style.value}`} className="mt-1" />
                        <label htmlFor={`style-${style.value}`} className="cursor-pointer">
                          <div className="font-medium text-sm">{style.label}</div>
                          <div className="text-xs text-muted-foreground">{style.description}</div>
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}

            {!clientId && (
              <p className="text-xs text-muted-foreground">
                Selecione um perfil para habilitar geração de imagem.
              </p>
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
                disabled={!autoGenerate || selectedPlatforms.length === 0 || !clientId || selectedPlatforms.filter(p => canAutoPublish(p as any)).length === 0}
              />
            </div>

            {autoPublish && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Apenas plataformas conectadas serão publicadas automaticamente.
                  {selectedPlatforms.filter(p => !canAutoPublish(p as any)).length > 0 && (
                    <> As demais serão criadas como rascunho.</>
                  )}
                </p>
              </div>
            )}

            {(!autoGenerate || selectedPlatforms.length === 0 || !clientId) && (
              <p className="text-xs text-muted-foreground">
                {!autoGenerate && "Ative a geração de conteúdo para habilitar. "}
                {selectedPlatforms.length === 0 && "Selecione ao menos uma plataforma. "}
                {!clientId && "Selecione um perfil."}
                {autoGenerate && selectedPlatforms.length > 0 && clientId && selectedPlatforms.filter(p => canAutoPublish(p as any)).length === 0 && "Nenhuma plataforma selecionada está conectada."}
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
