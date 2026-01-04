import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarIcon, Loader2, FileText, MessageSquare, User, Sparkles, Wand2, Settings, Link, Code, Search } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { usePlanningImageGeneration } from '@/hooks/usePlanningImageGeneration';
import { usePlanningContentGeneration } from '@/hooks/usePlanningContentGeneration';
import { cn } from '@/lib/utils';
import { MediaUploader, MediaItem } from './MediaUploader';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RichContentEditor } from './RichContentEditor';
import { ThreadEditor, ThreadTweet } from './ThreadEditor';
import { ImageGenerationModal, ImageGenerationOptions } from './ImageGenerationModal';
import { PlanningItemComments } from './PlanningItemComments';
import { MentionableInput } from './MentionableInput';
import { RecurrenceConfig } from './RecurrenceConfig';
import type { PlanningItem, CreatePlanningItemInput, PlanningPlatform, PlanningPriority, KanbanColumn } from '@/hooks/usePlanningItems';
import type { RecurrenceConfig as RecurrenceConfigType } from '@/types/rssTrigger';

interface PlanningItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PlanningItem | null;
  columns: KanbanColumn[];
  defaultColumnId?: string;
  defaultDate?: Date;
  onSave: (data: CreatePlanningItemInput) => Promise<void>;
  onUpdate?: (id: string, data: Partial<PlanningItem>) => Promise<void>;
}

const platforms: { value: PlanningPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'blog', label: 'Blog' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Outro' },
];

