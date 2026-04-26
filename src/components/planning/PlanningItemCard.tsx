import { useState, useMemo, memo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MoreHorizontal, 
  Twitter, Linkedin, Instagram, Youtube, Mail, FileText, Video, Facebook, AtSign,
  Calendar, MessageSquare, Image as ImageIcon, Flag, Layers
} from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PublicationStatusBadge } from './PublicationStatusBadge';
import { useClientPlatformStatus } from '@/hooks/useClientPlatformStatus';
import { PLATFORM_COLOR_MAP, getContentTypeLabel } from '@/types/contentTypes';
import type { PlanningItem } from '@/hooks/usePlanningItems';

interface PlanningItemCardProps {
  item: PlanningItem;
  onEdit: (item: PlanningItem) => void;
  onDelete: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry?: (id: string) => void;
  onDuplicate?: (item: PlanningItem) => void;
  isDragging?: boolean;
  compact?: boolean;
  canDelete?: boolean;
}

const platformIcons: Record<string, React.ElementType> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  newsletter: Mail,
  blog: FileText,
  tiktok: Video,
  facebook: Facebook,
  threads: AtSign,
  other: FileText,
};

const platformLabels: Record<string, string> = {
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  newsletter: 'Newsletter',
  blog: 'Blog',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  threads: 'Threads',
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: 'text-red-500', label: 'Alta' },
  medium: { color: 'text-amber-500', label: 'Média' },
  low: { color: 'text-blue-400', label: 'Baixa' },
};

