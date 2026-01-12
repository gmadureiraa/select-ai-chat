import { useState, useMemo, memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, Clock, Library, 
  MoreHorizontal, Trash2, Copy, BookOpen, RefreshCw,
  Twitter, Linkedin, Instagram, Youtube, Mail, FileText, Video,
  Image as ImageIcon, MessageSquare
} from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
  TooltipProvider,
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

const platformColors: Record<string, { bg: string; text: string; border: string }> = {
  twitter: { bg: 'bg-sky-500/10', text: 'text-sky-600', border: 'border-sky-500/30' },
  linkedin: { bg: 'bg-blue-600/10', text: 'text-blue-600', border: 'border-blue-600/30' },
  instagram: { bg: 'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10', text: 'text-pink-600', border: 'border-pink-500/30' },
  youtube: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30' },
  newsletter: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30' },
  blog: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/30' },
  tiktok: { bg: 'bg-slate-800/10', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-800/30' },
  other: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
};

const priorityConfig: Record<string, { color: string; icon: string }> = {
  low: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: '⬇️' },
  medium: { color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300', icon: '➡️' },
  high: { color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300', icon: '⬆️' },
  urgent: { color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300', icon: '🔥' },
};

const statusProgress: Record<string, number> = {
  idea: 10,
  draft: 30,
  review: 50,
  approved: 70,
  scheduled: 85,
  publishing: 95,
  published: 100,
  failed: 85,
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
  const colors = platformColors[platform] || platformColors.other;

  const displayDate = item.scheduled_at || item.due_date;
  const isScheduled = !!item.scheduled_at;
  const isFailed = item.status === 'failed';
  const isPublished = item.status === 'published';

  const publicationMode = useMemo(() => {
    return getPublicationMode(item.platform);
  }, [item.platform, getPublicationMode]);

  const platformStatus = useMemo(() => {
    return getPlatformStatus(item.platform);
  }, [item.platform, getPlatformStatus]);

  const progress = statusProgress[item.status] || 0;
  const characterCount = (item.content || item.description || '').length;
  const twitterLimit = 280;
  const isOverLimit = platform === 'twitter' && characterCount > twitterLimit;

  // Media preview
  const hasMedia = item.media_urls && item.media_urls.length > 0;
  const firstMedia = hasMedia ? item.media_urls[0] : null;

  return (
    <div
      className={cn(
        "group bg-card border border-border/50 rounded-lg overflow-hidden cursor-pointer transition-all duration-150",
        "hover:shadow-md hover:border-border",
        isDragging && "opacity-60 rotate-1 shadow-lg scale-105",
        isFailed && "border-destructive/30 bg-destructive/5",
        isPublished && "border-emerald-500/20 bg-emerald-500/5",
        compact && "p-2"
      )}
      onClick={() => {
        if (!lightboxOpen) {
          onEdit(item);
        }
      }}
    >
      {/* Media Preview - Only if not compact */}
      {hasMedia && firstMedia && !compact && (
        <div 
          className="relative h-20 bg-muted overflow-hidden cursor-zoom-in"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLightboxOpen(true);
          }}
        >
          <img 
            src={firstMedia} 
            alt="" 
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
          />
          {item.media_urls.length > 1 && (
            <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5">
              <ImageIcon className="h-2.5 w-2.5" />
              {item.media_urls.length}
            </div>
          )}
        </div>
      )}

      <div className={cn(compact ? "" : "p-2.5")}>
        {/* Top Row: Platform dot + Title */}
        <div className="flex items-start gap-2 mb-1.5">
          {/* Platform Dot */}
          <div className={cn(
            "w-2 h-2 rounded-full mt-1.5 shrink-0",
            platformColors[platform]?.text?.replace('text-', 'bg-') || 'bg-muted-foreground'
          )} />
          
          {/* Title */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {item.title}
            </h4>
            {/* Client name - subtle */}
            {item.clients && (
              <span className="text-[10px] text-muted-foreground">
                {item.clients.name}
              </span>
            )}
          </div>

          {/* Publication Mode Badge - Compact */}
          <PublicationStatusBadge
            mode={publicationMode}
            status={item.status}
            errorMessage={item.error_message}
            retryCount={item.retry_count}
            accountName={platformStatus?.accountName}
            onRetry={onRetry ? () => onRetry(item.id) : undefined}
            compact
          />
        </div>

        {/* Description - Only if not compact */}
        {!compact && (item.description || item.content) && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5 ml-4">
            {item.description || item.content}
          </p>
        )}

        {/* Labels as dots */}
        {item.labels && item.labels.length > 0 && !compact && (
          <div className="flex items-center gap-1 mb-1.5 ml-4">
            {item.labels.slice(0, 4).map((label, i) => (
              <TooltipProvider key={i}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {item.labels.length > 4 && (
              <span className="text-[9px] text-muted-foreground">+{item.labels.length - 4}</span>
            )}
          </div>
        )}

        {/* Footer - Compact */}
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-dashed border-border/50 ml-4">
          <div className="flex items-center gap-1.5">
            <PlatformIcon className={cn("h-3 w-3", colors.text)} />
            {displayDate && (
              <span className="text-[9px] text-muted-foreground">
                {format(new Date(displayDate), 'dd/MM', { locale: ptBR })}
              </span>
            )}
            {/* Assignee Avatar */}
            {item.assigned_to && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-4 w-4 border border-border/50">
                      <AvatarFallback className="text-[8px] bg-primary/10">
                        👤
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Responsável atribuído</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => { onEdit(item); setIsMenuOpen(false); }}>Editar</DropdownMenuItem>
              {onDuplicate && <DropdownMenuItem onClick={() => { onDuplicate(item); setIsMenuOpen(false); }}>Duplicar</DropdownMenuItem>}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => { onDelete(item.id); setIsMenuOpen(false); }}>Excluir</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Lightbox for media preview - Outside of card to prevent event conflicts */}
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
