import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, Clock, AlertCircle, CheckCircle2, Library, 
  MoreHorizontal, Trash2, Copy, BookOpen, RefreshCw,
  Twitter, Linkedin, Instagram, Youtube, Mail, FileText, Video
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

const platformColors: Record<string, string> = {
  twitter: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  linkedin: 'bg-blue-600/10 text-blue-600 border-blue-600/20',
  instagram: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  youtube: 'bg-red-500/10 text-red-600 border-red-500/20',
  newsletter: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  blog: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  tiktok: 'bg-slate-800/10 text-slate-800 border-slate-800/20',
  other: 'bg-muted text-muted-foreground border-border',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
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
  
  const PlatformIcon = item.platform ? platformIcons[item.platform] : FileText;
  const platformColor = item.platform ? platformColors[item.platform] : platformColors.other;

  const displayDate = item.scheduled_at || item.due_date;
  const isScheduled = !!item.scheduled_at;
  const isFailed = item.status === 'failed';
  const isPublished = item.status === 'published';

  return (
    <div
      className={cn(
        "group bg-card border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-50 rotate-2 shadow-lg",
        isFailed && "border-destructive/50 bg-destructive/5",
        isPublished && "border-green-500/30 bg-green-500/5"
      )}
      onClick={() => onEdit(item)}
    >
      {/* Client Badge */}
      {item.clients && (
        <div className="flex items-center gap-1.5 mb-2">
          <Avatar className="h-4 w-4">
            <AvatarImage src={item.clients.avatar_url || undefined} />
            <AvatarFallback className="text-[8px]">
              {item.clients.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{item.clients.name}</span>
        </div>
      )}

      {/* Title */}
      <h4 className="font-medium text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {item.title}
      </h4>

      {/* Description Preview */}
      {!compact && item.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {item.description}
        </p>
      )}

      {/* Labels */}
      {item.labels && item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {item.labels.slice(0, 3).map((label, i) => (
            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
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

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          {/* Platform Badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("p-1 rounded border", platformColor)}>
                  <PlatformIcon className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="capitalize">{item.platform || 'Sem plataforma'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Priority Badge */}
          {item.priority && item.priority !== 'medium' && (
            <Badge className={cn("text-[10px] px-1.5", priorityColors[item.priority])}>
              {item.priority === 'urgent' ? '🔥' : item.priority === 'high' ? '⬆️' : '⬇️'}
            </Badge>
          )}

          {/* Library Badge */}
          {item.added_to_library && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Library className="h-3 w-3 text-primary" />
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
                    "flex items-center gap-1 text-[10px]",
                    isScheduled ? "text-primary" : "text-muted-foreground"
                  )}>
                    {isScheduled ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                    {format(new Date(displayDate), 'dd/MM', { locale: ptBR })}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {isScheduled ? 'Agendado para ' : 'Prazo: '}
                  {format(new Date(displayDate), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Status Icons */}
          {isFailed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium text-destructive">Falha na publicação</p>
                  <p className="text-xs">{item.error_message || 'Erro desconhecido'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isPublished && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </TooltipTrigger>
                <TooltipContent>Publicado com sucesso</TooltipContent>
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
                <MoreHorizontal className="h-3 w-3" />
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
  );
}
