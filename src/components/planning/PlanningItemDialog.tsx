import { useState, useEffect } from 'react';
import { format, parseISO, setHours, setMinutes } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Loader2, Wand2, ChevronDown, Image, User, Settings2, Send, Bot, Clock } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { usePlanningImageGeneration } from '@/hooks/usePlanningImageGeneration';
import { usePlanningContentGeneration } from '@/hooks/usePlanningContentGeneration';
import { useIsMobile } from '@/hooks/use-mobile';
import { useClientPlatformStatus } from '@/hooks/useClientPlatformStatus';
import { useLateConnection, LatePlatform } from '@/hooks/useLateConnection';
import { cn } from '@/lib/utils';
import { MediaUploader, MediaItem } from './MediaUploader';
import { RichContentEditor } from './RichContentEditor';
import { ThreadEditor, ThreadTweet } from './ThreadEditor';
import { ImageGenerationModal, ImageGenerationOptions } from './ImageGenerationModal';
import { PlanningItemComments } from './PlanningItemComments';
import { MentionableInput } from './MentionableInput';
import { RecurrenceConfig } from './RecurrenceConfig';
import { CONTENT_TYPE_OPTIONS, CONTENT_TO_PLATFORM, ContentTypeKey } from '@/types/contentTypes';
import { toast } from 'sonner';
import type { PlanningItem, CreatePlanningItemInput, PlanningPlatform, PlanningPriority, KanbanColumn } from '@/hooks/usePlanningItems';
import type { RecurrenceConfig as RecurrenceConfigType } from '@/types/recurrence';

interface PlanningItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PlanningItem | null;
  columns: KanbanColumn[];
  defaultColumnId?: string;
  defaultDate?: Date;
  defaultClientId?: string;
  onSave: (data: CreatePlanningItemInput) => Promise<{ id: string } | void>;
  onUpdate?: (id: string, data: Partial<PlanningItem>) => Promise<void>;
  readOnly?: boolean;
}

