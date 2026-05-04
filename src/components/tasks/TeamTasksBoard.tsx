import { useMemo, useState } from "react";
import { Plus, LayoutGrid, List as ListIcon, CalendarDays, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeamTasks, type TeamTask, type TaskStatus } from "@/hooks/useTeamTasks";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

type View = "board" | "list" | "calendar";

const COLUMNS: { id: TaskStatus; title: string; tone: string }[] = [
  { id: "todo", title: "A fazer", tone: "border-l-blue-500/60" },
  { id: "in_progress", title: "Em andamento", tone: "border-l-amber-500/60" },
  { id: "done", title: "Concluído", tone: "border-l-emerald-500/60" },
];

export function TeamTasksBoard({ defaultClientId }: { defaultClientId?: string | null }) {
  const { user } = useAuth();
  const { isViewer } = useWorkspace();
  const { members } = useTeamMembers();
  const { clients } = useClients();
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>(defaultClientId || "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");

  const { tasks, isLoading, updateTask } = useTeamTasks({});

  const memberMap = useMemo(() => {
    const map: Record<string, { name: string; initials: string }> = {};
    members.forEach((m: any) => {
      const fullName = m.profile?.full_name || m.profile?.email || "Membro";
      const parts = fullName.trim().split(/\s+/);
      const initials = ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "👤";
      const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
      map[m.user_id] = { name: shortName, initials };
    });
    return map;
  }, [members]);

  const clientMap = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    clients?.forEach((c) => { map[c.id] = { name: c.name }; });
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterAssignee === "mine" && t.assigned_to !== user?.id) return false;
      if (filterAssignee !== "all" && filterAssignee !== "mine" && t.assigned_to !== filterAssignee) return false;
      if (filterClient === "none" && t.client_id) return false;
      if (filterClient !== "all" && filterClient !== "none" && t.client_id !== filterClient) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterAssignee, filterClient, search, user?.id]);

  const openNew = (status: TaskStatus = "todo") => {
    setEditingTask(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const openEdit = (task: TeamTask) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const toggleDone = (task: TeamTask) => {
    const next: TaskStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({ id: task.id, status: next });
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div>
          <h1 className="text-lg font-semibold">Tarefas do time</h1>
          <p className="text-xs text-muted-foreground">Tarefas internas — separadas do planejamento de conteúdo.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="rounded-none h-8" onClick={() => setView("board")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="rounded-none h-8" onClick={() => setView("list")}>
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
            <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" className="rounded-none h-8" onClick={() => setView("calendar")}>
              <CalendarDays className="h-3.5 w-3.5" />
            </Button>
          </div>
          {!isViewer && (
            <Button size="sm" onClick={() => openNew("todo")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova tarefa
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 py-3 flex-wrap">
        <Input
          placeholder="Buscar tarefa…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 h-8"
        />
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-44 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            <SelectItem value="mine">Minhas tarefas</SelectItem>
            {members.map((m: any) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.profile?.full_name || m.profile?.email || "Membro"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-44 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            <SelectItem value="none">Sem cliente</SelectItem>
            {clients?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} {filtered.length === 1 ? "tarefa" : "tarefas"}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : view === "board" ? (
          <BoardView
            tasks={filtered}
            memberMap={memberMap}
            clientMap={clientMap}
            onCardClick={openEdit}
            onToggleDone={toggleDone}
            onAddInColumn={openNew}
            onMove={(task, status) => updateTask.mutate({ id: task.id, status })}
            isViewer={isViewer}
          />
        ) : view === "list" ? (
          <ListView
            tasks={filtered}
            memberMap={memberMap}
            clientMap={clientMap}
            onCardClick={openEdit}
            onToggleDone={toggleDone}
          />
        ) : (
          <CalendarView
            tasks={filtered}
            memberMap={memberMap}
            clientMap={clientMap}
            onCardClick={openEdit}
            onToggleDone={toggleDone}
          />
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultStatus={defaultStatus}
        defaultClientId={filterClient !== "all" && filterClient !== "none" ? filterClient : null}
      />
    </div>
  );
}

// ---------------- Board (Kanban) ----------------
interface BoardProps {
  tasks: TeamTask[];
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onCardClick: (t: TeamTask) => void;
  onToggleDone: (t: TeamTask) => void;
  onAddInColumn: (status: TaskStatus) => void;
  onMove: (task: TeamTask, status: TaskStatus) => void;
  isViewer: boolean;
}

function BoardView({ tasks, memberMap, clientMap, onCardClick, onToggleDone, onAddInColumn, onMove, isViewer }: BoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full pb-2">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        return (
          <div
            key={col.id}
            className={cn("flex flex-col rounded-md border-l-4 border bg-muted/20 min-h-[200px]", col.tone)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!draggingId) return;
              const t = tasks.find((x) => x.id === draggingId);
              if (t && t.status !== col.id) onMove(t, col.id);
              setDraggingId(null);
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{col.title}</span>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
              </div>
              {!isViewer && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddInColumn(col.id)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {colTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa</p>
              ) : (
                colTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable={!isViewer}
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <TaskCard
                      task={t}
                      memberMap={memberMap}
                      clientMap={clientMap}
                      onClick={() => onCardClick(t)}
                      onToggleDone={() => onToggleDone(t)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- List ----------------
function ListView({
  tasks, memberMap, clientMap, onCardClick, onToggleDone,
}: {
  tasks: TeamTask[];
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onCardClick: (t: TeamTask) => void;
  onToggleDone: (t: TeamTask) => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma tarefa encontrada</p>;
  }
  return (
    <div className="space-y-1.5 pb-2">
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          memberMap={memberMap}
          clientMap={clientMap}
          onClick={() => onCardClick(t)}
          onToggleDone={() => onToggleDone(t)}
        />
      ))}
    </div>
  );
}

// ---------------- Calendar ----------------
function CalendarView({
  tasks, memberMap, clientMap, onCardClick, onToggleDone,
}: {
  tasks: TeamTask[];
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onCardClick: (t: TeamTask) => void;
  onToggleDone: (t: TeamTask) => void;
}) {
  const [month, setMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TeamTask[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const key = t.due_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  const undated = tasks.filter((t) => !t.due_date);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-medium capitalize">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setMonth(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden flex-1 min-h-0">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground font-medium">{d}</div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const dayTasks = tasksByDay.get(key) || [];
          const today = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={cn(
                "bg-background min-h-[80px] p-1 flex flex-col gap-0.5",
                !inMonth && "opacity-40",
                today && "ring-1 ring-primary/40"
              )}
            >
              <span className={cn("text-[10px] font-medium", today && "text-primary")}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5 overflow-hidden">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onCardClick(t)}
                    className={cn(
                      "w-full text-left text-[10px] px-1 py-0.5 rounded truncate",
                      t.status === "done"
                        ? "bg-emerald-500/15 text-emerald-300 line-through"
                        : "bg-primary/15 text-primary hover:bg-primary/25"
                    )}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{dayTasks.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <p className="text-xs text-muted-foreground mb-2">Sem data ({undated.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {undated.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                memberMap={memberMap}
                clientMap={clientMap}
                onClick={() => onCardClick(t)}
                onToggleDone={() => onToggleDone(t)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
