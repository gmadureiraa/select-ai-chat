import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday as isDateToday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, AlertCircle, CheckCircle2, Bot, FileEdit, RefreshCw, Calendar as CalendarIcon, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import type { PlanningItem } from '@/hooks/usePlanningItems';
import { useClientPlatformStatus, type SupportedPlatform } from '@/hooks/useClientPlatformStatus';
import { EmptyState } from './EmptyState';

interface CalendarViewProps {
  items: PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onAddItem: (date: Date) => void;
  onDeleteItem: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  onMoveItem?: (itemId: string, newDate: Date) => void;
  canEdit?: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  idea: { 
    bg: 'bg-purple-100 dark:bg-purple-900/50', 
    text: 'text-purple-800 dark:text-purple-200',
    border: 'border-purple-300 dark:border-purple-700',
    dot: 'bg-purple-500'
  },
  draft: { 
    bg: 'bg-blue-100 dark:bg-blue-900/50', 
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    dot: 'bg-blue-500'
  },
  review: { 
    bg: 'bg-amber-100 dark:bg-amber-900/50', 
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-500'
  },
  approved: { 
    bg: 'bg-emerald-100 dark:bg-emerald-900/50', 
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-500'
  },
  scheduled: { 
    bg: 'bg-orange-100 dark:bg-orange-900/50', 
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-300 dark:border-orange-700',
    dot: 'bg-orange-500'
  },
  publishing: { 
    bg: 'bg-orange-100 dark:bg-orange-900/50', 
    text: 'text-orange-700 dark:text-orange-200',
    border: 'border-orange-300 dark:border-orange-700',
    dot: 'bg-orange-400 animate-pulse'
  },
  published: { 
    bg: 'bg-green-100 dark:bg-green-900/50', 
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-300 dark:border-green-700',
    dot: 'bg-green-500'
  },
  failed: { 
    bg: 'bg-red-100 dark:bg-red-900/50', 
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-300 dark:border-red-700',
    dot: 'bg-red-500 animate-pulse'
  },
};

const platformIcons: Record<string, string> = {
  instagram: '📸',
  twitter: '𝕏',
  linkedin: '💼',
  youtube: '🎬',
  newsletter: '📧',
  blog: '📝',
  tiktok: '🎵',
  threads: '🧵',
  facebook: '📘',
  other: '📱',
};

