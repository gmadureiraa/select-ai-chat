import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, CheckSquare, ArrowRight, Calendar, Plus } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyTeamTasks, useTeamTasks, type TeamTask } from "@/hooks/useTeamTasks";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { cn } from "@/lib/utils";

interface MyTasksWidgetProps {
  onNavigate: (tab: string) => void;
}

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/40",
};

export function MyTasksWidget({ onNavigate }: MyTasksWidgetProps) {
  const { data: tasks = [], isLoading } = useMyTeamTasks(7);
  const { updateTask } = useTeamTasks();
  const [editing, setEditing] = useState<TeamTask | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const overdueCount = tasks.filter(
    (t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)),
  ).length;

  return (
    <>
      <Card className="bg-card/50 border-border/40">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Suas tarefas</CardTitle>
            {tasks.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-5">
                {tasks.length} pendente{tasks.length === 1 ? "" : "s"}
              </Badge>
            )}
            {overdueCount > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 bg-red-500/15 text-red-400 border-red-500/30">
                {overdueCount} atrasada{overdueCount === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => { setEditing(null); setCreating(true); setOpen(true); }}
              title="Criar tarefa"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onNavigate("tasks")}>
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-3">Carregando…</p>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">
              Nenhuma tarefa pendente.{" "}
              <button
                className="text-primary hover:underline"
                onClick={() => { setEditing(null); setCreating(true); setOpen(true); }}
              >
                Criar uma
              </button>
            </p>
          ) : (
            <div className="space-y-1">
              {tasks.map((t) => {
                const due = t.due_date ? parseISO(t.due_date) : null;
                const overdue = due && isPast(due) && !isToday(due);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer group"
                    onClick={() => { setEditing(t); setCreating(false); setOpen(true); }}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", priorityDot[t.priority])} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTask.mutate({ id: t.id, status: "done" });
                      }}
                      className="h-4 w-4 rounded-full border border-muted-foreground/40 hover:border-primary hover:bg-primary/10 flex items-center justify-center"
                      aria-label="Concluir"
                    >
                      <CheckCircle2 className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                    </button>
                    <span className="text-sm flex-1 truncate">{t.title}</span>
                    {due && (
                      <span className={cn("text-[10px] flex items-center gap-1", overdue ? "text-red-400" : "text-muted-foreground")}>
                        <Calendar className="h-3 w-3" />
                        {format(due, "dd MMM", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDialog open={open} onOpenChange={setOpen} task={creating ? null : editing} />
    </>
  );
}
