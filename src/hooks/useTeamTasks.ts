import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

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
  created_at: string;
  updated_at: string;
}

export interface TeamTaskFilters {
  status?: TaskStatus;
  assignedTo?: string;
  clientId?: string | null;
  onlyMine?: boolean;
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
  });

  // Realtime
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`team_tasks:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_tasks", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["team-tasks", workspaceId] });
          queryClient.invalidateQueries({ queryKey: ["my-team-tasks", workspaceId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);

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

// Dashboard hook: tarefas pendentes do usuário logado
export function useMyTeamTasks(limit = 5) {
  const { user } = useAuth();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;

  return useQuery({
    queryKey: ["my-team-tasks", workspaceId, user?.id, limit],
    queryFn: async () => {
      if (!workspaceId || !user?.id) return [];
      const { data, error } = await supabase
        .from("team_tasks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("assigned_to", user.id)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return ((data || []) as unknown) as TeamTask[];
    },
    enabled: !!workspaceId && !!user?.id,
  });
}