export const PlanningItemCard = memo(function PlanningItemCard({
  item,
  onEdit,
  onDelete,
  onMoveToLibrary,
  onRetry,
  onDuplicate,
  isDragging = false,
  compact = false,
  canDelete = true
}: PlanningItemCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { getPublicationMode, getPlatformStatus } = useClientPlatformStatus(item.client_id);
  
  const platform = item.platform || 'other';
  const metadata = item.metadata as any || {};
  const targetPlatforms: string[] = metadata.target_platforms?.length > 0
    ? metadata.target_platforms
    : [platform];
  const primaryPlatform = targetPlatforms[0] || platform;
  const dotColor = PLATFORM_COLOR_MAP[primaryPlatform] || '#888';
  const contentType = metadata.content_type || (item as any).content_type;
  const contentTypeLabel = contentType ? getContentTypeLabel(contentType) : null;
  const viralCarouselId: string | undefined = metadata.viral_carousel_id;
  const viralSlides: Array<{ body: string; image?: { kind: string; url?: string }; editorial?: { headline?: string; kicker?: string; subtitle?: string } }> | undefined = metadata.viral_carousel_slides;
  const isViralCarousel = contentType === 'viral_carousel' || !!viralCarouselId;
  const viralCoverImage = viralSlides?.[0]?.image && viralSlides[0].image.kind !== 'none' ? viralSlides[0].image.url : undefined;
  const viralEditorial = viralSlides?.[0]?.editorial;

  const displayDate = item.scheduled_at || item.published_at || item.due_date;
  const isFailed = item.status === 'failed';
  const isPublished = item.status === 'published';
  const priority = (item as any).priority;

  const publicationMode = useMemo(() => {
    return getPublicationMode(item.platform);
  }, [item.platform, getPublicationMode]);

  const platformStatus = useMemo(() => {
    return getPlatformStatus(item.platform);
  }, [item.platform, getPlatformStatus]);

  const hasMedia = item.media_urls && item.media_urls.length > 0;
  const firstMediaUrl = hasMedia ? item.media_urls[0] : null;
  const isImage = firstMediaUrl && !firstMediaUrl.match(/\.(mp4|webm|mov)$/i);

  return (
    <div
      className={cn(
        "group bg-card border border-border/50 rounded-lg overflow-hidden cursor-pointer",
        "transition-all duration-150 ease-out",
        "hover:border-border hover:shadow-md hover:ring-1 hover:ring-primary/10",
        isDragging && "opacity-50 shadow-lg rotate-1",
        isFailed && "border-destructive/30 hover:border-destructive/50",
        isPublished && "border-emerald-500/20 hover:border-emerald-500/30"
      )}
      onClick={() => {
        if (!lightboxOpen) onEdit(item);
      }}
    >
      {/* Media thumbnail preview (multiplos = strip carrossel) */}
      {isImage && firstMediaUrl && (
        <div className="relative w-full bg-muted/30 overflow-hidden border-b border-border/30">
          {item.media_urls.length > 1 ? (
            <div className="flex h-32 gap-px">
              {item.media_urls.slice(0, 4).map((url, i) => (
                <div key={i} className="relative flex-1 min-w-0 overflow-hidden">
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  {i === 3 && item.media_urls.length > 4 && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xs font-semibold">
                      +{item.media_urls.length - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <img src={firstMediaUrl} alt="" loading="lazy" className="w-full h-32 object-cover" />
          )}
          <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1">
            <Layers className="h-2.5 w-2.5" />
            {item.media_urls.length} {item.media_urls.length > 1 ? 'imagens' : 'imagem'}
          </div>
        </div>
      )}

      {/* Viral carousel preview (sem mídia upload — mostra capa + tira de slides) */}
      {!isImage && isViralCarousel && viralSlides && viralSlides.length > 0 && (
        <div className="relative w-full border-b border-border/30 overflow-hidden bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-background">
          {/* Cover hero */}
          <div className="relative h-32 overflow-hidden">
            {viralCoverImage ? (
              <>
                <img src={viralCoverImage} alt="" loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  {viralEditorial?.kicker && (
                    <div className="text-[8px] font-bold tracking-[0.18em] text-white/90 uppercase mb-0.5">
                      {viralEditorial.kicker}
                    </div>
                  )}
                  <div className="text-[11px] font-bold leading-tight text-white line-clamp-2 font-serif">
                    {viralEditorial?.headline || viralSlides[0].body?.replace(/\*\*(.+?)\*\*/g, '$1')}
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-sky-500/15 to-sky-500/5 px-3">
                <p className="text-[12px] leading-snug line-clamp-3 text-foreground/85 font-medium text-center">
                  {viralEditorial?.headline || viralSlides[0]?.body?.replace(/\*\*(.+?)\*\*/g, '$1') || 'Sem preview'}
                </p>
              </div>
            )}
            <div className="absolute top-1.5 left-1.5 bg-sky-500/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-sm">
              <Layers className="h-2.5 w-2.5" />
              {viralSlides.length} slides
            </div>
          </div>
          {/* Strip de mini-slides */}
          <div className="flex gap-0.5 px-1.5 py-1.5 bg-background/40">
            {viralSlides.slice(0, 8).map((s, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-1.5 rounded-sm",
                  i === 0 ? "bg-sky-500" : "bg-muted-foreground/25",
                )}
                title={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="p-3.5">
        {/* Row 1: Platform badges + content type */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {/* Content type badge */}
          {contentTypeLabel && (
            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded border",
                isViralCarousel
                  ? "bg-sky-500/15 border-sky-500/40"
                  : "bg-primary/10 border-primary/20",
              )}
            >
              {isViralCarousel && <Layers className="h-2.5 w-2.5 text-sky-600 dark:text-sky-400" />}
              <span
                className={cn(
                  "text-[10px] font-semibold",
                  isViralCarousel ? "text-sky-700 dark:text-sky-400" : "text-primary",
                )}
              >
                {contentTypeLabel}
              </span>
            </div>
          )}

          {targetPlatforms.slice(0, 3).map((tp) => {
            const Icon = platformIcons[tp] || FileText;
            const color = PLATFORM_COLOR_MAP[tp];
            return (
              <div
                key={tp}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border/30"
              >
                <Icon
                  className="h-3 w-3"
                  style={color ? { color } : undefined}
                />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {platformLabels[tp] || tp}
                </span>
              </div>
            );
          })}
          {targetPlatforms.length > 3 && (
            <span className="text-[10px] text-muted-foreground font-medium px-1">
              +{targetPlatforms.length - 3}
            </span>
          )}

          {/* Menu - pushed to right */}
          <div className="ml-auto">
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => { onEdit(item); setIsMenuOpen(false); }}>
                  Editar
                </DropdownMenuItem>
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => { onDuplicate(item); setIsMenuOpen(false); }}>
                    Duplicar
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive" 
                      onClick={() => { onDelete(item.id); setIsMenuOpen(false); }}
                    >
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: Title */}
        <h4 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-1.5">
          {item.title}
        </h4>

        {/* Row 3: Description */}
        {(item.description || item.content) && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">
            {item.description || item.content}
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-border/30 pt-2.5" />

        {/* Row 4: Footer metadata */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            {/* Priority flag */}
            {priority && priorityConfig[priority] && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Flag className={cn("h-3.5 w-3.5", priorityConfig[priority].color)} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Prioridade {priorityConfig[priority].label}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Date */}
            {displayDate && (
              <div className="flex items-center gap-1 text-[11px]">
                <Calendar className="h-3 w-3" />
                <span>{format(parseISO(displayDate), 'dd MMM', { locale: ptBR })}</span>
              </div>
            )}

            {/* Client name */}
            {item.clients && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-[11px] truncate max-w-[80px]">
                  {item.clients.name}
                </span>
              </>
            )}

            {/* Media count if not shown as thumbnail */}
            {hasMedia && !isImage && (
              <div className="flex items-center gap-0.5 text-[11px]">
                <ImageIcon className="h-3 w-3" />
                <span>{item.media_urls.length}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            <PublicationStatusBadge
              mode={publicationMode}
              status={item.status}
              errorMessage={item.error_message}
              retryCount={item.retry_count}
              accountName={platformStatus?.accountName}
              scheduledAt={item.scheduled_at}
              lateConfirmed={!!(item.external_post_id || (item.metadata as any)?.late_confirmed)}
              onRetry={onRetry ? () => onRetry(item.id) : undefined}
              compact
            />

            {/* Assignee */}
            {item.assigned_to && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-5 w-5 border border-border">
                    <AvatarFallback className="text-[9px] bg-muted">
                      👤
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Responsável
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {hasMedia && (
        <ImageLightbox
          images={item.media_urls.map(url => ({
            url,
            type: url.match(/\.(mp4|webm|mov)$/i) ? 'video' as const : 'image' as const
          }))}
          initialIndex={0}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </div>
  );
});

PlanningItemCard.displayName = 'PlanningItemCard';
