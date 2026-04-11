import { useState, useEffect } from 'react';
import { format, parseISO, setHours, setMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CalendarIcon, Loader2, Wand2, Image, User, Send, Bot, Clock, Twitter, Linkedin, Instagram, Youtube, Facebook, Video, Mail, FileText, AtSign, Check, Flag, CheckCircle2, MessageSquare, XCircle } from 'lucide-react';

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
import { CONTENT_TYPE_OPTIONS, CONTENT_TO_PLATFORM, ContentTypeKey, ALL_PUBLISH_PLATFORMS } from '@/types/contentTypes';
import type { PlanningItem, CreatePlanningItemInput, PlanningPlatform, PlanningPriority, KanbanColumn } from '@/hooks/usePlanningItems';
import type { RecurrenceConfig as RecurrenceConfigType } from '@/types/recurrence';

// Map platform values to Lucide icon components
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
import { toast } from 'sonner';

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
  
  const [freshItem, setFreshItem] = useState<PlanningItem | null>(null);
  const [isFetchingItem, setIsFetchingItem] = useState(false);
  
  // Fetch fresh item data when dialog opens to ensure we have latest content
  useEffect(() => {
    const fetchFreshItem = async () => {
      if (!open || !item?.id) {
        setFreshItem(null);
        return;
      }
      
      setIsFetchingItem(true);
      try {
        const { data, error } = await supabase
          .from('planning_items')
          .select('*')
          .eq('id', item.id)
          .single();
        
        if (error) {
          console.error('Error fetching fresh item:', error);
          setFreshItem(null);
        } else {
          setFreshItem(data as PlanningItem);
        }
      } catch (err) {
        console.error('Error fetching fresh item:', err);
        setFreshItem(null);
      } finally {
        setIsFetchingItem(false);
      }
    };
    
    fetchFreshItem();
  }, [open, item?.id]);
  
  // Use fresh item if available, otherwise fall back to prop
  const effectiveItem = freshItem || item;
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [columnId, setColumnId] = useState<string>('');
  const [contentType, setContentType] = useState<ContentTypeKey>('tweet');
  const [priority, setPriority] = useState<PlanningPriority>('medium');
  
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');
  const [isSchedulingToLate, setIsSchedulingToLate] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [threadTweets, setThreadTweets] = useState<ThreadTweet[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
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

  // Derive platform from content type (used as default suggestion)
  const platform = CONTENT_TO_PLATFORM[contentType] as PlanningPlatform;
  
  // Auto-set default platform when content type changes
  useEffect(() => {
    if (platform && selectedPlatforms.length === 0) {
      setSelectedPlatforms([platform]);
    }
  }, [contentType]);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  // Check if any selected platform can auto-publish
  const publishablePlatforms = selectedPlatforms.filter(p => canAutoPublish(p as any));
  const canPublishNow = publishablePlatforms.length > 0 && (content.trim() || threadTweets.some(t => t.text.trim()));

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
    // Use effectiveItem (fresh data if available) instead of stale item prop
    if (effectiveItem) {
      setTitle(effectiveItem.title);
      // Use content, fallback to description if content is empty (for automation-generated items)
      const itemContent = effectiveItem.content || (effectiveItem as any).description || '';
      setContent(itemContent);
      setSelectedClientId(effectiveItem.client_id || '');
      setColumnId(effectiveItem.column_id || '');
      setPriority(effectiveItem.priority);
      const parsedScheduledAt = effectiveItem.scheduled_at 
        ? parseISO(effectiveItem.scheduled_at) 
        : effectiveItem.due_date ? parseISO(effectiveItem.due_date) : undefined;
      setScheduledAt(parsedScheduledAt);
      setScheduledTime(parsedScheduledAt ? format(parsedScheduledAt, 'HH:mm') : '09:00');
      setAssignedTo(effectiveItem.assigned_to || '');
      
      const metadata = effectiveItem.metadata as any || {};
      // Try to get content_type, fallback to mapping from platform
      const savedContentType = metadata.content_type || effectiveItem.content_type;
      if (savedContentType && CONTENT_TO_PLATFORM[savedContentType as ContentTypeKey]) {
        setContentType(savedContentType as ContentTypeKey);
      } else {
        setContentType('tweet');
      }

      // Restore selected platforms from metadata or derive from content type
      if (metadata.target_platforms?.length > 0) {
        setSelectedPlatforms(metadata.target_platforms);
      } else if (effectiveItem.platform) {
        setSelectedPlatforms([effectiveItem.platform]);
      }
      
      setRecurrenceConfig({
        type: (effectiveItem as any).recurrence_type || 'none',
        days: (effectiveItem as any).recurrence_days || [],
        time: (effectiveItem as any).recurrence_time || null,
        endDate: (effectiveItem as any).recurrence_end_date || null,
      });
      
      const mediaUrls = effectiveItem.media_urls as string[] || [];
      setMediaItems(mediaUrls.map((url, i) => ({
        id: `media-${i}`,
        url,
        type: url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image'
      })));
      
      if (metadata.thread_tweets) {
        setThreadTweets(metadata.thread_tweets);
      } else {
        setThreadTweets([{ id: 'tweet-1', text: effectiveItem.content || '', media_urls: [] }]);
      }
    } else if (!item) {
      // Only reset when there's no item at all (new card)
      setTitle('');
      setContent('');
      setSelectedClientId(defaultClientId || '');
      setColumnId(defaultColumnId || columns[0]?.id || '');
      setContentType('tweet');
      setPriority('medium');
      setScheduledAt(defaultDate || undefined);
      setScheduledTime('09:00');
      setIsSchedulingToLate(false);
      setMediaItems([]);
      setThreadTweets([{ id: 'tweet-1', text: '', media_urls: [] }]);
      setAssignedTo('');
      setSelectedPlatforms([]);
      setReferenceInput('');
      setRecurrenceConfig({ type: 'none', days: [], time: null, endDate: null });
      
    }
  }, [effectiveItem, item, defaultColumnId, defaultDate, defaultClientId, columns, open]);

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

      // IMPORTANT: If scheduling is set, auto-move to "scheduled" column
      let targetColumnId = columnId;
      let targetStatus: 'idea' | 'draft' | 'review' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed' = 'idea';
      
      if (finalScheduledAt && columns.length > 0) {
        const scheduledColumn = columns.find(c => c.column_type === 'scheduled');
        if (scheduledColumn) {
          targetColumnId = scheduledColumn.id;
          targetStatus = 'scheduled';
        }
      }

      const data: CreatePlanningItemInput & Record<string, any> = {
        title: title.trim(),
        content: finalContent.trim() || undefined,
        client_id: selectedClientId || undefined,
        column_id: targetColumnId || undefined,
        platform: platform || undefined,
        priority,
        status: finalScheduledAt ? targetStatus : undefined,
        due_date: finalScheduledAt ? format(finalScheduledAt, 'yyyy-MM-dd') : undefined,
        scheduled_at: finalScheduledAt ? finalScheduledAt.toISOString() : undefined,
        media_urls: mediaItems.map(m => m.url),
        assigned_to: assignedTo || undefined,
        content_type: contentType,
        metadata: {
          content_type: contentType,
          target_platforms: selectedPlatforms,
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
        publishablePlatforms.length > 0 && 
        selectedClientId &&
        (finalContent.trim() || threadTweets.some(t => t.text.trim()));

      if (shouldScheduleToLate && savedItemId) {
        setIsSchedulingToLate(true);
        try {
          for (const targetPlatform of publishablePlatforms) {
            await lateConnection.publishContent(
              targetPlatform as LatePlatform,
              isTwitterThread ? threadTweets.map(t => t.text).join('\n\n') : finalContent,
              {
                mediaUrls: mediaItems.map(m => m.url),
                planningItemId: savedItemId,
                threadItems: isTwitterThread ? threadTweets : undefined,
                scheduledFor: finalScheduledAt.toISOString(),
                publishNow: false,
              }
            );
          }
          toast.success(`Agendado em ${publishablePlatforms.length} plataforma(s) para ${format(finalScheduledAt, "dd/MM 'às' HH:mm")}`);
        } catch (scheduleError) {
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
    if (!selectedClientId) {
      toast.error('Selecione um cliente');
      return;
    }
    
    if (publishablePlatforms.length === 0) {
      toast.error('Nenhuma plataforma conectada selecionada');
      return;
    }
    
    let finalContent = content;
    if (isTwitterThread) {
      finalContent = threadTweets.map(t => t.text).join('\n\n');
    }
    
    if (!finalContent.trim()) {
      toast.error('Adicione conteúdo para publicar');
      return;
    }
    
    // If item is not saved yet, save it first
    let itemId = effectiveItem?.id;
    if (!itemId) {
      toast.info('Salvando card antes de publicar...');
      try {
        const saveData: CreatePlanningItemInput = {
          title: title.trim() || 'Conteúdo sem título',
          content: finalContent.trim(),
          client_id: selectedClientId,
          column_id: columnId || columns[0]?.id,
          platform: selectedPlatforms[0] as PlanningPlatform,
          priority,
          status: 'publishing',
          media_urls: mediaItems.map(m => m.url),
          metadata: {
            content_type: contentType,
            target_platforms: selectedPlatforms,
            ...(isTwitterThread && { thread_tweets: threadTweets }),
          },
        };
        
        const result = await onSave(saveData);
        itemId = result && 'id' in result ? result.id : undefined;
        
        if (!itemId) {
          toast.error('Erro ao salvar card');
          return;
        }
      } catch (saveError) {
        console.error('Error saving before publish:', saveError);
        toast.error('Erro ao salvar card antes de publicar');
        return;
      }
    }
    
    setIsPublishing(true);
    const successPlatforms: string[] = [];
    const failedPlatforms: string[] = [];
    
    try {
      for (const targetPlatform of publishablePlatforms) {
        try {
          console.log(`[PlanningItemDialog] Publishing to ${targetPlatform}...`);
          await lateConnection.publishContent(
            targetPlatform as LatePlatform,
            finalContent,
            {
              mediaUrls: mediaItems.map(m => m.url),
              planningItemId: itemId,
              threadItems: isTwitterThread ? threadTweets : undefined,
            }
          );
          successPlatforms.push(targetPlatform);
        } catch (err) {
          console.error(`[PlanningItemDialog] Failed to publish to ${targetPlatform}:`, err);
          failedPlatforms.push(targetPlatform);
        }
      }

      if (successPlatforms.length > 0 && failedPlatforms.length === 0) {
        toast.success(`Publicado em ${successPlatforms.length} plataforma(s)!`);
      } else if (successPlatforms.length > 0) {
        toast.warning(`Publicado em ${successPlatforms.length}/${publishablePlatforms.length} plataformas. Falhou: ${failedPlatforms.join(', ')}`);
      } else {
        toast.error('Falha ao publicar em todas as plataformas');
      }
      
      if (successPlatforms.length > 0) {
        onOpenChange(false);
      }
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
      <DialogContent 
        className={cn(
          "max-h-[90vh] overflow-hidden p-0",
          isMobile ? "max-w-full w-full h-full max-h-full rounded-none" : "max-w-4xl"
        )}
        hideCloseButton={false}
      >
        {isFetchingItem && item ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
          {/* Header - Title inline editable */}
          <div className="px-6 pt-5 pb-3 border-b border-border/40">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do conteúdo..."
                disabled={readOnly}
                className="flex-1 text-lg font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50 text-foreground border-b-2 border-transparent hover:border-border/40 focus:border-primary/50 transition-colors pb-1"
              />
              {readOnly && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Somente leitura</span>
              )}
            </div>
          </div>

          {/* Two-column body */}
          <div className={cn(
            "flex-1 overflow-y-auto",
            isMobile ? "flex flex-col" : "grid grid-cols-[1fr_320px]"
          )}>
            {/* LEFT: Content area */}
            <div className="p-6 space-y-4 overflow-y-auto border-r border-border/30">
              {/* Reference / AI generation - Collapsible */}
              <details className="group">
                <summary className="flex items-center gap-1.5 p-2.5 bg-muted/30 rounded-lg border border-dashed border-border/50 cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground font-medium select-none">
                  <Wand2 className="h-3 w-3 shrink-0" />
                  <span>Gerar com IA</span>
                  <span className="ml-auto text-[10px] opacity-60 group-open:hidden">Clique para expandir</span>
                </summary>
                <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-dashed border-border/50 space-y-2">
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
              </details>

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
                    minRows={isMobile ? 8 : 14}
                    clientId={selectedClientId}
                  />
                )}
              </div>

              {/* Media Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium">
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

              {/* Comments (only in edit mode) */}
              {item && (
                <div className="pt-3 border-t border-border/30">
                  <PlanningItemComments planningItemId={item.id} clientId={selectedClientId} />
                </div>
              )}
            </div>

            {/* RIGHT: Properties sidebar */}
            <div className={cn(
              "p-5 space-y-4 bg-muted/10 overflow-y-auto",
              isMobile && "border-t border-border/30"
            )}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propriedades</h4>

              {/* Client */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Cliente
                </Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Formato
                </Label>
                <Select value={contentType} onValueChange={(v) => setContentType(v as ContentTypeKey)}>
                  <SelectTrigger className="h-8 text-sm">
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

              {/* Platforms */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Publicar em</Label>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_PUBLISH_PLATFORMS.map((p) => {
                    const status = getPlatformStatus(p.value as any);
                    const isConnected = status?.hasApi && status?.isValid;
                    const isSelected = selectedPlatforms.includes(p.value);
                    const IconComponent = platformLucideIcons[p.value];
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => togglePlatform(p.value)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] font-medium transition-all",
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
                            className="h-3 w-3 shrink-0"
                            style={isSelected ? { color: p.brandColor } : undefined}
                          />
                        )}
                        <span className="truncate">{p.label}</span>
                        {isSelected && (
                          <Check className="h-2.5 w-2.5 ml-auto shrink-0" style={{ color: p.brandColor }} />
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedPlatforms.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {publishablePlatforms.length} de {selectedPlatforms.length} conectada(s)
                  </p>
                )}
                {selectedPlatforms.includes('threads') && content.length > 500 && (
                  <p className="text-[10px] text-amber-500 font-medium">
                    ⚠️ Threads: {content.length}/500 caracteres
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/30" />

              {/* Date/Time */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="h-3 w-3" />
                  Data e hora
                </Label>
                <div className="flex gap-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("flex-1 justify-start h-8 text-xs", !scheduledAt && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1.5 h-3 w-3" />
                        {scheduledAt ? format(scheduledAt, 'dd/MM/yyyy') : 'Sem data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={scheduledAt} onSelect={setScheduledAt} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="h-8 w-[80px] text-xs"
                      disabled={!scheduledAt}
                    />
                  </div>
                </div>
                {scheduledAt && publishablePlatforms.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    ✓ Auto-publicar em {publishablePlatforms.length} plataforma(s) às {scheduledTime}
                  </p>
                )}
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Responsável
                </Label>
                <Select value={assignedTo || 'none'} onValueChange={(val) => setAssignedTo(val === 'none' ? '' : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Nenhum">
                      {assignedTo ? (
                        <span className="flex items-center gap-1.5">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px]">
                              {(members.find(m => m.user_id === assignedTo)?.profile?.full_name?.[0] || '?').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {members.find(m => m.user_id === assignedTo)?.profile?.full_name || 'Membro'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Nenhum</span>
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

              {/* Column */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Coluna</Label>
                <Select value={columnId} onValueChange={setColumnId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Flag className="h-3 w-3" />
                  Prioridade
                </Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as PlanningPriority)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recurrence */}
              <div className="space-y-1.5">
                <RecurrenceConfig
                  value={recurrenceConfig}
                  onChange={setRecurrenceConfig}
                />
              </div>
            </div>
          </div>

          {/* Footer - Actions */}
          <div className="px-6 py-3 border-t border-border/40 flex items-center justify-between gap-2 bg-background">
            {/* Left: Approval actions when in review */}
            <div className="flex items-center gap-2">
              {!readOnly && effectiveItem?.status === 'review' && onUpdate && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-600"
                    onClick={async () => {
                      const approvedColumn = columns.find(c => c.column_type === 'approved');
                      await onUpdate(effectiveItem.id, { 
                        status: 'approved',
                        ...(approvedColumn ? { column_id: approvedColumn.id } : {})
                      });
                      toast.success('Item aprovado!');
                      onOpenChange(false);
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprovar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-orange-500/30 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600"
                    onClick={async () => {
                      const draftColumn = columns.find(c => c.column_type === 'draft');
                      await onUpdate(effectiveItem.id, { 
                        status: 'draft',
                        ...(draftColumn ? { column_id: draftColumn.id } : {})
                      });
                      toast.info('Item devolvido para ajustes');
                      onOpenChange(false);
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Pedir ajustes
                  </Button>
                </>
              )}
            </div>

            {/* Right: Standard actions */}
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {readOnly ? 'Fechar' : 'Cancelar'}
              </Button>
              {!readOnly && canPublishNow && (
                <Button 
                  type="button" 
                  variant="secondary"
                  size="sm"
                  onClick={handlePublishNow}
                  disabled={isPublishing || isSubmitting}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isPublishing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Publicar
                  {publishablePlatforms.length > 1 && (
                    <span className="flex items-center gap-0.5 ml-0.5">
                      {publishablePlatforms.slice(0, 3).map(pp => {
                        const Icon = platformLucideIcons[pp];
                        return Icon ? <Icon key={pp} className="h-3 w-3 opacity-80" /> : null;
                      })}
                    </span>
                  )}
                </Button>
              )}
              {!readOnly && (
                <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()}>
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  {item ? 'Salvar' : 'Criar'}
                </Button>
              )}
            </div>
          </div>
        </form>
        )}
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
