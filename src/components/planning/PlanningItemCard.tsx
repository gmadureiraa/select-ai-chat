import { useState, useMemo, memo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MoreHorizontal, 
  Twitter, Linkedin, Instagram, Youtube, Mail, FileText, Video, Facebook, AtSign,
  Calendar, MessageSquare, Image as ImageIcon, Flag
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
import { PLATFORM_COLOR_MAP } from '@/types/contentTypes';
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
      {/* Media thumbnail preview */}
      {isImage && firstMediaUrl && (
        <div className="relative w-full h-32 bg-muted/30 overflow-hidden">
          <img
            src={firstMediaUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {item.media_urls.length > 1 && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              <ImageIcon className="h-2.5 w-2.5" />
              {item.media_urls.length}
            </div>
          )}
        </div>
      )}

      <div className="p-3.5">
        {/* Row 1: Platform badges */}
        <div className="flex items-center gap-1.5 mb-2">
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
