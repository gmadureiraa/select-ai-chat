import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskRecurrenceType = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export interface TaskLabel {
  name: string;
  color: string;
}

export interface TeamTask {
  id: string;
  workspace_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  completed_at: string | null;
  position: number;
  labels: TaskLabel[];
  mentions?: string[];
  recurrence_type: TaskRecurrenceType | null;
  recurrence_days: string[];
  recurrence_time: string | null;
  recurrence_end_date: string | null;
  recurrence_parent_id: string | null;
  is_recurrence_template: boolean;
  last_recurrence_created_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamTaskFilters {
  status?: TaskStatus;
  assignedTo?: string;
  clientId?: string | null;
  onlyMine?: boolean;
  /**
   * Inclui templates de recorrência (cards "matrix" que o cron usa pra
   * materializar instâncias diárias). Por padrão NÃO aparecem no board
   * pra evitar visual duplicado (template + instância).
   * Set true em telas de gestão de recorrências.
   */
  includeRecurrenceTemplates?: boolean;
}

export interface CreateTeamTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assigned_to?: string | null;
  client_id?: string | null;
  labels?: TaskLabel[];
  mentions?: string[];
  recurrence_type?: TaskRecurrenceType | null;
  recurrence_days?: string[];
  recurrence_time?: string | null;
  recurrence_end_date?: string | null;
  is_recurrence_template?: boolean;
}

export function useTeamTasks(filters: TeamTaskFilters = {}) {
  const { user } = useAuth();
  const { workspace } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;

  const queryKey = ["team-tasks", workspaceId, filters];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!workspaceId) return [];
      let q = supabase
        .from("team_tasks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });

      // Templates de recorrência são "blueprints" do cron — NÃO devem aparecer
      // no kanban junto com as instâncias geradas. Filtrar fora por padrão.
      if (!filters.includeRecurrenceTemplates) {
        q = q.or("is_recurrence_template.is.null,is_recurrence_template.eq.false");
      }
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
      if (filters.onlyMine && user?.id) q = q.eq("assigned_to", user.id);
      if (filters.clientId === null) q = q.is("client_id", null);
      else if (filters.clientId) q = q.eq("client_id", filters.clientId);

      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as unknown) as TeamTask[];
    },
    enabled: !!workspaceId,
    // Substitui Supabase Realtime: poll a cada 30s para refletir
    // alterações em tasks vindas de outros membros do workspace
    // (kanban colaborativo). Mutations locais já invalidam imediato.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  const createTask = useMutation({
    mutationFn: async (input: CreateTeamTaskInput) => {
      if (!workspaceId || !user?.id) throw new Error("No workspace/user");
      const { data, error } = await supabase
        .from("team_tasks")
        .insert({
          workspace_id: workspaceId,
          created_by: user.id,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? "todo",
          priority: input.priority ?? "medium",
          due_date: input.due_date ?? null,
          assigned_to: input.assigned_to ?? null,
          client_id: input.client_id ?? null,
          labels: (input.labels ?? []) as any,
          mentions: input.mentions ?? [],
          recurrence_type: input.recurrence_type ?? null,
          recurrence_days: input.recurrence_days ?? [],
          recurrence_time: input.recurrence_time ?? null,
          recurrence_end_date: input.recurrence_end_date ?? null,
          is_recurrence_template: input.is_recurrence_template ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TeamTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-tasks", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["my-team-tasks", workspaceId] });
      toast.success("Tarefa criada");
    },
    onError: (e: Error) => toast.error("Erro ao criar tarefa", { description: e.message }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<TeamTask>) => {
      const { data, error } = await supabase
        .from("team_tasks")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TeamTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-tasks", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["my-team-tasks", workspaceId] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar tarefa", { description: e.message }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-tasks", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["my-team-tasks", workspaceId] });
      toast.success("Tarefa excluída");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const duplicateTask = useMutation({
    mutationFn: async (task: TeamTask) => {
      if (!workspaceId || !user?.id) throw new Error("No workspace/user");
      const { data, error } = await supabase
        .from("team_tasks")
        .insert({
          workspace_id: workspaceId,
          created_by: user.id,
          title: `${task.title} (cópia)`,
          description: task.description,
          status: "todo",
          priority: task.priority,
          due_date: task.due_date,
          assigned_to: null,
          client_id: task.client_id,
          labels: (task.labels ?? []) as any,
          mentions: task.mentions ?? [],
          recurrence_type: task.recurrence_type,
          recurrence_days: task.recurrence_days ?? [],
          recurrence_time: task.recurrence_time,
          recurrence_end_date: task.recurrence_end_date,
          // Duplicado NUNCA é template — sempre instância nova.
          is_recurrence_template: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TeamTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-tasks", workspaceId] });
      toast.success("Tarefa duplicada");
    },
    onError: (e: Error) => toast.error("Erro ao duplicar", { description: e.message }),
  });

  return { tasks, isLoading, createTask, updateTask, deleteTask, duplicateTask };
}

// Dashboard hook: tarefas relevantes para o usuário (atribuídas a mim
// OU sem responsável e com vencimento próximo) — nunca filtra por cliente.
export function useMyTeamTasks(limit = 5) {
  const { user } = useAuth();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;

  return useQuery({
    queryKey: ["my-team-tasks", workspaceId, user?.id, limit],
    queryFn: async () => {
      if (!workspaceId || !user?.id) return [];
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayIso = today.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("team_tasks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .neq("status", "done")
        .or(`assigned_to.eq.${user.id},and(assigned_to.is.null,due_date.lte.${todayIso})`)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return ((data || []) as unknown) as TeamTask[];
    },
    enabled: !!workspaceId && !!user?.id,
  });
}
