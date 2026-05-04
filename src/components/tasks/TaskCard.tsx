import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CheckCircle2, MessageSquare, ListChecks } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TeamTask } from "@/hooks/useTeamTasks";

interface TaskCardProps {
  task: TeamTask;
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onClick: () => void;
  onToggleDone?: () => void;
  checklistMeta?: { done: number; total: number };
  commentsCount?: number;
  density?: "comfortable" | "compact";
}

const priorityBar: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-transparent",
};

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/40",
};

export function TaskCard({
  task,
  memberMap,
  clientMap,
  onClick,
  onToggleDone,
  checklistMeta,
  commentsCount,
  density = "comfortable",
}: TaskCardProps) {
  const assignee = task.assigned_to ? memberMap[task.assigned_to] : null;
  const client = task.client_id ? clientMap[task.client_id] : null;
  const due = task.due_date ? parseISO(task.due_date) : null;
  const overdue = !!due && isPast(due) && !isToday(due) && task.status !== "done";
  const dueToday = !!due && isToday(due);
  const isDone = task.status === "done";
  const labels = task.labels ?? [];

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer rounded-md border border-border/60 bg-card pl-3 pr-2.5 py-2 overflow-hidden",
        "transition-all duration-150 hover:border-primary/40 hover:-translate-y-px hover:shadow-sm",
        isDone && "opacity-60",
      )}
    >
      {/* priority bar */}
      <span
        className={cn("absolute left-0 top-0 bottom-0 w-[3px]", priorityBar[task.priority])}
        aria-hidden
      />

      <div className="flex items-start gap-2">
        {onToggleDone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone();
            }}
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center transition-colors",
              isDone
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-muted-foreground/40 hover:border-primary",
            )}
            aria-label="Concluir tarefa"
          >
            {isDone && <CheckCircle2 className="h-3 w-3" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium leading-snug", isDone && "line-through")}>
            {task.title}
          </p>

          {density === "comfortable" && task.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
          )}

          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {labels.slice(0, 4).map((l, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 h-4 inline-flex items-center rounded border"
                  style={{
                    background: `${l.color}1f`,
                    color: l.color,
                    borderColor: `${l.color}55`,
                  }}
                >
                  {l.name}
                </span>
              ))}
              {labels.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{labels.length - 4}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot[task.priority])} />

            {client && (
              <span className="truncate max-w-[100px]" title={client.name}>
                {client.name}
              </span>
            )}

            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue ? "text-red-400" : dueToday ? "text-amber-400" : "text-muted-foreground",
                )}
              >
                {overdue && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
                <Calendar className="h-3 w-3" />
                {format(due, "dd MMM", { locale: ptBR })}
              </span>
            )}

            {checklistMeta && checklistMeta.total > 0 && (
              <span className="inline-flex items-center gap-1" title="Subtarefas">
                <ListChecks className="h-3 w-3" />
                {checklistMeta.done}/{checklistMeta.total}
              </span>
            )}

            {!!commentsCount && commentsCount > 0 && (
              <span className="inline-flex items-center gap-1" title="Comentários">
                <MessageSquare className="h-3 w-3" />
                {commentsCount}
              </span>
            )}

            <div className="ml-auto">
              {assignee ? (
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-primary/15 text-primary">
                    {assignee.initials}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30 inline-block" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
