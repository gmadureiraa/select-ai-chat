import { useState, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, addWeeks, subWeeks, parseISO, isToday as isDateToday, differenceInDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, AlertCircle, CheckCircle2, Bot, FileEdit, RefreshCw, Calendar as _CalendarIcon, MoreHorizontal as _MoreHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import type { ViewSettings } from './ViewSettingsPopover';

interface CalendarViewProps {
  items: PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onAddItem: (date: Date) => void;
  onDeleteItem: (id: string) => void | Promise<unknown>;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  onMoveItem?: (itemId: string, newDate: Date) => void;
  canEdit?: boolean;
  isDeleting?: boolean;
  viewSettings?: ViewSettings;
  memberMap?: Record<string, { name: string; initials: string }>;
}

// Usa CSS vars --status-* (declaradas em index.css com light/dark) pra
// consistência com o Kanban. Cada status renderiza com tinted bg + dot
// + border na mesma cor, escalonando opacity entre light/dark via /10, /20.
const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  idea: {
    bg: 'bg-[hsl(var(--status-idea)/0.12)]',
    text: 'text-[hsl(var(--status-idea))]',
    border: 'border-[hsl(var(--status-idea)/0.30)]',
    dot: 'bg-[hsl(var(--status-idea))]',
  },
  pending_approval: {
    bg: 'bg-[hsl(var(--status-pending_approval)/0.12)]',
    text: 'text-[hsl(var(--status-pending_approval))]',
    border: 'border-[hsl(var(--status-pending_approval)/0.30)]',
    dot: 'bg-[hsl(var(--status-pending_approval))]',
  },
  draft: {
    bg: 'bg-[hsl(var(--status-draft)/0.12)]',
    text: 'text-[hsl(var(--status-draft))]',
    border: 'border-[hsl(var(--status-draft)/0.30)]',
    dot: 'bg-[hsl(var(--status-draft))]',
  },
  review: {
    bg: 'bg-[hsl(var(--status-review)/0.12)]',
    text: 'text-[hsl(var(--status-review))]',
    border: 'border-[hsl(var(--status-review)/0.30)]',
    dot: 'bg-[hsl(var(--status-review))]',
  },
  approved: {
    bg: 'bg-[hsl(var(--status-approved)/0.12)]',
    text: 'text-[hsl(var(--status-approved))]',
    border: 'border-[hsl(var(--status-approved)/0.30)]',
    dot: 'bg-[hsl(var(--status-approved))]',
  },
  scheduled: {
    bg: 'bg-[hsl(var(--status-scheduled)/0.12)]',
    text: 'text-[hsl(var(--status-scheduled))]',
    border: 'border-[hsl(var(--status-scheduled)/0.30)]',
    dot: 'bg-[hsl(var(--status-scheduled))]',
  },
  publishing: {
    bg: 'bg-[hsl(var(--status-publishing)/0.12)]',
    text: 'text-[hsl(var(--status-publishing))]',
    border: 'border-[hsl(var(--status-publishing)/0.30)]',
    dot: 'bg-[hsl(var(--status-publishing))] animate-pulse',
  },
  published: {
    bg: 'bg-[hsl(var(--status-published)/0.12)]',
    text: 'text-[hsl(var(--status-published))]',
    border: 'border-[hsl(var(--status-published)/0.30)]',
    dot: 'bg-[hsl(var(--status-published))]',
  },
  failed: {
    bg: 'bg-[hsl(var(--status-failed)/0.12)]',
    text: 'text-[hsl(var(--status-failed))]',
    border: 'border-[hsl(var(--status-failed)/0.30)]',
    dot: 'bg-[hsl(var(--status-failed))] animate-pulse',
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

// 2026-05-19: Gabriel pediu TEXTO da rede social em vez de emoji (clareza
// estilo ClickUp). Label curto por plataforma.
const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  newsletter: 'Newsletter',
  blog: 'Blog',
  tiktok: 'TikTok',
  threads: 'Threads',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  other: 'Outro',
};

// Label PT-BR de cada status pra pill visível no card.
const statusLabels: Record<string, string> = {
  idea: 'Ideia',
  pending_approval: 'Aprovar',
  draft: 'Rascunho',
  review: 'Revisão',
  approved: 'Pronto',
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou',
  todo: 'Tarefa',
};

function CalendarCard({
  item,
  onEdit,
  onRetry,
  onDelete,
  canEdit = true,
  onDragStart,
  isDragging,
  memberMap,
}: {
  item: PlanningItem;
  onEdit: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  onDragStart?: (e: React.DragEvent, item: PlanningItem) => void;
  isDragging?: boolean;
  memberMap?: Record<string, { name: string; initials: string }>;
}) {
  const { canAutoPublish } = useClientPlatformStatus(item.client_id);
  const platform = item.platform as SupportedPlatform | null;
  const isAutoPublish = canAutoPublish(platform);
  const config = statusConfig[item.status] || statusConfig.idea;
  // 2026-05-19: card "Publicado" ganha visual verde escuro destacado (Gabriel
  // pediu — concluído deve saltar aos olhos, estilo ClickUp "done").
  const isPublished = item.status === 'published';

  const effectiveDate = item.scheduled_at || item.published_at;
  const scheduledTime = effectiveDate ? format(parseISO(effectiveDate), 'HH:mm') : null;
  const scheduledDate = effectiveDate ? parseISO(effectiveDate) : null;
  const daysUntil = scheduledDate ? differenceInDays(scheduledDate, new Date()) : null;

  // Responsável (assigned_to → memberMap)
  const assignee = item.assigned_to ? memberMap?.[item.assigned_to] : null;
  // Texto da rede social + formato (em vez de só emoji)
  const platformText = item.platform ? (platformLabels[item.platform] || item.platform) : null;
  const statusText = statusLabels[item.status] || item.status;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          draggable={canEdit}
          onDragStart={(e) => onDragStart?.(e, item)}
          className={cn(
            "group/card relative px-2.5 py-2 rounded-md border-l-[3px] border transition-all duration-200",
            "hover:shadow-md hover:scale-[1.01]",
            isPublished
              ? "bg-emerald-900/90 text-emerald-50 border-emerald-700 border-l-emerald-400"
              : cn(config.bg, config.text, config.border),
            isDragging && "opacity-50 scale-95",
            canEdit && "cursor-grab active:cursor-grabbing"
          )}
          onClick={(e) => { e.stopPropagation(); if (canEdit) onEdit(); }}
        >
          {/* Row 1: Status pill + Time + actions */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className={cn(
              "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0",
              isPublished
                ? "bg-emerald-400/20 text-emerald-100"
                : "bg-black/5 dark:bg-white/10"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", isPublished ? "bg-emerald-300" : config.dot)} />
              {statusText}
            </span>
            <div className="flex items-center gap-1">
              {scheduledTime && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-md shrink-0 font-semibold tabular-nums",
                  isPublished ? "bg-emerald-400/20 text-emerald-100" : "bg-black/5 dark:bg-white/10"
                )}>
                  {scheduledTime}
                </span>
              )}
              {item.status === 'failed' && onRetry && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                  className="shrink-0 hover:scale-110 transition-transform"
                  aria-label="Tentar publicar novamente"
                  title="Tentar publicar novamente"
                >
                  <RefreshCw className="h-3 w-3 text-red-500" aria-hidden="true" />
                </button>
              )}
              {item.status === 'published' && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" />}
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

          {/* Row 3: Plataforma (texto) + Cliente */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {platformText && (
              <span className={cn(
                "inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0",
                isPublished ? "bg-emerald-400/15 text-emerald-100" : "bg-black/5 dark:bg-white/10 text-foreground/70"
              )}>
                {platformText}
              </span>
            )}
            {item.clients && (
              <span className={cn(
                "text-[10px] truncate",
                isPublished ? "text-emerald-200/80" : "text-muted-foreground"
              )}>
                {item.clients.name}
              </span>
            )}
          </div>

          {/* Row 4: Responsável (avatar + nome, estilo ClickUp) */}
          {assignee && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0",
                isPublished ? "bg-emerald-400/30 text-emerald-50" : "bg-primary/15 text-primary"
              )}>
                {assignee.initials}
              </span>
              <span className={cn(
                "text-[9px] truncate",
                isPublished ? "text-emerald-200/80" : "text-muted-foreground"
              )}>
                {assignee.name}
              </span>
            </div>
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
              <Badge variant="outline" className="text-[9px] h-4 bg-green-100 text-green-700 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30 shrink-0">
                <Bot className="h-2 w-2 mr-0.5" />
                Auto
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] h-4 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 shrink-0">
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
              daysUntil === 0 && "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
              daysUntil === 1 && "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
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

type CalendarMode = 'month' | 'week' | 'day';

export function CalendarView({
  items,
  onEditItem,
  onAddItem,
  onDeleteItem,
  onMoveToLibrary: _onMoveToLibrary,
  onRetry,
  onMoveItem,
  canEdit = true,
  isDeleting = false,
  viewSettings: _viewSettings,
  memberMap,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const [draggedItem, setDraggedItem] = useState<PlanningItem | null>(null);
  const [dragOverDay, setDragOverDay] = useState<Date | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<PlanningItem | null>(null);
  const [localDeleting, setLocalDeleting] = useState(false);

  // Dias visíveis no grid — depende do modo (mês/semana/dia)
  const days = useMemo(() => {
    if (mode === 'day') return [currentDate];
    if (mode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: ws, end: we });
    }
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate, mode]);

  const goPrev = useCallback(() => {
    if (mode === 'day') setCurrentDate(d => addDays(d, -1));
    else if (mode === 'week') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subMonths(d, 1));
  }, [mode]);

  const goNext = useCallback(() => {
    if (mode === 'day') setCurrentDate(d => addDays(d, 1));
    else if (mode === 'week') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
  }, [mode]);

  const headerLabel = useMemo(() => {
    if (mode === 'day') {
      return format(currentDate, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
    }
    if (mode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      const sameMonth = isSameMonth(ws, we);
      return sameMonth
        ? `${format(ws, 'dd')} – ${format(we, "dd 'de' MMMM yyyy", { locale: ptBR })}`
        : `${format(ws, "dd 'de' MMM", { locale: ptBR })} – ${format(we, "dd 'de' MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: ptBR });
  }, [currentDate, mode]);

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

  // Stats agregadas no range visível (mês/semana/dia)
  const rangeStats = useMemo(() => {
    const stats = { scheduled: 0, published: 0, failed: 0, total: 0, overdue: 0 };
    const today = startOfDay(new Date());
    days.forEach(day => {
      // No modo mês, só conta dias do mês atual; nas outras views, todos os dias visíveis
      const includeDay = mode === 'month' ? isSameMonth(day, currentDate) : true;
      if (!includeDay) return;
      const dayItems = getItemsForDay(day);
      stats.total += dayItems.length;
      dayItems.forEach(item => {
        if (item.status === 'scheduled') stats.scheduled++;
        if (item.status === 'published') stats.published++;
        if (item.status === 'failed') stats.failed++;
        // Atrasado: scheduled com data passada ou due_date passado sem publicação
        const target = item.scheduled_at || item.due_date;
        if (target && item.status !== 'published' && isBefore(parseISO(target), today)) {
          stats.overdue++;
        }
      });
    });
    return stats;
  }, [days, getItemsForDay, currentDate, mode]);

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
      <div className="flex items-center justify-between px-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-lg font-semibold capitalize truncate">
            {headerLabel}
          </h3>
          {/* Toggle Mês/Semana/Dia */}
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => v && setMode(v as CalendarMode)}
            className="gap-0 bg-muted/40 rounded-md p-0.5"
          >
            <ToggleGroupItem
              value="month"
              aria-label="Visão mensal"
              className="px-2 h-7 text-xs rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              Mês
            </ToggleGroupItem>
            <ToggleGroupItem
              value="week"
              aria-label="Visão semanal"
              className="px-2 h-7 text-xs rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              Semana
            </ToggleGroupItem>
            <ToggleGroupItem
              value="day"
              aria-label="Visão diária"
              className="px-2 h-7 text-xs rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              Dia
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Stats badges agregadas */}
        <div className="flex items-center gap-2">
          {rangeStats.total > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium tabular-nums">{rangeStats.total}</span>
              <span>{rangeStats.total === 1 ? 'item' : 'itens'}</span>
            </div>
          )}
          {rangeStats.scheduled > 0 && (
            <div className="flex items-center gap-1" title={`${rangeStats.scheduled} agendados`}>
              <Clock className="h-3 w-3 text-orange-500" />
              <span className="text-xs font-medium tabular-nums">{rangeStats.scheduled}</span>
            </div>
          )}
          {rangeStats.published > 0 && (
            <div className="flex items-center gap-1" title={`${rangeStats.published} publicados`}>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-medium tabular-nums">{rangeStats.published}</span>
            </div>
          )}
          {rangeStats.overdue > 0 && (
            <div
              className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
              title={`${rangeStats.overdue} atrasados`}
            >
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs font-medium tabular-nums">{rangeStats.overdue} atrasados</span>
            </div>
          )}
          {rangeStats.failed > 0 && (
            <div className="flex items-center gap-1" title={`${rangeStats.failed} falhas`}>
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span className="text-xs font-medium tabular-nums">{rangeStats.failed}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goPrev}
            aria-label={mode === 'day' ? 'Dia anterior' : mode === 'week' ? 'Semana anterior' : 'Mês anterior'}
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
            onClick={goNext}
            aria-label={mode === 'day' ? 'Próximo dia' : mode === 'week' ? 'Próxima semana' : 'Próximo mês'}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border border-border/60 rounded-xl overflow-auto bg-card shadow-sm min-h-0">
        {/* Week Header — escondido em modo "dia" */}
        {mode !== 'day' && (
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
        )}

        {/* Days Grid */}
        <div
          className={cn(
            mode === 'day' && 'flex flex-col',
            mode !== 'day' && 'grid grid-cols-7',
          )}
          style={{
            gridAutoRows: mode === 'week'
              ? 'minmax(360px, 1fr)'
              : mode === 'month'
                ? 'minmax(140px, auto)'
                : undefined,
          }}
        >
          {days.map((day, i) => {
            const dayItems = getItemsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isDateToday(day);
            const isDragOver = dragOverDay && isSameDay(dragOverDay, day);
            const hasItems = dayItems.length > 0;
            const row = Math.floor(i / 7);
            const col = i % 7;
            const isLastRow = row === Math.floor((days.length - 1) / 7);
            const dayKey = format(day, 'yyyy-MM-dd');
            const isExpanded = expandedDay === dayKey;
            // No modo semana/dia mostramos todos itens; no mês limita 3 (UX existente)
            const visibleItemLimit = mode === 'month' ? 3 : Infinity;
            const itemsToRender = isExpanded ? dayItems : dayItems.slice(0, visibleItemLimit);

            return (
              <div
                key={i}
                className={cn(
                  "relative p-1.5 transition-all duration-150 group",
                  mode !== 'day' && col < 6 && "border-r border-border/30",
                  mode === 'month' && !isLastRow && "border-b border-border/30",
                  mode === 'month' && !isCurrentMonth && "bg-muted/5",
                  isToday && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                  isDragOver && "bg-primary/10 ring-1 ring-primary/40 ring-inset",
                  canEdit && "hover:bg-muted/20 cursor-pointer",
                  mode === 'day' && "p-4 min-h-full",
                )}
                onClick={() => canEdit && onAddItem(day)}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-1 px-0.5 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      "text-[11px] font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200",
                      isToday && "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/40 scale-110",
                      !isToday && !isCurrentMonth && mode === 'month' && "text-muted-foreground/50",
                      !isToday && (isCurrentMonth || mode !== 'month') && "text-foreground",
                      mode === 'day' && "w-9 h-9 text-sm",
                    )}>
                      {format(day, 'd')}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                        Hoje
                      </span>
                    )}
                    {mode === 'week' && (
                      <span className="text-[10px] font-medium text-muted-foreground capitalize">
                        {format(day, 'EEE', { locale: ptBR })}
                      </span>
                    )}
                  </div>

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
                      aria-label="Adicionar item neste dia"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Items */}
                <div className={cn(
                  "space-y-0.5",
                  isExpanded ? "overflow-visible" : "overflow-hidden",
                )}>
                  {itemsToRender.map(item => {
                    // Hide delete for already-published items that are tied to a real external post
                    const isLockedFromDelete = item.status === 'published' && !!item.external_post_id;
                    return (
                      <CalendarCard
                        key={item.id}
                        item={item}
                        onEdit={() => onEditItem(item)}
                        onRetry={() => onRetry(item.id)}
                        onDelete={canEdit && !isLockedFromDelete ? () => setItemToDelete(item) : undefined}
                        canEdit={canEdit}
                        onDragStart={handleDragStart}
                        isDragging={draggedItem?.id === item.id}
                        memberMap={memberMap}
                      />
                    );
                  })}

                  {mode === 'month' && dayItems.length > 3 && !isExpanded && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedDay(dayKey); }}
                      className="w-full text-[9px] text-center py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                    >
                      +{dayItems.length - 3} mais
                    </button>
                  )}

                  {mode === 'month' && dayItems.length > 3 && isExpanded && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedDay(null); }}
                      className="w-full text-[9px] text-center py-0.5 text-primary hover:text-primary/80 hover:bg-muted/50 rounded transition-colors font-medium"
                    >
                      ver menos
                    </button>
                  )}

                  {/* Empty hint na visão dia/semana */}
                  {mode !== 'month' && dayItems.length === 0 && canEdit && (
                    <div className="text-[11px] text-muted-foreground/60 italic px-1 py-1.5">
                      Sem itens. Clique pra adicionar.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open && !localDeleting && !isDeleting) setItemToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{itemToDelete?.title || 'este item'}</strong>? Você poderá desfazer logo após a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={localDeleting || isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={localDeleting || isDeleting || !itemToDelete}
              onClick={async (e) => {
                e.preventDefault();
                if (!itemToDelete) return;
                setLocalDeleting(true);
                try {
                  await onDeleteItem(itemToDelete.id);
                  setItemToDelete(null);
                } finally {
                  setLocalDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(localDeleting || isDeleting) ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Excluindo…
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
