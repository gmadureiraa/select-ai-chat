import { useEffect, useState } from 'react';
import { Calendar, Rss, Webhook, Sparkles } from 'lucide-react';
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

      if (automation.trigger_type === 'schedule') {
        const config = automation.trigger_config as ScheduleConfig;
        setScheduleType(config.type || 'weekly');
        setScheduleDays(config.days || [1]);
        setScheduleTime(config.time || '10:00');
      } else if (automation.trigger_type === 'rss') {
        const config = automation.trigger_config as RSSConfig;
        setRssUrl(config.url || '');
      }
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
    }
  }, [open, automation]);

  const handleDayToggle = (day: number) => {
    setScheduleDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
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
                  <Input
                    value={rssUrl}
                    onChange={(e) => setRssUrl(e.target.value)}
                    placeholder="https://exemplo.com/feed.xml"
                  />
                  <p className="text-xs text-muted-foreground">
                    Um novo card será criado quando um item aparecer no feed
                  </p>
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
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os perfis</SelectItem>
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
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Coluna padrão</SelectItem>
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
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
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
