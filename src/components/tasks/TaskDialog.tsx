import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Loader2,
  Trash2,
  Copy,
  MoreHorizontal,
  MessageSquare,
  ListChecks,
  X as XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useClients } from "@/hooks/useClients";
import {
  useTeamTasks,
  type TeamTask,
  type TaskStatus,
  type TaskPriority,
  type TaskLabel,
} from "@/hooks/useTeamTasks";
import { TaskChecklist } from "./TaskChecklist";
import { TaskComments } from "./TaskComments";
import { TaskLabelsEditor } from "./TaskLabelsEditor";
import { useTaskComments } from "@/hooks/useTaskComments";
import { cn } from "@/lib/utils";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TeamTask | null;
  defaultStatus?: TaskStatus;
  defaultClientId?: string | null;
  defaultDueDate?: Date | null;
}

const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo", label: "A fazer", color: "bg-blue-500" },
  { value: "in_progress", label: "Em andamento", color: "bg-amber-500" },
  { value: "done", label: "Concluído", color: "bg-emerald-500" },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Baixa", color: "bg-muted-foreground/40" },
  { value: "medium", label: "Média", color: "bg-blue-500" },
  { value: "high", label: "Alta", color: "bg-orange-500" },
  { value: "urgent", label: "Urgente", color: "bg-red-500" },
];

function getInitials(name?: string | null) {
  if (!name) return "👤";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "👤";
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultStatus,
  defaultClientId,
  defaultDueDate,
}: TaskDialogProps) {
  const { members } = useTeamMembers();
  const { clients } = useClients();
  const { createTask, updateTask, deleteTask, duplicateTask } = useTeamTasks();
  const { comments } = useTaskComments(task?.id ?? null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [clientId, setClientId] = useState<string>("none");
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"details" | "comments">("details");

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? parseISO(task.due_date) : undefined);
      setAssignedTo(task.assigned_to || "none");
      setClientId(task.client_id || "none");
      setLabels(task.labels || []);
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "todo");
      setPriority("medium");
      setDueDate(defaultDueDate || undefined);
      setAssignedTo("none");
      setClientId(defaultClientId || "none");
      setLabels([]);
    }
    setTab("details");
  }, [open, task, defaultStatus, defaultClientId, defaultDueDate]);

  const memberMap = useMemo(() => {
    const m: Record<string, { name: string; initials: string }> = {};
    members.forEach((mem: any) => {
      const name = mem.profile?.full_name || mem.profile?.email || "Membro";
      m[mem.user_id] = { name, initials: getInitials(name) };
    });
    return m;
  }, [members]);

  const handleSave = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      assigned_to: assignedTo === "none" ? null : assignedTo,
      client_id: clientId === "none" ? null : clientId,
      labels,
    };
    if (task) {
      await updateTask.mutateAsync({ id: task.id, ...payload });
    } else {
      await createTask.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!task) return;
    await deleteTask.mutateAsync(task.id);
    setConfirmDelete(false);
    onOpenChange(false);
  };

  const handleDuplicate = async () => {
    if (!task) return;
    await duplicateTask.mutateAsync(task);
    onOpenChange(false);
  };

  const isSaving = createTask.isPending || updateTask.isPending;
  const currentStatus = statusOptions.find((s) => s.value === status)!;
  const currentPriority = priorityOptions.find((p) => p.value === priority)!;

  // Cmd+Enter shortcut
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, description, status, priority, dueDate, assignedTo, clientId, labels]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", currentStatus.color)} />
              <span>{task ? "Tarefa" : "Nova tarefa"}</span>
              {task && (
                <span>· criada {format(new Date(task.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {task && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDuplicate}>
                      <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar tarefa
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDelete(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir tarefa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body: 2 columns */}
          <div className="flex flex-col md:flex-row max-h-[75vh] min-h-[420px]">
            {/* Main */}
            <div className="flex-1 min-w-0 p-5 overflow-y-auto">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da tarefa"
                autoFocus
                className="text-lg font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 shadow-none h-auto py-1"
              />

              {task ? (
                <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-2">
                  <TabsList className="bg-transparent border-b border-border/40 h-auto rounded-none p-0 w-full justify-start gap-4">
                    <TabsTrigger
                      value="details"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 pb-2 pt-0 h-auto data-[state=active]:shadow-none text-xs gap-1.5"
                    >
                      <ListChecks className="h-3.5 w-3.5" /> Detalhes
                    </TabsTrigger>
                    <TabsTrigger
                      value="comments"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 pb-2 pt-0 h-auto data-[state=active]:shadow-none text-xs gap-1.5"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Comentários
                      {comments.length > 0 && (
                        <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5">
                          {comments.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-4 space-y-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Adicione detalhes, links, contexto…"
                        rows={4}
                      />
                    </div>
                    <TaskChecklist taskId={task.id} />
                  </TabsContent>

                  <TabsContent value="comments" className="mt-4">
                    <TaskComments taskId={task.id} />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="space-y-4 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Descrição</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Adicione detalhes, links, contexto…"
                      rows={5}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Subtarefas e comentários ficam disponíveis após salvar.
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="w-full md:w-[260px] shrink-0 border-t md:border-t-0 md:border-l border-border/40 bg-muted/10 p-4 space-y-4 overflow-y-auto">
              <SidebarField label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", s.color)} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField label="Prioridade">
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", p.color)} />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField label="Responsável">
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Ninguém" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {members.map((m: any) => {
                      const name = m.profile?.full_name || m.profile?.email || "Membro";
                      return (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          <span className="inline-flex items-center gap-2">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px] bg-primary/15 text-primary">
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                            {name}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField label="Data limite">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start font-normal h-8", !dueDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                      {dueDate ? format(dueDate, "dd MMM yyyy", { locale: ptBR }) : "Sem data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ptBR} initialFocus />
                    {dueDate && (
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>
                          Limpar data
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </SidebarField>

              <SidebarField label="Cliente">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SidebarField>

              <SidebarField label="Etiquetas">
                <TaskLabelsEditor value={labels} onChange={setLabels} />
              </SidebarField>

              {task && (
                <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground space-y-1">
                  <div>Criada por <span className="text-foreground">{memberMap[task.created_by]?.name || "—"}</span></div>
                  <div>Atualizada {format(new Date(task.updated_at), "dd MMM HH:mm", { locale: ptBR })}</div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/40 bg-card">
            <span className="text-[10px] text-muted-foreground mr-auto hidden md:inline">
              ⌘ + ↵ para salvar
            </span>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {task ? "Salvar" : "Criar tarefa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Subtarefas e comentários também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}
