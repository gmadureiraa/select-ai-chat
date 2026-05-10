// 2026-05-08 — Vista calendário pra Tarefas do time. Adaptada de
// `src/components/planning/CalendarView.tsx` mas com filtro por `due_date`
// (ao invés de scheduled_at/published_at). Tasks sem due_date ficam num painel
// lateral "Sem data" com possibilidade de drag-and-drop pra um dia (precisa
// `onMoveTask`). Mantém o look minimal alinhado ao Kanban/Lista atuais.

import { useCallback, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday as isDateToday,
  addMonths,
  subMonths,
  isPast,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import type { TeamTask, TaskStatus } from "@/hooks/useTeamTasks";

interface TasksCalendarViewProps {
  tasks: TeamTask[];
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onCardClick: (t: TeamTask) => void;
  onToggleDone: (t: TeamTask) => void;
  onDayClick?: (d: Date) => void;
  onMoveTask?: (taskId: string, newDate: Date | null) => void;
  isViewer?: boolean;
}

const priorityClass: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-500/30 dark:text-red-300",
  high: "bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 border-orange-500/30 dark:text-orange-300",
  medium: "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-500/30 dark:text-blue-300",
  low: "bg-muted text-muted-foreground hover:bg-muted/80 border-border/50",
};

const statusBg: Record<TaskStatus, string> = {
  todo: "",
  in_progress: "ring-1 ring-amber-500/30",
  done: "opacity-60 line-through",
};

export function TasksCalendarView({
  tasks,
  memberMap,
  clientMap,
  onCardClick,
  onToggleDone,
  onDayClick,
  onMoveTask,
  isViewer = false,
}: TasksCalendarViewProps) {
  const [month, setMonth] = useState(new Date());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dragOverNoDate, setDragOverNoDate] = useState(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TeamTask[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      // due_date é "YYYY-MM-DD" no DB, mas pode vir parsed em alguns hooks.
      const key = typeof t.due_date === "string" ? t.due_date.slice(0, 10) : "";
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  const undated = useMemo(() => tasks.filter((t) => !t.due_date), [tasks]);

  // Stats simples por mês visível (apenas dias do mês atual)
  const monthStats = useMemo(() => {
    let total = 0,
      overdue = 0,
      done = 0;
    days.forEach((d) => {
      if (!isSameMonth(d, month)) return;
      const items = tasksByDay.get(format(d, "yyyy-MM-dd")) || [];
      total += items.length;
      const isOverdueDay = isPast(d) && !isDateToday(d);
      items.forEach((t) => {
        if (t.status === "done") done++;
        else if (isOverdueDay) overdue++;
      });
    });
    return { total, overdue, done };
  }, [days, tasksByDay, month]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, task: TeamTask) => {
      if (isViewer) return;
      setDraggedId(task.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
    },
    [isViewer],
  );

  const handleDragOverDay = useCallback((e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDay(key);
  }, []);

  const handleDropDay = useCallback(
    (e: React.DragEvent, day: Date) => {
      e.preventDefault();
      setDragOverDay(null);
      if (!draggedId || !onMoveTask) return;
      onMoveTask(draggedId, day);
      setDraggedId(null);
    },
    [draggedId, onMoveTask],
  );

  const handleDropNoDate = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverNoDate(false);
      if (!draggedId || !onMoveTask) return;
      onMoveTask(draggedId, null);
      setDraggedId(null);
    },
    [draggedId, onMoveTask],
  );

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium capitalize">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </h3>
          {monthStats.total > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{monthStats.total}</span> tarefas
              </span>
              {monthStats.overdue > 0 && (
                <span className="text-destructive">
                  <span className="font-medium">{monthStats.overdue}</span> atrasadas
                </span>
              )}
              {monthStats.done > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  <span className="font-medium">{monthStats.done}</span> concluídas
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMonth(subMonths(month, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setMonth(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Layout: calendar + sidebar "Sem data" */}
      <div className="flex flex-1 min-h-0 gap-3">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0 grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden auto-rows-fr">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div
              key={d}
              className="bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground font-medium"
            >
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, month);
            const dayTasks = tasksByDay.get(key) || [];
            const today = isDateToday(day);
            const isOverdueDay = isPast(day) && !today;
            const isDragOver = dragOverDay === key && draggedId !== null;

            return (
              <div
                key={key}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  if (!isViewer) onDayClick?.(day);
                }}
                onDragOver={(e) => handleDragOverDay(e, key)}
                onDragLeave={() => setDragOverDay((c) => (c === key ? null : c))}
                onDrop={(e) => handleDropDay(e, day)}
                className={cn(
                  "bg-background min-h-[110px] p-1.5 flex flex-col gap-0.5 cursor-pointer hover:bg-muted/20 transition-colors group",
                  !inMonth && "opacity-40",
                  today && "ring-1 ring-primary/40",
                  isDragOver && "ring-2 ring-primary/60 bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      today && "text-primary",
                      isOverdueDay && !today && "text-muted-foreground/70",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {!isViewer && onDayClick && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDayClick(day);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted/50 rounded"
                      title="Nova tarefa neste dia"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayTasks.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      draggable={!isViewer}
                      onDragStart={(e) => handleDragStart(e, t)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardClick(t);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onToggleDone(t);
                      }}
                      className={cn(
                        "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate transition-colors border",
                        t.status === "done"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 line-through border-emerald-500/30"
                          : priorityClass[t.priority] ?? priorityClass.low,
                        statusBg[t.status],
                        draggedId === t.id && "opacity-40",
                      )}
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  ))}
                  {dayTasks.length > 4 && (
                    <span className="text-[9px] text-muted-foreground">
                      +{dayTasks.length - 4} mais
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* "Sem data" sidebar */}
        <div
          className={cn(
            "w-60 shrink-0 flex flex-col border border-border/60 rounded-md bg-muted/10 overflow-hidden transition-colors",
            dragOverNoDate && "ring-2 ring-primary/60 bg-primary/5",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverNoDate(true);
          }}
          onDragLeave={() => setDragOverNoDate(false)}
          onDrop={handleDropNoDate}
        >
          <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
            <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Sem data</span>
            <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-1.5">
              {undated.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {undated.length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-6 px-2">
                Tarefas sem data caem aqui. Arraste pra um dia pra agendar.
              </div>
            ) : (
              undated.map((t) => (
                <div
                  key={t.id}
                  draggable={!isViewer}
                  onDragStart={(e) => handleDragStart(e, t)}
                  onDragEnd={() => setDraggedId(null)}
                  className={cn(draggedId === t.id && "opacity-40")}
                >
                  <TaskCard
                    task={t}
                    memberMap={memberMap}
                    clientMap={clientMap}
                    onClick={() => onCardClick(t)}
                    onToggleDone={() => onToggleDone(t)}
                    density="compact"
                  />
                </div>
              ))
            )}
          </div>
          {undated.length > 0 && !isViewer && (
            <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
              Arraste pra um dia pra agendar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
