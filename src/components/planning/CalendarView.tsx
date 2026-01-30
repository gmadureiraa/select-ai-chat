import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday as isDateToday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, AlertCircle, CheckCircle2, Bot, FileEdit, RefreshCw, Calendar as CalendarIcon, MoreHorizontal, Sparkles } from 'lucide-react';
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
    bg: 'bg-purple-50 dark:bg-purple-950/30', 
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200/50 dark:border-purple-800/50',
    dot: 'bg-purple-500'
  },
  draft: { 
    bg: 'bg-blue-50 dark:bg-blue-950/30', 
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200/50 dark:border-blue-800/50',
    dot: 'bg-blue-500'
  },
  review: { 
    bg: 'bg-amber-50 dark:bg-amber-950/30', 
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/50 dark:border-amber-800/50',
    dot: 'bg-amber-500'
  },
  approved: { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/30', 
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/50 dark:border-emerald-800/50',
    dot: 'bg-emerald-500'
  },
  scheduled: { 
    bg: 'bg-orange-50 dark:bg-orange-950/30', 
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200/50 dark:border-orange-800/50',
    dot: 'bg-orange-500'
  },
  publishing: { 
    bg: 'bg-orange-50 dark:bg-orange-950/30', 
    text: 'text-orange-600 dark:text-orange-300',
    border: 'border-orange-200/50 dark:border-orange-800/50',
    dot: 'bg-orange-400 animate-pulse'
  },
  published: { 
    bg: 'bg-slate-50 dark:bg-slate-900/30', 
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200/50 dark:border-slate-700/50',
    dot: 'bg-slate-400'
  },
  failed: { 
    bg: 'bg-red-50 dark:bg-red-950/30', 
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200/50 dark:border-red-800/50',
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
  canEdit = true,
  onDragStart,
  isDragging 
}: { 
  item: PlanningItem; 
  onEdit: () => void; 
  onRetry?: () => void;
  canEdit?: boolean;
  onDragStart?: (e: React.DragEvent, item: PlanningItem) => void;
  isDragging?: boolean;
}) {
  const { canAutoPublish } = useClientPlatformStatus(item.client_id);
  const platform = item.platform as SupportedPlatform | null;
  const isAutoPublish = canAutoPublish(platform);
  const config = statusConfig[item.status] || statusConfig.idea;
  
  const scheduledTime = item.scheduled_at ? format(parseISO(item.scheduled_at), 'HH:mm') : null;
  const scheduledDate = item.scheduled_at ? parseISO(item.scheduled_at) : null;
  const daysUntil = scheduledDate ? differenceInDays(scheduledDate, new Date()) : null;
  
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          draggable={canEdit}
          onDragStart={(e) => onDragStart?.(e, item)}
          className={cn(
            "group/card relative px-2 py-1 rounded-md border transition-all duration-200",
            "hover:shadow-sm hover:scale-[1.02]",
            config.bg, config.text, config.border,
            isDragging && "opacity-50 scale-95",
            canEdit && "cursor-grab active:cursor-grabbing"
          )}
          onClick={(e) => { e.stopPropagation(); if (canEdit) onEdit(); }}
        >
          <div className="flex items-center gap-1.5">
            {/* Status dot */}
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
            
            {/* Platform icon */}
            {item.platform && (
              <span className="text-[10px] shrink-0">{platformIcons[item.platform] || '📱'}</span>
            )}
            
            {/* Title */}
            <span className="text-[10px] font-medium truncate flex-1 leading-tight">
              {item.title}
            </span>
            
            {/* Time badge */}
            {scheduledTime && (
              <span className="text-[8px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded shrink-0 font-medium tabular-nums">
                {scheduledTime}
              </span>
            )}
            
            {/* Status icons */}
            {item.status === 'failed' && onRetry && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
                className="shrink-0 hover:scale-110 transition-transform"
              >
                <RefreshCw className="h-2.5 w-2.5 text-red-500" />
              </button>
            )}
            {item.status === 'published' && <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-500" />}
            
            {/* Auto indicator */}
            {isAutoPublish && item.status === 'scheduled' && (
              <Bot className="h-2.5 w-2.5 shrink-0 text-primary/60" />
            )}
          </div>
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
            {item.scheduled_at && (
              <span className="flex items-center gap-1 text-orange-600">
                <Clock className="h-3 w-3" />
                {format(parseISO(item.scheduled_at), "dd/MM HH:mm")}
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

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getItemsForDay = useCallback((day: Date) => {
    return items.filter(item => {
      const itemDate = item.scheduled_at || item.due_date;
      if (!itemDate) return false;
      const parsedDate = typeof itemDate === 'string' ? parseISO(itemDate) : itemDate;
      return isSameDay(parsedDate, day);
    }).sort((a, b) => {
      const timeA = a.scheduled_at ? parseISO(a.scheduled_at).getTime() : 0;
      const timeB = b.scheduled_at ? parseISO(b.scheduled_at).getTime() : 0;
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
      const itemDate = draggedItem.scheduled_at || draggedItem.due_date;
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
    <div className="h-full flex flex-col gap-3">
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
      <div className="flex-1 border border-border/50 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm">
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
        <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: 'minmax(100px, 1fr)' }}>
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
                  "relative p-1 transition-all duration-150 group",
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
                <div className="space-y-0.5 overflow-hidden" style={{ maxHeight: 'calc(100% - 24px)' }}>
                  {dayItems.slice(0, 3).map(item => (
                    <CalendarCard
                      key={item.id}
                      item={item}
                      onEdit={() => onEditItem(item)}
                      onRetry={() => onRetry(item.id)}
                      canEdit={canEdit}
                      onDragStart={handleDragStart}
                      isDragging={draggedItem?.id === item.id}
                    />
                  ))}
                  
                  {dayItems.length > 3 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditItem(dayItems[3]); }}
                      className="w-full text-[9px] text-center py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                    >
                      +{dayItems.length - 3} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