function CalendarCard({ 
  item, 
  onEdit, 
  onRetry,
  onDelete,
  canEdit = true,
  onDragStart,
  isDragging 
}: { 
  item: PlanningItem; 
  onEdit: () => void; 
  onRetry?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  onDragStart?: (e: React.DragEvent, item: PlanningItem) => void;
  isDragging?: boolean;
}) {
  const { canAutoPublish } = useClientPlatformStatus(item.client_id);
  const platform = item.platform as SupportedPlatform | null;
  const isAutoPublish = canAutoPublish(platform);
  const config = statusConfig[item.status] || statusConfig.idea;
  
  const effectiveDate = item.scheduled_at || item.published_at;
  const scheduledTime = effectiveDate ? format(parseISO(effectiveDate), 'HH:mm') : null;
  const scheduledDate = effectiveDate ? parseISO(effectiveDate) : null;
  const daysUntil = scheduledDate ? differenceInDays(scheduledDate, new Date()) : null;
  
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          draggable={canEdit}
          onDragStart={(e) => onDragStart?.(e, item)}
          className={cn(
            "group/card relative px-2.5 py-2 rounded-md border-l-[3px] border transition-all duration-200",
            "hover:shadow-md hover:scale-[1.01]",
            config.bg, config.text, config.border,
            isDragging && "opacity-50 scale-95",
            canEdit && "cursor-grab active:cursor-grabbing"
          )}
          onClick={(e) => { e.stopPropagation(); if (canEdit) onEdit(); }}
        >
          {/* Row 1: Platform + Time */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full shrink-0", config.dot)} />
              {item.platform && (
                <span className="text-xs shrink-0">{platformIcons[item.platform] || '📱'}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {scheduledTime && (
                <span className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md shrink-0 font-semibold tabular-nums">
                  {scheduledTime}
                </span>
              )}
              {item.status === 'failed' && onRetry && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                  className="shrink-0 hover:scale-110 transition-transform"
                >
                  <RefreshCw className="h-3 w-3 text-red-500" />
                </button>
              )}
              {item.status === 'published' && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
              {isAutoPublish && item.status === 'scheduled' && (
                <Bot className="h-3 w-3 shrink-0 text-primary/60" />
              )}
              {canEdit && onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity hover:scale-110 text-muted-foreground hover:text-red-500"
                  title="Excluir card"
                  aria-label="Excluir card"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          
          {/* Row 2: Title */}
          <span className="text-[11px] font-semibold truncate block leading-snug">
            {item.title}
          </span>
          
          {/* Row 3: Client */}
          {item.clients && (
            <span className="text-[10px] text-muted-foreground truncate block mt-0.5">
              {item.clients.name}
            </span>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-72 p-0 overflow-hidden">
        {/* Header with platform gradient */}
        <div className={cn(
          "px-3 py-2 border-b",
          config.bg, config.border
        )}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold truncate flex-1">{item.title}</span>
            {isAutoPublish ? (
              <Badge variant="outline" className="text-[9px] h-4 bg-green-100 text-green-700 border-green-300 shrink-0">
                <Bot className="h-2 w-2 mr-0.5" />
                Auto
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] h-4 bg-amber-100 text-amber-700 border-amber-300 shrink-0">
                <FileEdit className="h-2 w-2 mr-0.5" />
                Manual
              </Badge>
            )}
          </div>
        </div>
        
        {/* Content preview */}
        <div className="px-3 py-2 space-y-2">
          {item.clients && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-semibold">
                {item.clients.name.charAt(0)}
              </div>
              {item.clients.name}
            </div>
          )}
          
          <div className="flex items-center gap-3 text-xs">
            {item.platform && (
              <span className="flex items-center gap-1">
                <span>{platformIcons[item.platform]}</span>
                {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
              </span>
            )}
            {(item.scheduled_at || item.published_at) && (
              <span className={cn("flex items-center gap-1", item.published_at && !item.scheduled_at ? "text-emerald-600" : "text-orange-600")}>
                <Clock className="h-3 w-3" />
                {format(parseISO((item.scheduled_at || item.published_at)!), "dd/MM HH:mm")}
              </span>
            )}
          </div>
          
          {/* Countdown badge for scheduled items */}
          {daysUntil !== null && item.status === 'scheduled' && (
            <div className={cn(
              "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full",
              daysUntil === 0 && "bg-orange-100 text-orange-700",
              daysUntil === 1 && "bg-amber-100 text-amber-700",
              daysUntil > 1 && "bg-muted text-muted-foreground"
            )}>
              <Sparkles className="h-2.5 w-2.5" />
              {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `Em ${daysUntil} dias`}
            </div>
          )}
          
          {item.status === 'failed' && item.error_message && (
            <div className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/50 p-1.5 rounded border border-red-200 dark:border-red-800">
              <AlertCircle className="h-2.5 w-2.5 inline mr-1" />
              {item.error_message}
            </div>
          )}
          
          {item.content && (
            <p className="text-[11px] text-muted-foreground line-clamp-3 border-t pt-2 leading-relaxed">
              {item.content.substring(0, 150)}{item.content.length > 150 ? '...' : ''}
            </p>
          )}
        </div>
        
        {/* Footer */}
        {canEdit && (
          <div className="px-3 py-1.5 bg-muted/30 border-t text-[9px] text-muted-foreground flex items-center justify-between">
            <span>Clique para editar</span>
            <span>Arraste para mover</span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export function CalendarView({
  items,
  onEditItem,
  onAddItem,
  onDeleteItem,
  onMoveToLibrary,
  onRetry,
  onMoveItem,
  canEdit = true,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedItem, setDraggedItem] = useState<PlanningItem | null>(null);
  const [dragOverDay, setDragOverDay] = useState<Date | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<PlanningItem | null>(null);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getItemsForDay = useCallback((day: Date) => {
    return items.filter(item => {
      const itemDate = item.scheduled_at || item.published_at || item.due_date;
      if (!itemDate) return false;
      const parsedDate = typeof itemDate === 'string' ? parseISO(itemDate) : itemDate;
      return isSameDay(parsedDate, day);
    }).sort((a, b) => {
      const timeA = (a.scheduled_at || a.published_at) ? parseISO(a.scheduled_at || a.published_at!).getTime() : 0;
      const timeB = (b.scheduled_at || b.published_at) ? parseISO(b.scheduled_at || b.published_at!).getTime() : 0;
      return timeA - timeB;
    });
  }, [items]);

  // Count items by status for summary
  const monthStats = useMemo(() => {
    const stats = { scheduled: 0, published: 0, failed: 0, total: 0 };
    days.forEach(day => {
      if (isSameMonth(day, currentDate)) {
        const dayItems = getItemsForDay(day);
        stats.total += dayItems.length;
        dayItems.forEach(item => {
          if (item.status === 'scheduled') stats.scheduled++;
          if (item.status === 'published') stats.published++;
          if (item.status === 'failed') stats.failed++;
        });
      }
    });
    return stats;
  }, [days, getItemsForDay, currentDate]);

  const handleDragStart = useCallback((e: React.DragEvent, item: PlanningItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, day: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(day);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDay(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragOverDay(null);
    
    if (draggedItem && onMoveItem) {
      const itemDate = draggedItem.scheduled_at || draggedItem.published_at || draggedItem.due_date;
      if (itemDate) {
        const parsedDate = typeof itemDate === 'string' ? parseISO(itemDate) : itemDate;
        if (isSameDay(parsedDate, day)) {
          setDraggedItem(null);
          return;
        }
      }
      
      onMoveItem(draggedItem.id, day);
    }
    
    setDraggedItem(null);
  }, [draggedItem, onMoveItem]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverDay(null);
  }, []);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h3>
        </div>
        
        {/* Stats badges - minimal */}
        <div className="flex items-center gap-2">
          {monthStats.total > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium">{monthStats.total}</span>
              <span>itens</span>
            </div>
          )}
          {monthStats.scheduled > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-orange-500" />
              <span className="text-xs font-medium">{monthStats.scheduled}</span>
            </div>
          )}
          {monthStats.published > 0 && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-medium">{monthStats.published}</span>
            </div>
          )}
          {monthStats.failed > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span className="text-xs font-medium">{monthStats.failed}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 text-xs font-medium" 
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border border-border/50 rounded-xl overflow-auto bg-card/50 backdrop-blur-sm min-h-0">
        {/* Week Header */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30">
          {weekDays.map((day, i) => (
            <div 
              key={day} 
              className={cn(
                "py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                i < 6 && "border-r border-border/30"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(140px, auto)' }}>
          {days.map((day, i) => {
            const dayItems = getItemsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isDateToday(day);
            const isDragOver = dragOverDay && isSameDay(dragOverDay, day);
            const hasItems = dayItems.length > 0;
            const row = Math.floor(i / 7);
            const col = i % 7;
            const isLastRow = row === Math.floor((days.length - 1) / 7);

            return (
              <div
                key={i}
                className={cn(
                  "relative p-1.5 transition-all duration-150 group",
                  col < 6 && "border-r border-border/30",
                  !isLastRow && "border-b border-border/30",
                  !isCurrentMonth && "bg-muted/5",
                  isToday && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                  isDragOver && "bg-primary/10 ring-1 ring-primary/40 ring-inset",
                  canEdit && "hover:bg-muted/20 cursor-pointer"
                )}
                onClick={() => canEdit && onAddItem(day)}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <span className={cn(
                    "text-[11px] font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200",
                    isToday && "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/40 scale-110",
                    !isToday && !isCurrentMonth && "text-muted-foreground/50",
                    !isToday && isCurrentMonth && "text-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Add button */}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity",
                        hasItems && "opacity-20"
                      )}
                      onClick={(e) => { e.stopPropagation(); onAddItem(day); }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Items */}
                <div className={cn(
                  "space-y-0.5",
                  expandedDay === format(day, 'yyyy-MM-dd') ? "overflow-visible" : "overflow-hidden"
                )}>
                  {(expandedDay === format(day, 'yyyy-MM-dd') ? dayItems : dayItems.slice(0, 3)).map(item => (
                    <CalendarCard
                      key={item.id}
                      item={item}
                      onEdit={() => onEditItem(item)}
                      onRetry={() => onRetry(item.id)}
                      onDelete={() => setItemToDelete(item)}
                      canEdit={canEdit}
                      onDragStart={handleDragStart}
                      isDragging={draggedItem?.id === item.id}
                    />
                  ))}
                  
                  {dayItems.length > 3 && expandedDay !== format(day, 'yyyy-MM-dd') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedDay(format(day, 'yyyy-MM-dd')); }}
                      className="w-full text-[9px] text-center py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                    >
                      +{dayItems.length - 3} mais
                    </button>
                  )}
                  
                  {dayItems.length > 3 && expandedDay === format(day, 'yyyy-MM-dd') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedDay(null); }}
                      className="w-full text-[9px] text-center py-0.5 text-primary hover:text-primary/80 hover:bg-muted/50 rounded transition-colors font-medium"
                    >
                      ver menos
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{itemToDelete?.title || 'este item'}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  onDeleteItem(itemToDelete.id);
                  setItemToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
