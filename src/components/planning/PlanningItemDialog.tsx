import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Loader2, Wand2, ChevronDown, Link, Image, User, MessageSquare, Settings2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { usePlanningImageGeneration } from '@/hooks/usePlanningImageGeneration';
import { usePlanningContentGeneration } from '@/hooks/usePlanningContentGeneration';
import { cn } from '@/lib/utils';
import { MediaUploader, MediaItem } from './MediaUploader';
import { Textarea } from '@/components/ui/textarea';
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
  { value: 'post', label: 'Post' },
  { value: 'thread', label: 'Thread' },
  { value: 'article', label: 'Artigo' },
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
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
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
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigType>({
    type: 'none',
    days: [],
    time: null,
    endDate: null,
  });

  const { generateImage, isGenerating: isGeneratingImage } = usePlanningImageGeneration(selectedClientId);
  const { generateContent, isGenerating: isGeneratingContent, isFetchingReference } = usePlanningContentGeneration();

  const canGenerateContent = title.trim() && platform && selectedClientId;
  const canGenerateImage = (content.trim() || threadTweets.some(t => t.text.trim())) && selectedClientId;
  const hasReference = referenceUrl.trim();

  const handleGenerateContent = async () => {
    if (!canGenerateContent) return;
    
    const generatedContent = await generateContent({
      title,
      description: '',
      platform: platform as string,
      contentType,
      clientId: selectedClientId,
      referenceUrl: referenceUrl.trim() || undefined,
    });

    if (generatedContent) {
      if (isTwitterThread) {
        setThreadTweets([{ id: 'tweet-1', text: generatedContent, media_urls: [] }]);
      } else {
        setContent(generatedContent);
      }
      setReferenceUrl('');
    }
  };

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setContent(item.content || '');
      setSelectedClientId(item.client_id || '');
      setColumnId(item.column_id || '');
      setPlatform(item.platform || '');
      setPriority(item.priority);
      setDueDate(item.due_date ? parseISO(item.due_date) : undefined);
      setScheduledAt(item.scheduled_at ? parseISO(item.scheduled_at) : undefined);
      setAssignedTo(item.assigned_to || '');
      
      const metadata = item.metadata as any || {};
      setContentType(metadata.content_type || 'post');
      
      setRecurrenceConfig({
        type: (item as any).recurrence_type || 'none',
        days: (item as any).recurrence_days || [],
        time: (item as any).recurrence_time || null,
        endDate: (item as any).recurrence_end_date || null,
      });
      
      const mediaUrls = item.media_urls as string[] || [];
      setMediaItems(mediaUrls.map((url, i) => ({
        id: `media-${i}`,
        url,
        type: url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image'
      })));
      
      if (metadata.thread_tweets) {
        setThreadTweets(metadata.thread_tweets);
      } else {
        setThreadTweets([{ id: 'tweet-1', text: item.content || '', media_urls: [] }]);
      }
    } else {
      setTitle('');
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
      setRecurrenceConfig({ type: 'none', days: [], time: null, endDate: null });
      setShowMoreOptions(false);
    }
  }, [item, defaultColumnId, defaultDate, columns, open]);

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
      let finalContent = content;
      if (contentType === 'thread') {
        finalContent = threadTweets.map(t => t.text).join('\n\n---\n\n');
      }

      const data: CreatePlanningItemInput & Record<string, any> = {
        title: title.trim(),
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Card' : 'Novo Card'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Título *</Label>
            <MentionableInput
              value={title}
              onChange={setTitle}
              clientId={selectedClientId}
              placeholder="Título do conteúdo (use @ para refs)"
            />
          </div>

          {/* Main selects row */}
          <div className="grid grid-cols-3 gap-2">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platform} onValueChange={(v) => setPlatform(v as PlanningPlatform)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                {contentTypes.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference URL + Generate */}
          <div className="flex gap-2 items-center p-3 bg-muted/30 rounded-lg border border-dashed">
            <Link className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="Cole link do YouTube ou artigo para gerar conteúdo..."
              className="flex-1 h-8 text-sm border-0 bg-transparent p-0 focus-visible:ring-0"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleGenerateContent}
              disabled={!canGenerateContent || isGeneratingContent || isFetchingReference}
              className="shrink-0 gap-1.5"
            >
              {isGeneratingContent || isFetchingReference ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {hasReference ? 'Gerar' : 'Escrever com IA'}
            </Button>
          </div>

          {/* Content Editor */}
          <div className="space-y-2">
            {isTwitterThread ? (
              <ThreadEditor
                value={threadTweets}
                onChange={setThreadTweets}
                clientId={selectedClientId}
              />
            ) : (
              <RichContentEditor
                value={content}
                onChange={setContent}
                placeholder="Escreva seu conteúdo aqui..."
                minRows={4}
                clientId={selectedClientId}
              />
            )}
          </div>

          {/* Media Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Image className="h-4 w-4" />
                Mídia ({mediaItems.length})
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowImageModal(true)}
                disabled={!canGenerateImage}
                className="h-7 text-xs gap-1"
              >
                <Wand2 className="h-3 w-3" />
                Gerar imagem
              </Button>
            </div>
            <MediaUploader
              value={mediaItems}
              onChange={setMediaItems}
              maxItems={platform === 'twitter' ? 4 : 10}
              clientId={selectedClientId}
            />
          </div>

          {/* Date + Assigned Row */}
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start h-9", !dueDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
              </PopoverContent>
            </Popover>

            <Select value={assignedTo || 'none'} onValueChange={(val) => setAssignedTo(val === 'none' ? '' : val)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Responsável">
                  {assignedTo ? (
                    <span className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      {members.find(m => m.user_id === assignedTo)?.profile?.full_name || 'Membro'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3 w-3" />
                      Responsável
                    </span>
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
                          {(member.profile?.full_name?.[0] || '?').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {member.profile?.full_name || member.profile?.email || 'Membro'}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* More Options - Collapsible */}
          <Collapsible open={showMoreOptions} onOpenChange={setShowMoreOptions}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-between h-8 text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Mais opções
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showMoreOptions && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Coluna</Label>
                  <Select value={columnId} onValueChange={setColumnId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Prioridade</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as PlanningPriority)}>
                    <SelectTrigger className="h-8 text-sm">
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

              <div>
                <Label className="text-xs">Agendar Publicação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full justify-start h-8 text-sm", !scheduledAt && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {scheduledAt ? format(scheduledAt, 'dd/MM/yyyy HH:mm') : 'Selecionar data e hora'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={scheduledAt} onSelect={setScheduledAt} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-xs">Recorrência</Label>
                <RecurrenceConfig 
                  value={recurrenceConfig} 
                  onChange={setRecurrenceConfig} 
                />
              </div>

              {item && (
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Comentários
                  </Label>
                  <div className="mt-1">
                    <PlanningItemComments planningItemId={item.id} />
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
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
