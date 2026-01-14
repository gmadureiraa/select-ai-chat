import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, getWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, AlertCircle, CheckCircle2, Bot, FileEdit, User, GripVertical, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PlanningItem } from '@/hooks/usePlanningItems';
import { useClientPlatformStatus, type SupportedPlatform } from '@/hooks/useClientPlatformStatus';

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
    bg: 'bg-purple-50 dark:bg-purple-950/40', 
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500'
  },
  draft: { 
    bg: 'bg-blue-50 dark:bg-blue-950/40', 
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500'
  },
  review: { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500'
  },
  approved: { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  scheduled: { 
    bg: 'bg-orange-50 dark:bg-orange-950/40', 
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500'
  },
  publishing: { 
    bg: 'bg-orange-50 dark:bg-orange-950/30', 
    text: 'text-orange-600 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-400 animate-pulse'
  },
  published: { 
    bg: 'bg-slate-50 dark:bg-slate-900/40', 
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  },
  failed: { 
    bg: 'bg-red-50 dark:bg-red-950/40', 
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
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
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable={canEdit}
            onDragStart={(e) => onDragStart?.(e, item)}
            className={cn(
              "group/card relative px-2 py-1.5 rounded-lg border transition-all duration-200",
              "hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5",
              config.bg, config.text, config.border,
              isDragging && "opacity-50 scale-95 rotate-1",
              canEdit && "cursor-grab active:cursor-grabbing"
            )}
            onClick={(e) => { e.stopPropagation(); if (canEdit) onEdit(); }}
          >
            <div className="flex items-center gap-1.5">
              {/* Status dot */}
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
              
              {/* Platform icon */}
              {item.platform && (
                <span className="text-xs shrink-0">{platformIcons[item.platform] || '📱'}</span>
              )}
              
              {/* Title */}
              <span className="text-[11px] font-medium truncate flex-1">
                {item.title}
              </span>
              
              {/* Time badge */}
              {scheduledTime && (
                <span className="text-[9px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded shrink-0 font-medium">
                  {scheduledTime}
                </span>
              )}
              
              {/* Status icons */}
              {item.status === 'failed' && onRetry && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                  className="shrink-0 hover:scale-110 transition-transform"
                >
                  <RefreshCw className="h-3 w-3 text-red-500" />
                </button>
              )}
              {item.status === 'published' && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />}
              
              {/* Auto indicator */}
              {isAutoPublish && item.status === 'scheduled' && (
                <Bot className="h-3 w-3 shrink-0 text-primary/60" />
              )}
            </div>
            
            {/* Client indicator */}
            {item.clients && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="h-3 w-3 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold">
                  {item.clients.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-[9px] text-muted-foreground truncate">
                  {item.clients.name}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs p-3 space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{item.title}</p>
            {isAutoPublish ? (
              <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-300">
                <Bot className="h-2.5 w-2.5 mr-1" />
                Auto
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                <FileEdit className="h-2.5 w-2.5 mr-1" />
                Manual
              </Badge>
            )}
          </div>
          
          {item.clients && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{item.clients.name}</span>
            </div>
          )}
          
          {item.platform && (
            <p className="text-xs">
              <span className="mr-1">{platformIcons[item.platform]}</span>
              {item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}
            </p>
          )}
          
          {item.scheduled_at && (
            <p className="text-xs flex items-center gap-1 text-orange-600">
              <Clock className="h-3 w-3" />
              Agendado: {format(parseISO(item.scheduled_at), "dd/MM 'às' HH:mm")}
            </p>
          )}
          
          {item.status === 'failed' && item.error_message && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/50 p-2 rounded border border-red-200 dark:border-red-800">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              {item.error_message}
            </div>
          )}
          
          {item.content && (
            <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">
              {item.content.substring(0, 100)}...
            </p>
          )}
          
          {canEdit && (
            <p className="text-[10px] text-muted-foreground italic border-t pt-2">
              Clique para editar • Arraste para mover de data
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

  const getItemsForDay = (day: Date) => {
    return items.filter(item => {
      const itemDate = item.scheduled_at || item.due_date;
      if (!itemDate) return false;
      const parsedDate = typeof itemDate === 'string' ? parseISO(itemDate) : itemDate;
      return isSameDay(parsedDate, day);
    }).sort((a, b) => {
      // Sort by scheduled time
      const timeA = a.scheduled_at ? parseISO(a.scheduled_at).getTime() : 0;
      const timeB = b.scheduled_at ? parseISO(b.scheduled_at).getTime() : 0;
      return timeA - timeB;
    });
  };

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
  }, [days, items, currentDate]);

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
    <div className="h-full flex flex-col gap-4">
      {/* Header - ClickUp Style */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] font-normal">
            Semana {getWeek(currentDate, { locale: ptBR })}
          </Badge>
        </div>
        
        {/* Stats badges */}
        <div className="flex items-center gap-2">
          {monthStats.scheduled > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">
              <Clock className="h-2.5 w-2.5 mr-1" />
              {monthStats.scheduled} agendados
            </Badge>
          )}
          {monthStats.published > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 border-green-200">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
              {monthStats.published} publicados
            </Badge>
          )}
          {monthStats.failed > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 border-red-200">
              <AlertCircle className="h-2.5 w-2.5 mr-1" />
              {monthStats.failed} falhas
            </Badge>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-3 text-xs font-medium" 
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border rounded-xl overflow-hidden bg-card shadow-sm">
        {/* Week Header */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {weekDays.map((day, i) => (
            <div 
              key={day} 
              className={cn(
                "py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                i < 6 && "border-r border-border/50"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: 'minmax(110px, 1fr)' }}>
          {days.map((day, i) => {
            const dayItems = getItemsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const isDragOver = dragOverDay && isSameDay(dragOverDay, day);
            const hasItems = dayItems.length > 0;
            const row = Math.floor(i / 7);
            const col = i % 7;
            const isLastRow = row === Math.floor((days.length - 1) / 7);

            return (
              <div
                key={i}
                className={cn(
                  "p-1.5 transition-all duration-200 group relative",
                  col < 6 && "border-r border-border/40",
                  !isLastRow && "border-b border-border/40",
                  !isCurrentMonth && "bg-muted/20",
                  isToday && "bg-primary/5",
                  isDragOver && "bg-primary/10 ring-2 ring-primary ring-inset",
                  canEdit && "hover:bg-muted/30 cursor-pointer"
                )}
                onClick={() => canEdit && onAddItem(day)}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                    isToday && "bg-primary text-primary-foreground",
                    !isCurrentMonth && "text-muted-foreground/50"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Add button */}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity",
                        hasItems && "opacity-30"
                      )}
                      onClick={(e) => { e.stopPropagation(); onAddItem(day); }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Items */}
                <div className="space-y-1 overflow-hidden" style={{ maxHeight: 'calc(100% - 28px)' }}>
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
                      className="text-[10px] text-primary hover:underline font-medium w-full text-left px-1"
                      onClick={(e) => { e.stopPropagation(); onEditItem(dayItems[3]); }}
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