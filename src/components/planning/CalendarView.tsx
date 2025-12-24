import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
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
}

const statusColors: Record<string, string> = {
  idea: 'bg-purple-500/90 text-white border-purple-600',
  draft: 'bg-blue-500/90 text-white border-blue-600',
  review: 'bg-amber-500/90 text-white border-amber-600',
  approved: 'bg-emerald-500/90 text-white border-emerald-600',
  scheduled: 'bg-orange-500/90 text-white border-orange-600',
  publishing: 'bg-orange-400/90 text-white border-orange-500',
  published: 'bg-slate-500/90 text-white border-slate-600',
  failed: 'bg-red-500/90 text-white border-red-600',
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

function CalendarCard({ item, onEdit }: { item: PlanningItem; onEdit: () => void }) {
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
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
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
              Agendado: {format(new Date(item.scheduled_at), "dd/MM 'às' HH:mm")}
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
      return isSameDay(new Date(itemDate), day);
    });
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        {/* Week Header */}
        <div className="grid grid-cols-7 bg-muted border-b">
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
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
                  "min-h-24 border-b border-r p-1 cursor-pointer hover:bg-muted/50 transition-colors group",
                  !isCurrentMonth && "bg-muted/30 text-muted-foreground"
                )}
                onClick={() => onAddItem(day)}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onAddItem(day); }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Items */}
                <div className="space-y-1 overflow-hidden max-h-20">
                  {dayItems.slice(0, 3).map(item => (
                    <CalendarCard
                      key={item.id}
                      item={item}
                      onEdit={() => onEditItem(item)}
                    />
                  ))}
                  {dayItems.length > 3 && (
                    <Badge variant="outline" className="text-[9px] px-1 bg-background">
                      +{dayItems.length - 3} mais
                    </Badge>
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