const priorities: { value: PlanningPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const contentTypes = [
  { value: 'post', label: 'Post Simples' },
  { value: 'thread', label: 'Thread (Twitter)' },
  { value: 'article', label: 'Artigo/Newsletter' },
  { value: 'carousel', label: 'Carrossel' },
];

export function PlanningItemDialog({
  open,
  onOpenChange,
  item,
  columns,
  defaultColumnId,
  defaultDate,
  onSave,
  onUpdate
}: PlanningItemDialogProps) {
  const { clients } = useClients();
  const { members } = useTeamMembers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [columnId, setColumnId] = useState<string>('');
  const [platform, setPlatform] = useState<PlanningPlatform | ''>('');
  const [priority, setPriority] = useState<PlanningPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [contentType, setContentType] = useState<string>('post');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [threadTweets, setThreadTweets] = useState<ThreadTweet[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referenceHtml, setReferenceHtml] = useState('');
  const [showHtmlInput, setShowHtmlInput] = useState(false);
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigType>({
    type: 'none',
    days: [],
    time: null,
    endDate: null,
  });

  const { generateImage, isGenerating: isGeneratingImage } = usePlanningImageGeneration(selectedClientId);
  const { generateContent, fetchReferenceContent, isGenerating: isGeneratingContent, isFetchingReference } = usePlanningContentGeneration();

  const canGenerateContent = title.trim() && platform && selectedClientId;
  const canGenerateImage = (content.trim() || threadTweets.some(t => t.text.trim())) && selectedClientId;
  const hasReference = referenceUrl.trim() || referenceHtml.trim();

  const handleGenerateContent = async () => {
    if (!canGenerateContent) return;
    
    const generatedContent = await generateContent({
      title,
      description,
      platform: platform as string,
      contentType,
      clientId: selectedClientId,
      referenceUrl: referenceUrl.trim() || undefined,
      referenceHtml: referenceHtml.trim() || undefined
    });

    if (generatedContent) {
      if (isTwitterThread) {
        setThreadTweets([{ id: 'tweet-1', text: generatedContent, media_urls: [] }]);
      } else {
        setContent(generatedContent);
      }
      // Clear reference after successful generation
      setReferenceUrl('');
      setReferenceHtml('');
      setShowHtmlInput(false);
    }
  };

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setContent(item.content || '');
      setSelectedClientId(item.client_id || '');
      setColumnId(item.column_id || '');
      setPlatform(item.platform || '');
      setPriority(item.priority);
      setDueDate(item.due_date ? parseISO(item.due_date) : undefined);
      setScheduledAt(item.scheduled_at ? parseISO(item.scheduled_at) : undefined);
      setAssignedTo(item.assigned_to || '');
      
      // Load content type and structure from metadata
      const metadata = item.metadata as any || {};
      setContentType(metadata.content_type || 'post');
      
      // Load recurrence config
      setRecurrenceConfig({
        type: (item as any).recurrence_type || 'none',
        days: (item as any).recurrence_days || [],
        time: (item as any).recurrence_time || null,
        endDate: (item as any).recurrence_end_date || null,
      });
      
      // Load media from metadata
      const mediaUrls = item.media_urls as string[] || [];
      setMediaItems(mediaUrls.map((url, i) => ({
        id: `media-${i}`,
        url,
        type: url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image'
      })));
      
      // Load thread tweets if exists
      if (metadata.thread_tweets) {
        setThreadTweets(metadata.thread_tweets);
      } else {
        setThreadTweets([{ id: 'tweet-1', text: item.content || '', media_urls: [] }]);
      }
    } else {
      setTitle('');
      setDescription('');
      setContent('');
      setSelectedClientId('');
      setColumnId(defaultColumnId || columns[0]?.id || '');
      setPlatform('');
      setPriority('medium');
      setDueDate(defaultDate);
      setScheduledAt(undefined);
      setContentType('post');
      setMediaItems([]);
      setThreadTweets([{ id: 'tweet-1', text: '', media_urls: [] }]);
      setAssignedTo('');
      setReferenceUrl('');
      setReferenceHtml('');
      setShowHtmlInput(false);
      setRecurrenceConfig({ type: 'none', days: [], time: null, endDate: null });
    }
  }, [item, defaultColumnId, defaultDate, columns, open]);

  // Auto-switch to thread mode for Twitter
  useEffect(() => {
    if (platform === 'twitter' && contentType === 'article') {
      setContentType('thread');
    }
  }, [platform, contentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      // Build content based on type
      let finalContent = content;
      if (contentType === 'thread') {
        // For threads, join all tweets as content preview
        finalContent = threadTweets.map(t => t.text).join('\n\n---\n\n');
      }

      const data: CreatePlanningItemInput & Record<string, any> = {
        title: title.trim(),
        description: description.trim() || undefined,
        content: finalContent.trim() || undefined,
        client_id: selectedClientId || undefined,
        column_id: columnId || undefined,
        platform: platform || undefined,
        priority,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
        media_urls: mediaItems.map(m => m.url),
        assigned_to: assignedTo || undefined,
        metadata: {
          content_type: contentType,
          ...(contentType === 'thread' && { thread_tweets: threadTweets }),
        },
        // Recurrence fields
        recurrence_type: recurrenceConfig.type !== 'none' ? recurrenceConfig.type : null,
        recurrence_days: recurrenceConfig.days.length > 0 ? recurrenceConfig.days : null,
        recurrence_time: recurrenceConfig.time || null,
        recurrence_end_date: recurrenceConfig.endDate || null,
        is_recurrence_template: recurrenceConfig.type !== 'none',
      };

      if (item && onUpdate) {
        await onUpdate(item.id, data);
      } else {
        await onSave(data);
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTwitterThread = platform === 'twitter' && contentType === 'thread';
  const showRichEditor = contentType === 'article' || contentType === 'post' || platform === 'newsletter' || platform === 'blog';

  const handleGenerateImage = async (options: ImageGenerationOptions): Promise<string | null> => {
    const contentForImage = isTwitterThread 
      ? threadTweets.map(t => t.text).join('\n\n')
      : content;
    
    const imageUrl = await generateImage({
      content: contentForImage,
      platform: platform || 'instagram',
      contentType,
      options
    });

    if (imageUrl) {
      setMediaItems(prev => [...prev, {
        id: `generated-${Date.now()}`,
        url: imageUrl,
        type: 'image'
      }]);
    }

    return imageUrl;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Card' : 'Novo Card'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título * <span className="text-xs text-muted-foreground font-normal">(use @ para mencionar referências)</span></Label>
            <MentionableInput
              value={title}
              onChange={setTitle}
              clientId={selectedClientId}
              placeholder="Título do conteúdo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Coluna</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as PlanningPlatform)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as PlanningPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="description">Descrição <span className="text-xs text-muted-foreground font-normal">(@ para refs)</span></Label>
              <MentionableInput
                value={description}
                onChange={setDescription}
                clientId={selectedClientId}
                placeholder="Breve descrição"
              />
            </div>

            <div>
              <Label>Responsável</Label>
              <Select value={assignedTo || 'none'} onValueChange={(val) => setAssignedTo(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar">
                    {assignedTo && members.find(m => m.user_id === assignedTo) && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {members.find(m => m.user_id === assignedTo)?.profile?.full_name || 'Membro'}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {members.filter(m => m.user_id).map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px]">
                            {(member.profile?.full_name?.[0] || member.profile?.email?.[0] || '?').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {member.profile?.full_name || member.profile?.email || 'Membro'}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content Section */}
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="content" className="gap-1">
                {isTwitterThread ? <MessageSquare className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                {isTwitterThread ? 'Thread' : 'Conteúdo'}
              </TabsTrigger>
              <TabsTrigger value="media">
                Mídia ({mediaItems.length})
              </TabsTrigger>
              <TabsTrigger value="recurrence" className="gap-1">
                <Settings className="h-3 w-3" />
                Recorrência
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-1">
                <MessageSquare className="h-3 w-3" />
                Comentários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-3 space-y-3">
              {/* Reference Section - Collapsible */}
              <Collapsible open={showHtmlInput || !!referenceUrl} onOpenChange={(open) => !open && setShowHtmlInput(false)}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      placeholder="Cole link do YouTube, artigo ou newsletter..."
                      className="pr-10"
                    />
                    {referenceUrl && (
                      <Link className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      className={cn(showHtmlInput && "bg-muted")}
                      title="Colar HTML de newsletter"
                    >
                      <Code className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent className="mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">HTML da Newsletter</Label>
                    <Textarea
                      value={referenceHtml}
                      onChange={(e) => setReferenceHtml(e.target.value)}
                      placeholder="Cole aqui o HTML da newsletter..."
                      className="min-h-[100px] font-mono text-xs"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* AI Content Generation Button */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant={hasReference ? "default" : "outline"}
                  size="sm"
                  onClick={handleGenerateContent}
                  disabled={!canGenerateContent || isGeneratingContent || isFetchingReference}
                  className="gap-2"
                >
                  {isGeneratingContent || isFetchingReference ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {hasReference ? 'Gerar a partir da Referência' : 'Escrever com IA'}
                </Button>
              </div>

              {isTwitterThread ? (
                <ThreadEditor
                  value={threadTweets}
                  onChange={setThreadTweets}
                  clientId={selectedClientId}
                />
              ) : showRichEditor ? (
                <RichContentEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Escreva seu conteúdo aqui. Use Markdown para formatação..."
                  clientId={selectedClientId}
                />
              ) : (
                <RichContentEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Texto do conteúdo"
                  minRows={4}
                  clientId={selectedClientId}
                />
              )}
            </TabsContent>

            <TabsContent value="media" className="mt-3 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Adicione imagens ou vídeos ao seu conteúdo</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImageModal(true)}
                  disabled={!canGenerateImage}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Gerar com IA
                </Button>
              </div>
              <MediaUploader
                value={mediaItems}
                onChange={setMediaItems}
                maxItems={platform === 'twitter' ? 4 : 10}
                clientId={selectedClientId}
              />
            </TabsContent>

            <TabsContent value="recurrence" className="mt-3">
              <RecurrenceConfig 
                value={recurrenceConfig} 
                onChange={setRecurrenceConfig} 
              />
            </TabsContent>

            <TabsContent value="comments" className="mt-3">
              <PlanningItemComments planningItemId={item?.id} />
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Prevista</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Agendar Para</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledAt && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledAt ? format(scheduledAt, 'dd/MM HH:mm') : 'Agendar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={scheduledAt} onSelect={setScheduledAt} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {item ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <ImageGenerationModal
      open={showImageModal}
      onOpenChange={setShowImageModal}
      content={isTwitterThread ? threadTweets.map(t => t.text).join('\n\n') : content}
      platform={platform || 'instagram'}
      contentType={contentType}
      onGenerate={handleGenerateImage}
      isGenerating={isGeneratingImage}
    />
    </>
  );
}
