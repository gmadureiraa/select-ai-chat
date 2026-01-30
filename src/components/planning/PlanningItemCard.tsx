import { useState, useMemo, memo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MoreHorizontal, 
  Twitter, Linkedin, Instagram, Youtube, Mail, FileText, Video
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
  other: FileText,
};

const platformDotColors: Record<string, string> = {
  twitter: 'bg-sky-500',
  linkedin: 'bg-blue-600',
  instagram: 'bg-pink-500',
  youtube: 'bg-red-500',
  newsletter: 'bg-amber-500',
  blog: 'bg-emerald-500',
  tiktok: 'bg-foreground',
  other: 'bg-muted-foreground',
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
  const PlatformIcon = platformIcons[platform] || FileText;
  const dotColor = platformDotColors[platform] || 'bg-muted-foreground';

  const displayDate = item.scheduled_at || item.due_date;
  const isFailed = item.status === 'failed';
  const isPublished = item.status === 'published';

  const publicationMode = useMemo(() => {
    return getPublicationMode(item.platform);
  }, [item.platform, getPublicationMode]);

  const platformStatus = useMemo(() => {
    return getPlatformStatus(item.platform);
  }, [item.platform, getPlatformStatus]);

  const hasMedia = item.media_urls && item.media_urls.length > 0;

  return (
    <div
      className={cn(
        "group bg-card border border-border/40 rounded-lg overflow-hidden cursor-pointer",
        "transition-all duration-150 ease-out",
        "hover:border-border hover:shadow-sm hover:ring-1 hover:ring-primary/10",
        isDragging && "opacity-50 shadow-lg rotate-1",
        isFailed && "border-destructive/30 hover:border-destructive/50",
        isPublished && "border-emerald-500/20 hover:border-emerald-500/30"
      )}
      onClick={() => {
        if (!lightboxOpen) onEdit(item);
      }}
    >
      <div className="p-2.5">
        {/* Row 1: Platform dot + Title + Menu */}
        <div className="flex items-start gap-2">
          {/* Platform indicator - small dot */}
          <div className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", dotColor)} />
          
          {/* Title */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {item.title}
            </h4>
          </div>

          {/* Menu */}
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-0.5"
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

        {/* Row 2: Description - muted */}
        {(item.description || item.content) && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 ml-3.5">
            {item.description || item.content}
          </p>
        )}

        {/* Row 3: Footer metadata */}
        <div className="flex items-center justify-between mt-2.5 ml-3.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            {/* Platform icon */}
            <PlatformIcon className="h-3 w-3" />
            
            {/* Date */}
            {displayDate && (
              <span className="text-[10px]">
                {format(parseISO(displayDate), 'dd/MM', { locale: ptBR })}
              </span>
            )}

            {/* Client name dot */}
            {item.clients && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-[10px] truncate max-w-[60px]">
                  {item.clients.name}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Status badge - compact */}
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
                  <Avatar className="h-4 w-4 border border-border">
                    <AvatarFallback className="text-[8px] bg-muted">
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
