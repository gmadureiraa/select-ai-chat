import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, Clock, Library, 
  MoreHorizontal, Trash2, Copy, BookOpen, RefreshCw,
  Twitter, Linkedin, Instagram, Youtube, Mail, FileText, Video,
  Image as ImageIcon, MessageSquare
} from 'lucide-react';
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

export function PlanningItemCard({
  item,
  onEdit,
  onDelete,
  onMoveToLibrary,
  onRetry,
  onDuplicate,
  isDragging = false,
  compact = false
}: PlanningItemCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
        "group bg-card border rounded-xl overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5",
        isDragging && "opacity-60 rotate-1 shadow-xl scale-105",
        isFailed && "border-destructive/50 bg-destructive/5",
        isPublished && "border-green-500/30 bg-green-500/5"
      )}
      onClick={() => onEdit(item)}
    >
      {/* Media Preview */}
      {hasMedia && firstMedia && !compact && (
        <div className="relative h-24 bg-muted overflow-hidden">
          <img 
            src={firstMedia} 
            alt="" 
            className="w-full h-full object-cover"
          />
          {item.media_urls.length > 1 && (
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {item.media_urls.length}
            </div>
          )}
        </div>
      )}

      <div className="p-3">
        {/* Top Row: Platform + Client + Publication Mode */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Platform Badge */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full border",
              colors.bg, colors.text, colors.border
            )}>
              <PlatformIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium capitalize">{platform}</span>
            </div>

            {/* Client */}
            {item.clients && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={item.clients.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-primary/10">
                    {item.clients.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  {item.clients.name}
                </span>
              </div>
            )}
          </div>

          {/* Publication Mode Badge */}
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

        {/* Title */}
        <h4 className="font-semibold text-sm mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h4>

        {/* Description/Content Preview */}
        {!compact && (item.description || item.content) && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {item.description || item.content}
          </p>
        )}

        {/* Character Count for Twitter */}
        {!compact && platform === 'twitter' && characterCount > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
            <span className={cn(
              "text-xs",
              isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
            )}>
              {characterCount}/{twitterLimit}
            </span>
            {isOverLimit && (
              <span className="text-[10px] text-destructive">
                -{characterCount - twitterLimit}
              </span>
            )}
          </div>
        )}

        {/* Labels */}
        {item.labels && item.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.labels.slice(0, 3).map((label, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                {label}
              </Badge>
            ))}
            {item.labels.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{item.labels.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {!compact && (
          <div className="mb-2">
            <Progress 
              value={progress} 
              className={cn(
                "h-1",
                isFailed && "[&>div]:bg-destructive",
                isPublished && "[&>div]:bg-green-500"
              )}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed">
          <div className="flex items-center gap-2">
            {/* Priority Badge */}
            {item.priority && item.priority !== 'medium' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className={cn("text-[10px] px-1.5 py-0", priorityConfig[item.priority]?.color)}>
                      {priorityConfig[item.priority]?.icon}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Prioridade: {item.priority}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Library Badge */}
            {item.added_to_library && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Library className="h-3.5 w-3.5 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>Na biblioteca</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Date */}
            {displayDate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
                      isScheduled 
                        ? "text-primary bg-primary/10" 
                        : "text-muted-foreground bg-muted"
                    )}>
                      {isScheduled ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                      {format(new Date(displayDate), 'dd/MM HH:mm', { locale: ptBR })}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isScheduled ? 'Agendado para ' : 'Prazo: '}
                    {format(new Date(displayDate), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Actions Menu */}
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
                  <FileText className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                
                {!item.added_to_library && item.client_id && (
                  <DropdownMenuItem onClick={() => { onMoveToLibrary(item.id); setIsMenuOpen(false); }}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Adicionar à Biblioteca
                  </DropdownMenuItem>
                )}

                {isFailed && onRetry && (
                  <DropdownMenuItem onClick={() => { onRetry(item.id); setIsMenuOpen(false); }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </DropdownMenuItem>
                )}

                {onDuplicate && (
                  <DropdownMenuItem onClick={() => { onDuplicate(item); setIsMenuOpen(false); }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => { onDelete(item.id); setIsMenuOpen(false); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
