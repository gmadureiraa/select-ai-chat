import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TeamTask } from "@/hooks/useTeamTasks";

interface TaskCardProps {
  task: TeamTask;
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onClick: () => void;
  onToggleDone?: () => void;
}

const priorityColor: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const priorityLabel: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function TaskCard({ task, memberMap, clientMap, onClick, onToggleDone }: TaskCardProps) {
  const assignee = task.assigned_to ? memberMap[task.assigned_to] : null;
  const client = task.client_id ? clientMap[task.client_id] : null;
  const due = task.due_date ? parseISO(task.due_date) : null;
  const overdue = due && isPast(due) && !isToday(due) && task.status !== "done";
  const dueToday = due && isToday(due);
  const isDone = task.status === "done";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-md border bg-card p-3 hover:border-primary/40 transition-colors",
        isDone && "opacity-60",
        overdue && "border-red-500/40"
      )}
    >
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
                : "border-muted-foreground/40 hover:border-primary"
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
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
          )}
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", priorityColor[task.priority])}>
              {priorityLabel[task.priority]}
            </Badge>
            {client && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {client.name}
              </Badge>
            )}
            {due && (
              <span
                className={cn(
                  "text-[10px] inline-flex items-center gap-1",
                  overdue ? "text-red-400" : dueToday ? "text-amber-400" : "text-muted-foreground"
                )}
              >
                <Calendar className="h-3 w-3" />
                {format(due, "dd MMM", { locale: ptBR })}
              </span>
            )}
            {assignee && (
              <Avatar className="h-5 w-5 ml-auto">
                <AvatarFallback className="text-[9px] bg-primary/15 text-primary">
                  {assignee.initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
