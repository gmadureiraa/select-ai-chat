import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus,
  LayoutGrid,
  List as ListIcon,
  CalendarDays,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search as SearchIcon,
  X as XIcon,
} from "lucide-react";
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
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useTasksViewPrefs, type TasksGroupBy } from "@/hooks/useTasksViewPrefs";
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { TaskEmptyState } from "./TaskEmptyState";
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
  isPast,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const COLUMN_META: Record<TaskStatus, { title: string; dot: string; bar: string }> = {
  todo:        { title: "A fazer",       dot: "bg-blue-500",    bar: "bg-blue-500/60" },
  in_progress: { title: "Em andamento",  dot: "bg-amber-500",   bar: "bg-amber-500/60" },
  done:        { title: "Concluído",     dot: "bg-emerald-500", bar: "bg-emerald-500/60" },
};
const ORDER: TaskStatus[] = ["todo", "in_progress", "done"];

export function TeamTasksBoard({ defaultClientId }: { defaultClientId?: string | null }) {
  const { user } = useAuth();
  const { isViewer } = useWorkspace();
  const { workspace } = useWorkspaceContext();
  const { members } = useTeamMembers();
  const { clients } = useClients();
  const { prefs, update: updatePrefs } = useTasksViewPrefs(workspace?.id);

  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>(defaultClientId || "all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [defaultDueDate, setDefaultDueDate] = useState<Date | null>(null);

  const { tasks, isLoading, updateTask } = useTeamTasks({});

  // Auto-open task from ?openTask=<id> (e.g. notification click)
  useEffect(() => {
    if (typeof window === "undefined" || !tasks.length) return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("openTask");
    if (!openId) return;
    const t = tasks.find((x) => x.id === openId);
    if (t) {
      setEditingTask(t);
      setDialogOpen(true);
      params.delete("openTask");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [tasks]);

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
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterAssignee === "mine" && t.assigned_to !== user?.id) return false;
      if (filterAssignee !== "all" && filterAssignee !== "mine" && t.assigned_to !== filterAssignee) return false;
      if (filterClient === "none" && t.client_id) return false;
      if (filterClient !== "all" && filterClient !== "none" && t.client_id !== filterClient) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (!prefs.showDone && t.status === "done") return false;
      if (q) {
        const inTitle = t.title.toLowerCase().includes(q);
        const inDesc = (t.description || "").toLowerCase().includes(q);
        const inLabels = (t.labels || []).some((l) => l.name.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inLabels) return false;
      }
      return true;
    });
  }, [tasks, filterAssignee, filterClient, filterPriority, search, user?.id, prefs.showDone]);

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    let active = 0, overdue = 0, mine = 0, doneToday = 0;
    tasks.forEach((t) => {
      if (t.status !== "done") active++;
      if (t.assigned_to === user?.id && t.status !== "done") mine++;
      if (t.due_date && t.status !== "done") {
        const d = parseISO(t.due_date);
        if (isPast(d) && !isToday(d)) overdue++;
      }
      if (t.status === "done" && t.completed_at) {
        const c = parseISO(t.completed_at);
        if (isToday(c)) doneToday++;
      }
    });
    return { active, overdue, mine, doneToday };
  }, [tasks, user?.id]);

  const openNew = useCallback((status: TaskStatus = "todo", date: Date | null = null) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setDefaultDueDate(date);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((task: TeamTask) => {
    setEditingTask(task);
    setDefaultDueDate(null);
    setDialogOpen(true);
  }, []);

  const toggleDone = (task: TeamTask) => {
    const next: TaskStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({ id: task.id, status: next });
  };

  const filtersActive =
    filterAssignee !== "all" || filterClient !== "all" || filterPriority !== "all" || search !== "";

  const clearFilters = () => {
    setFilterAssignee("all");
    setFilterClient("all");
    setFilterPriority("all");
    setSearch("");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !isViewer) {
        e.preventDefault();
        openNew("todo");
      } else if (e.key === "/") {
        e.preventDefault();
        const el = document.getElementById("tasks-search-input") as HTMLInputElement | null;
        el?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNew, isViewer]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="pb-3 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Tarefas do time</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tarefas internas — separadas do planejamento de conteúdo.
            </p>
          </div>
          {!isViewer && (
            <Button size="sm" onClick={() => openNew("todo")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova tarefa
              <kbd className="ml-1 hidden md:inline text-[10px] bg-primary-foreground/20 px-1 rounded">N</kbd>
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <Kpi label="Ativas" value={kpis.active} />
          <Kpi label="Minhas" value={kpis.mine} tone="primary" />
          {kpis.overdue > 0 && <Kpi label="Atrasadas" value={kpis.overdue} tone="danger" />}
          {kpis.doneToday > 0 && <Kpi label="Concluídas hoje" value={kpis.doneToday} tone="success" />}
        </div>

        {/* Tabs + filters */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-4 border-b border-transparent">
            {(
              [
                { v: "board", icon: LayoutGrid, label: "Board" },
                { v: "list", icon: ListIcon, label: "Lista" },
                { v: "calendar", icon: CalendarDays, label: "Calendário" },
              ] as const
            ).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => updatePrefs({ view: v })}
                className={cn(
                  "relative flex items-center gap-1.5 text-xs py-1.5 transition-colors",
                  prefs.view === v ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {prefs.view === v && (
                  <span className="absolute -bottom-[13px] left-0 right-0 h-[2px] bg-primary rounded" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="relative">
              <SearchIcon className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tasks-search-input"
                placeholder="Buscar… (atalho: /)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-52 h-8 pl-7"
              />
            </div>

            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                <SelectItem value="mine">Minhas</SelectItem>
                {members.map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name || m.profile?.email || "Membro"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda prioridade</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>

            {prefs.view === "list" && (
              <Select
                value={prefs.groupBy}
                onValueChange={(v) => updatePrefs({ groupBy: v as TasksGroupBy })}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Agrupar: Status</SelectItem>
                  <SelectItem value="assignee">Agrupar: Responsável</SelectItem>
                  <SelectItem value="priority">Agrupar: Prioridade</SelectItem>
                  <SelectItem value="client">Agrupar: Cliente</SelectItem>
                  <SelectItem value="due">Agrupar: Data</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => updatePrefs({ showDone: !prefs.showDone })}
            >
              {prefs.showDone ? "Ocultar concluídas" : "Mostrar concluídas"}
            </Button>

            {filtersActive && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
                <XIcon className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <TaskEmptyState onCreate={!isViewer ? () => openNew("todo") : undefined} />
        ) : filtered.length === 0 ? (
          <TaskEmptyState filtered />
        ) : prefs.view === "board" ? (
          <BoardView
            tasks={filtered}
            memberMap={memberMap}
            clientMap={clientMap}
            onCardClick={openEdit}
            onToggleDone={toggleDone}
            onAddInColumn={(s) => openNew(s)}
            onMove={(task, status) => updateTask.mutate({ id: task.id, status })}
            isViewer={isViewer}
          />
        ) : prefs.view === "list" ? (
          <ListView
            tasks={filtered}
            groupBy={prefs.groupBy}
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
            onDayClick={(d) => !isViewer && openNew("todo", d)}
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
        defaultDueDate={defaultDueDate}
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "primary" | "danger" | "success" }) {
  const toneCls =
    tone === "danger"
      ? "bg-red-500/10 text-red-400 border-red-500/30"
      : tone === "primary"
        ? "bg-primary/10 text-primary border-primary/30"
        : tone === "success"
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          : "bg-muted/40 text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border", toneCls)}>
      <span className="font-semibold">{value}</span>
      <span>{label}</span>
    </span>
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
  const [hoverColumn, setHoverColumn] = useState<TaskStatus | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full pb-2">
      {ORDER.map((statusKey) => {
        const meta = COLUMN_META[statusKey];
        const colTasks = tasks.filter((t) => t.status === statusKey);
        const isHover = hoverColumn === statusKey && draggingId !== null;

        return (
          <div
            key={statusKey}
            className={cn(
              "flex flex-col rounded-lg border border-border/60 bg-muted/10 min-h-[200px] transition-all",
              isHover && "ring-2 ring-primary/50 bg-primary/5",
            )}
            onDragOver={(e) => { e.preventDefault(); setHoverColumn(statusKey); }}
            onDragLeave={() => setHoverColumn((c) => (c === statusKey ? null : c))}
            onDrop={() => {
              if (!draggingId) return;
              const t = tasks.find((x) => x.id === draggingId);
              if (t && t.status !== statusKey) onMove(t, statusKey);
              setDraggingId(null);
              setHoverColumn(null);
            }}
          >
            <div className={cn("h-[2px] rounded-t-lg", meta.bar)} />
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                <span className="text-sm font-medium">{meta.title}</span>
                <span className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-1.5">
                  {colTasks.length}
                </span>
              </div>
              {!isViewer && (
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onAddInColumn(statusKey)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex-1 px-2 space-y-2 overflow-y-auto">
              {colTasks.length === 0 ? (
                <div className="border border-dashed border-border/50 rounded-md p-4 text-center">
                  <p className="text-[11px] text-muted-foreground">Solte tarefas aqui</p>
                </div>
              ) : (
                colTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable={!isViewer}
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => { setDraggingId(null); setHoverColumn(null); }}
                    className={cn(draggingId === t.id && "opacity-40")}
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
            {!isViewer && (
              <button
                onClick={() => onAddInColumn(statusKey)}
                className="text-[11px] text-muted-foreground hover:text-foreground py-2 px-3 text-left border-t border-border/40 hover:bg-muted/30 transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" /> Adicionar tarefa
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- List ----------------
function ListView({
  tasks, groupBy, memberMap, clientMap, onCardClick, onToggleDone,
}: {
  tasks: TeamTask[];
  groupBy: TasksGroupBy;
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onCardClick: (t: TeamTask) => void;
  onToggleDone: (t: TeamTask) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: TeamTask[]; order: number }>();

    const ensure = (key: string, label: string, order: number) => {
      if (!map.has(key)) map.set(key, { label, items: [], order });
      return map.get(key)!;
    };

    tasks.forEach((t) => {
      switch (groupBy) {
        case "status": {
          const order = ORDER.indexOf(t.status);
          ensure(t.status, COLUMN_META[t.status].title, order).items.push(t);
          break;
        }
        case "assignee": {
          const k = t.assigned_to || "_none";
          const label = t.assigned_to ? (memberMap[t.assigned_to]?.name || "Membro") : "Sem responsável";
          ensure(k, label, t.assigned_to ? 0 : 99).items.push(t);
          break;
        }
        case "priority": {
          const ord = ["urgent", "high", "medium", "low"].indexOf(t.priority);
          ensure(t.priority, t.priority, ord).items.push(t);
          break;
        }
        case "client": {
          const k = t.client_id || "_none";
          const label = t.client_id ? (clientMap[t.client_id]?.name || "Cliente") : "Sem cliente";
          ensure(k, label, t.client_id ? 0 : 99).items.push(t);
          break;
        }
        case "due": {
          if (!t.due_date) ensure("_none", "Sem data", 99).items.push(t);
          else {
            const d = parseISO(t.due_date);
            const isOverdue = isPast(d) && !isToday(d) && t.status !== "done";
            const k = isOverdue ? "overdue" : isToday(d) ? "today" : "future";
            const label = isOverdue ? "Atrasadas" : isToday(d) ? "Hoje" : "Futuras";
            const ord = isOverdue ? 0 : isToday(d) ? 1 : 2;
            ensure(k, label, ord).items.push(t);
          }
          break;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [tasks, groupBy, memberMap, clientMap]);

  return (
    <div className="space-y-4 pb-2">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </h3>
            <span className="text-[10px] text-muted-foreground">{g.items.length}</span>
          </div>
          <div className="space-y-1.5">
            {g.items.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                memberMap={memberMap}
                clientMap={clientMap}
                onClick={() => onCardClick(t)}
                onToggleDone={() => onToggleDone(t)}
                density="compact"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Calendar ----------------
function CalendarView({
  tasks, memberMap, clientMap, onCardClick, onToggleDone, onDayClick,
}: {
  tasks: TeamTask[];
  memberMap: Record<string, { name: string; initials: string }>;
  clientMap: Record<string, { name: string }>;
  onCardClick: (t: TeamTask) => void;
  onToggleDone: (t: TeamTask) => void;
  onDayClick?: (d: Date) => void;
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
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date)!.push(t);
    });
    return map;
  }, [tasks]);

  const undated = tasks.filter((t) => !t.due_date);
  const priorityClass: Record<string, string> = {
    urgent: "bg-red-500/20 text-red-300 hover:bg-red-500/30",
    high: "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30",
    medium: "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30",
    low: "bg-muted text-muted-foreground hover:bg-muted/80",
  };

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
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("button")) return;
                onDayClick?.(day);
              }}
              className={cn(
                "bg-background min-h-[110px] p-1.5 flex flex-col gap-0.5 cursor-pointer hover:bg-muted/20 transition-colors",
                !inMonth && "opacity-40",
                today && "ring-1 ring-primary/40",
              )}
            >
              <span className={cn("text-[10px] font-medium", today && "text-primary")}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5 overflow-hidden">
                {dayTasks.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); onCardClick(t); }}
                    className={cn(
                      "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate transition-colors",
                      t.status === "done"
                        ? "bg-emerald-500/15 text-emerald-300 line-through"
                        : priorityClass[t.priority],
                    )}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 4 && (
                  <span className="text-[9px] text-muted-foreground">+{dayTasks.length - 4}</span>
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