const priorities: { value: PlanningPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

// Group content types by category for the select
const groupedContentTypes = CONTENT_TYPE_OPTIONS.reduce((acc, item) => {
  if (!acc[item.category]) {
    acc[item.category] = [];
  }
  acc[item.category].push(item);
  return acc;
}, {} as Record<string, typeof CONTENT_TYPE_OPTIONS>);

export function PlanningItemDialog({
  open,
  onOpenChange,
  item,
  columns,
  defaultColumnId,
  defaultDate,
  defaultClientId,
  onSave,
  onUpdate,
  readOnly = false
}: PlanningItemDialogProps) {
  const isMobile = useIsMobile();
  const { clients } = useClients();
  const { members } = useTeamMembers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [columnId, setColumnId] = useState<string>('');
  const [contentType, setContentType] = useState<ContentTypeKey>('tweet');
  const [priority, setPriority] = useState<PlanningPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');
  const [isSchedulingToLate, setIsSchedulingToLate] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [threadTweets, setThreadTweets] = useState<ThreadTweet[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [referenceInput, setReferenceInput] = useState('');
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfigType>({
    type: 'none',
    days: [],
    time: null,
    endDate: null,
  });

  const { generateImage, isGenerating: isGeneratingImage } = usePlanningImageGeneration(selectedClientId);
  const { generateContent, isGenerating: isGeneratingContent, isFetchingReference } = usePlanningContentGeneration();
  const { canAutoPublish, getPlatformStatus } = useClientPlatformStatus(selectedClientId);
  const lateConnection = useLateConnection({ clientId: selectedClientId });

  // Derive platform from content type
  const platform = CONTENT_TO_PLATFORM[contentType] as PlanningPlatform;
  const platformStatus = getPlatformStatus(platform);
  const canPublishNow = canAutoPublish(platform) && (content.trim() || threadTweets.some(t => t.text.trim()));

  const canGenerateContent = title.trim() && contentType && selectedClientId;
  const canGenerateImage = (content.trim() || threadTweets.some(t => t.text.trim())) && selectedClientId;
  const hasReference = referenceInput.trim();
  const isTwitterThread = contentType === 'thread';

  const handleGenerateContent = async () => {
    if (!canGenerateContent) return;
    
    const result = await generateContent({
      title,
      contentType,
      clientId: selectedClientId,
      referenceInput: referenceInput.trim() || undefined,
    });

    if (result) {
      if (isTwitterThread) {
        setThreadTweets([{ id: 'tweet-1', text: result.content, media_urls: [] }]);
      } else {
        setContent(result.content);
      }

      // Add extracted images to media
      if (result.images && result.images.length > 0) {
        const newMediaItems: MediaItem[] = result.images.map((url, i) => ({
          id: `ref-img-${Date.now()}-${i}`,
          url,
          type: 'image' as const
        }));
        setMediaItems(prev => [...newMediaItems, ...prev]);
      }

      setReferenceInput('');
    }
  };

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setContent(item.content || '');
      setSelectedClientId(item.client_id || '');
      setColumnId(item.column_id || '');
      setPriority(item.priority);
      setDueDate(item.due_date ? parseISO(item.due_date) : undefined);
      const parsedScheduledAt = item.scheduled_at ? parseISO(item.scheduled_at) : undefined;
      setScheduledAt(parsedScheduledAt);
      setScheduledTime(parsedScheduledAt ? format(parsedScheduledAt, 'HH:mm') : '09:00');
      setAssignedTo(item.assigned_to || '');
      
      const metadata = item.metadata as any || {};
      // Try to get content_type, fallback to mapping from platform
      const savedContentType = metadata.content_type || item.content_type;
      if (savedContentType && CONTENT_TO_PLATFORM[savedContentType as ContentTypeKey]) {
        setContentType(savedContentType as ContentTypeKey);
      } else {
        setContentType('tweet');
      }
      
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
      setSelectedClientId(defaultClientId || '');
      setColumnId(defaultColumnId || columns[0]?.id || '');
      setContentType('tweet');
      setPriority('medium');
      setDueDate(defaultDate);
      setScheduledAt(undefined);
      setScheduledTime('09:00');
      setIsSchedulingToLate(false);
      setMediaItems([]);
      setThreadTweets([{ id: 'tweet-1', text: '', media_urls: [] }]);
      setAssignedTo('');
      setReferenceInput('');
      setRecurrenceConfig({ type: 'none', days: [], time: null, endDate: null });
      setShowMoreOptions(false);
    }
  }, [item, defaultColumnId, defaultDate, defaultClientId, columns, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      let finalContent = content;
      if (isTwitterThread) {
        finalContent = threadTweets.map(t => t.text).join('\n\n---\n\n');
      }

      // Build scheduled datetime with time
      let finalScheduledAt: Date | undefined = undefined;
      if (scheduledAt) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        finalScheduledAt = setMinutes(setHours(scheduledAt, hours), minutes);
      }

      const data: CreatePlanningItemInput & Record<string, any> = {
        title: title.trim(),
        content: finalContent.trim() || undefined,
        client_id: selectedClientId || undefined,
        column_id: columnId || undefined,
        platform: platform || undefined,
        priority,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        scheduled_at: finalScheduledAt ? finalScheduledAt.toISOString() : undefined,
        media_urls: mediaItems.map(m => m.url),
        assigned_to: assignedTo || undefined,
        content_type: contentType,
        metadata: {
          content_type: contentType,
          ...(isTwitterThread && { thread_tweets: threadTweets }),
        },
        recurrence_type: recurrenceConfig.type !== 'none' ? recurrenceConfig.type : null,
        recurrence_days: recurrenceConfig.days.length > 0 ? recurrenceConfig.days : null,
        recurrence_time: recurrenceConfig.time || null,
        recurrence_end_date: recurrenceConfig.endDate || null,
        is_recurrence_template: recurrenceConfig.type !== 'none',
      };

      // Save or update the planning item first
      let savedItemId: string | undefined;
      if (item && onUpdate) {
        await onUpdate(item.id, data);
        savedItemId = item.id;
      } else {
        const result = await onSave(data);
        savedItemId = result && 'id' in result ? result.id : undefined;
      }

      // If scheduling is set AND we can publish to this platform, send to Late API
      const shouldScheduleToLate = 
        finalScheduledAt && 
        canPublishNow && 
        platform && 
        selectedClientId &&
        (finalContent.trim() || threadTweets.some(t => t.text.trim()));

      if (shouldScheduleToLate && savedItemId) {
        setIsSchedulingToLate(true);
        try {
          await lateConnection.publishContent(
            platform as LatePlatform,
            isTwitterThread ? threadTweets.map(t => t.text).join('\n\n') : finalContent,
            {
              mediaUrls: mediaItems.map(m => m.url),
              planningItemId: savedItemId,
              threadItems: isTwitterThread ? threadTweets : undefined,
              scheduledFor: finalScheduledAt.toISOString(),
              publishNow: false,
            }
          );
          toast.success(`Agendado para ${format(finalScheduledAt, "dd/MM 'às' HH:mm")}`);
        } catch (scheduleError) {
          // If Late API scheduling fails, keep local scheduling (cron will handle it)
          console.warn('Late API scheduling failed, keeping local schedule:', scheduleError);
          toast.info("Salvo! Será publicado automaticamente no horário agendado.");
        } finally {
          setIsSchedulingToLate(false);
        }
      }

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishNow = async () => {
    if (!canPublishNow || !platform) return;
    
    let finalContent = content;
    if (isTwitterThread) {
      finalContent = threadTweets.map(t => t.text).join('\n\n');
    }
    
    if (!finalContent.trim()) {
      toast.error('Adicione conteúdo para publicar');
      return;
    }
    
    setIsPublishing(true);
    try {
      await lateConnection.publishContent(
        platform as LatePlatform,
        finalContent,
        {
          mediaUrls: mediaItems.map(m => m.url),
          planningItemId: item?.id,
          threadItems: isTwitterThread ? threadTweets : undefined,
        }
      );
      toast.success(`Publicado em ${platform}!`);
      onOpenChange(false);
    } catch (error) {
      // Error toast is handled by useLateConnection
    } finally {
      setIsPublishing(false);
    }
  };

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
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto",
        isMobile ? "max-w-full w-full h-full max-h-full rounded-none" : "max-w-xl"
      )}>
        <DialogHeader>
          <DialogTitle>
            {readOnly ? 'Visualizar Card' : (item ? 'Editar Card' : 'Novo Card')}
          </DialogTitle>
          {readOnly && (
            <p className="text-sm text-muted-foreground">Modo visualização - você não tem permissão para editar.</p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Título *</Label>
            <MentionableInput
              value={title}
              onChange={readOnly ? () => {} : setTitle}
              clientId={selectedClientId}
              placeholder="Título do conteúdo (use @ para refs)"
              disabled={readOnly}
            />
          </div>

          {/* Client + Format row */}
          <div className="grid grid-cols-2 gap-2">
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

            <Select value={contentType} onValueChange={(v) => setContentType(v as ContentTypeKey)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedContentTypes).map(([category, items]) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="text-xs text-muted-foreground">{category}</SelectLabel>
                    {items.map(item => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference Input with @mentions + Generate */}
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed">
            <Label className="text-xs text-muted-foreground">
              Gerar a partir de... (link, @referência ou descrição)
            </Label>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <MentionableInput
                  value={referenceInput}
                  onChange={setReferenceInput}
                  clientId={selectedClientId}
                  placeholder="Cole link, use @referência, ou descreva..."
                  multiline
                  rows={2}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateContent}
                disabled={!canGenerateContent || isGeneratingContent || isFetchingReference}
                className="shrink-0 gap-1.5 h-9"
              >
                {isGeneratingContent || isFetchingReference ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {hasReference ? 'Gerar' : 'Escrever'}
              </Button>
            </div>
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

              {/* Scheduling with time */}
              <div className="space-y-2">
                <Label className="text-xs">Agendamento</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("flex-1 justify-start h-8 text-sm", !scheduledAt && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {scheduledAt ? format(scheduledAt, 'dd/MM/yyyy') : 'Data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={scheduledAt} onSelect={setScheduledAt} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-8 w-24 text-sm"
                      disabled={!scheduledAt}
                    />
                  </div>
                </div>
                {scheduledAt && canPublishNow && (
                  <p className="text-[10px] text-muted-foreground">
                    ✓ Será enviado ao {platform} automaticamente
                  </p>
                )}
              </div>

              {/* Recurrence */}
              <RecurrenceConfig
                value={recurrenceConfig}
                onChange={setRecurrenceConfig}
              />

              {/* Comments (only in edit mode) */}
              {item && (
                <div className="pt-2 border-t">
                  <PlanningItemComments planningItemId={item.id} />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            {!readOnly && canPublishNow && (
              <Button 
                type="button" 
                variant="secondary"
                onClick={handlePublishNow}
                disabled={isPublishing || isSubmitting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publicar Agora
              </Button>
            )}
            {!readOnly && (
              <Button type="submit" disabled={isSubmitting || !title.trim()}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {item ? 'Salvar' : 'Criar'}
              </Button>
            )}
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
