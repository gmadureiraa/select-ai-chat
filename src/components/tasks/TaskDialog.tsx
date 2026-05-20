import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { MentionableTextarea, extractMentionedIds, type MemberOption } from "./MentionableTextarea";
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
  // Multi-responsável (migration 0051). Array de user_ids; primary = assignees[0].
  const [assignees, setAssignees] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string>("none");
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [mentionIds, setMentionIds] = useState<string[]>([]);
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
      setAssignees(
        task.assignees && task.assignees.length > 0
          ? task.assignees
          : (task.assigned_to ? [task.assigned_to] : [])
      );
      setClientId(task.client_id || "none");
      setLabels(task.labels || []);
      setMentionIds(((task as any).mentions as string[]) || []);
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "todo");
      setPriority("medium");
      setDueDate(defaultDueDate || undefined);
      setAssignees([]);
      setClientId(defaultClientId || "none");
      setLabels([]);
      setMentionIds([]);
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

  const memberOptions: MemberOption[] = useMemo(
    () => members.map((m: any) => ({
      user_id: m.user_id,
      name: m.profile?.full_name || m.profile?.email || "Membro",
      email: m.profile?.email,
    })),
    [members],
  );

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    const ids = mentionIds.length ? mentionIds : extractMentionedIds(description, memberOptions);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      assignees,
      assigned_to: assignees[0] ?? null,
      client_id: clientId === "none" ? null : clientId,
      labels,
      mentions: ids,
    } as any;
    if (task) {
      await updateTask.mutateAsync({ id: task.id, ...payload });
    } else {
      await createTask.mutateAsync(payload);
    }
    onOpenChange(false);
  }, [
    title,
    description,
    mentionIds,
    memberOptions,
    status,
    priority,
    dueDate,
    assignees,
    clientId,
    labels,
    task,
    updateTask,
    createTask,
    onOpenChange,
  ]);

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
  }, [open, handleSave]);

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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Mais ações da tarefa"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar diálogo"
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
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
                      <MentionableTextarea
                        value={description}
                        onChange={(v, ids) => { setDescription(v); setMentionIds(ids); }}
                        members={memberOptions}
                        placeholder="Adicione detalhes, links, contexto… use @nome para mencionar"
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
                    <MentionableTextarea
                      value={description}
                      onChange={(v, ids) => { setDescription(v); setMentionIds(ids); }}
                      members={memberOptions}
                      placeholder="Adicione detalhes, links, contexto… use @nome para mencionar"
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
                {/* Multi-select de responsáveis (migration 0051) — Popover com
                    checkboxes. assignees[0] = primary pra retrocompat. */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-full justify-start font-normal px-2"
                    >
                      {assignees.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <span className="flex -space-x-1.5 shrink-0">
                            {assignees.slice(0, 3).map((id) => {
                              const m: any = members.find((mm: any) => mm.user_id === id);
                              const name = m?.profile?.full_name || m?.profile?.email || "Membro";
                              return (
                                <Avatar key={id} className="h-4 w-4 ring-1 ring-background">
                                  <AvatarFallback className="text-[8px] bg-primary/15 text-primary">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                          </span>
                          <span className="truncate text-sm">
                            {assignees.length === 1
                              ? ((members.find((m: any) => m.user_id === assignees[0]) as any)?.profile?.full_name || "Membro")
                              : `${assignees.length} responsáveis`}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Ninguém</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-1.5" align="start">
                    {members.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-1.5">Sem membros</p>
                    )}
                    {members.map((m: any) => {
                      const name = m.profile?.full_name || m.profile?.email || "Membro";
                      const checked = assignees.includes(m.user_id);
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => {
                            setAssignees((prev) =>
                              prev.includes(m.user_id)
                                ? prev.filter((id) => id !== m.user_id)
                                : [...prev, m.user_id]
                            );
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left",
                            "hover:bg-accent transition-colors",
                          )}
                        >
                          <Checkbox checked={checked} className="h-4 w-4 pointer-events-none" />
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                              {getInitials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate flex-1">{name}</span>
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
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
