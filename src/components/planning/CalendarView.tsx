import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, AlertCircle, CheckCircle2, Bot, FileEdit, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PlanningItem } from '@/hooks/usePlanningItems';
import { useClients } from '@/hooks/useClients';
import { useClientPlatformStatus, type SupportedPlatform } from '@/hooks/useClientPlatformStatus';

interface CalendarViewProps {
  items: PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onAddItem: (date: Date) => void;
  onDeleteItem: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  canEdit?: boolean;
}

const statusColors: Record<string, string> = {
  idea: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  scheduled: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  publishing: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  published: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800',
};

const platformIcons: Record<string, string> = {
  instagram: '📸',
  twitter: '🐦',
  linkedin: '💼',
  youtube: '🎬',
  newsletter: '📧',
  blog: '📝',
  tiktok: '🎵',
  other: '📱',
};

function CalendarCard({ item, onEdit, canEdit = true }: { item: PlanningItem; onEdit: () => void; canEdit?: boolean }) {
  const { canAutoPublish } = useClientPlatformStatus(item.client_id);
  const platform = item.platform as SupportedPlatform | null;
  const isAutoPublish = canAutoPublish(platform);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "text-[10px] px-1.5 py-1 rounded-md border cursor-pointer hover:scale-[1.02] transition-all shadow-sm",
              statusColors[item.status]
            )}
            onClick={(e) => { e.stopPropagation(); if (canEdit) onEdit(); }}
          >
            <div className="flex items-center gap-1">
              {/* Platform icon */}
              {item.platform && (
                <span className="text-[9px]">{platformIcons[item.platform] || '📱'}</span>
              )}
              
              {/* Client initial badge */}
              {item.clients && (
                <span className="h-3.5 w-3.5 rounded-full bg-white/30 flex items-center justify-center text-[8px] font-bold">
                  {item.clients.name.charAt(0).toUpperCase()}
                </span>
              )}
              
              {/* Title */}
              <span className="truncate flex-1 font-medium">{item.title}</span>
              
              {/* Status icons */}
              {item.scheduled_at && <Clock className="h-2.5 w-2.5 shrink-0" />}
              {item.status === 'failed' && <AlertCircle className="h-2.5 w-2.5 shrink-0 animate-pulse" />}
              {item.status === 'published' && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
              
              {/* Auto/Manual indicator */}
              {isAutoPublish ? (
                <Bot className="h-2.5 w-2.5 shrink-0" />
              ) : (
                <FileEdit className="h-2.5 w-2.5 shrink-0 opacity-60" />
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs p-3 space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.title}</p>
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
            <p className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Agendado: {format(parseISO(item.scheduled_at), "dd/MM 'às' HH:mm")}
            </p>
          )}
          
          {item.status === 'failed' && item.error_message && (
            <p className="text-xs text-destructive bg-red-50 p-2 rounded border border-red-200">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              {item.error_message}
            </p>
          )}
          
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
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
  canEdit = true,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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
    });
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="h-full flex flex-col">
      {/* Header - Cleaner */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid - Cleaner borders */}
      <div className="flex-1 border border-border/50 rounded-lg overflow-hidden bg-card/30">
        {/* Week Header */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30">
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 grid-rows-6 flex-1">
          {days.map((day, i) => {
            const dayItems = getItemsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={i}
                className={cn(
                  "min-h-20 border-b border-r border-border/30 p-1 transition-colors group",
                  !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                  canEdit && "cursor-pointer hover:bg-muted/30"
                )}
                onClick={() => canEdit && onAddItem(day)}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn(
                    "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full",
                    isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onAddItem(day); }}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>

                {/* Items - More compact */}
                <div className="space-y-0.5 overflow-hidden max-h-16">
                  {dayItems.slice(0, 3).map(item => (
                    <CalendarCard
                      key={item.id}
                      item={item}
                      onEdit={() => onEditItem(item)}
                      canEdit={canEdit}
                    />
                  ))}
                  {dayItems.length > 3 && (
                    <span className="text-[9px] text-muted-foreground px-1">
                      +{dayItems.length - 3} mais
                    </span>
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
