import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar as CalendarIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PlanningItem } from '@/hooks/usePlanningItems';

interface CalendarViewProps {
  items: PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onAddItem: (date: Date) => void;
  onDeleteItem: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
}

const statusColors: Record<string, string> = {
  idea: 'bg-purple-100 text-purple-700 border-purple-200',
  draft: 'bg-blue-100 text-blue-700 border-blue-200',
  review: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  scheduled: 'bg-orange-100 text-orange-700 border-orange-200',
  publishing: 'bg-orange-100 text-orange-700 border-orange-200',
  published: 'bg-slate-100 text-slate-600 border-slate-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

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
                    <TooltipProvider key={item.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80",
                              statusColors[item.status]
                            )}
                            onClick={(e) => { e.stopPropagation(); onEditItem(item); }}
                          >
                            <div className="flex items-center gap-1">
                              {item.scheduled_at && <Clock className="h-2.5 w-2.5" />}
                              {item.status === 'failed' && <AlertCircle className="h-2.5 w-2.5" />}
                              {item.status === 'published' && <CheckCircle2 className="h-2.5 w-2.5" />}
                              <span className="truncate">{item.title}</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="font-medium">{item.title}</p>
                          {item.clients && <p className="text-xs text-muted-foreground">{item.clients.name}</p>}
                          {item.scheduled_at && (
                            <p className="text-xs">Agendado: {format(new Date(item.scheduled_at), "dd/MM HH:mm")}</p>
                          )}
                          {item.status === 'failed' && item.error_message && (
                            <p className="text-xs text-destructive mt-1">{item.error_message}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                  {dayItems.length > 3 && (
                    <Badge variant="outline" className="text-[9px] px-1">
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
