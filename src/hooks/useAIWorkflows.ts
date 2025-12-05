import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { toast } from "sonner";
import type { AIWorkflow, AIWorkflowNode, AIWorkflowConnection, TriggerConfig, NodeConfig } from "@/types/agentBuilder";

export const useAIWorkflows = () => {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["ai-workflows", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const { data, error } = await supabase
        .from("ai_workflows")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        trigger_config: (item.trigger_config || { type: "manual" }) as unknown as TriggerConfig,
        metadata: (item.metadata || {}) as Record<string, any>,
      })) as AIWorkflow[];
    },
    enabled: !!workspace?.id,
  });

  const createWorkflow = useMutation({
    mutationFn: async (workflow: Partial<AIWorkflow>) => {
      if (!workspace?.id) throw new Error("No workspace");
      
      const { data, error } = await supabase
        .from("ai_workflows")
        .insert({
          name: workflow.name || "Novo Workflow",
          description: workflow.description,
          is_active: workflow.is_active ?? false,
          trigger_config: (workflow.trigger_config || { type: "manual" }) as any,
          metadata: (workflow.metadata || {}) as any,
          workspace_id: workspace.id,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        trigger_config: (data.trigger_config || { type: "manual" }) as unknown as TriggerConfig,
        metadata: (data.metadata || {}) as Record<string, any>,
      } as AIWorkflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workflows"] });
      toast.success("Workflow criado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar workflow: " + error.message);
    },
  });

  const updateWorkflow = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIWorkflow> & { id: string }) => {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.trigger_config !== undefined) updateData.trigger_config = updates.trigger_config;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      const { data, error } = await supabase
        .from("ai_workflows")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        trigger_config: (data.trigger_config || { type: "manual" }) as unknown as TriggerConfig,
        metadata: (data.metadata || {}) as Record<string, any>,
      } as AIWorkflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workflows"] });
      toast.success("Workflow atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar workflow: " + error.message);
    },
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_workflows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workflows"] });
      toast.success("Workflow excluído");
    },
    onError: (error) => {
      toast.error("Erro ao excluir workflow: " + error.message);
    },
  });

  return {
    workflows,
    isLoading,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
  };
};

export const useWorkflowNodes = (workflowId: string | null) => {
  const queryClient = useQueryClient();

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["workflow-nodes", workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      
      const { data, error } = await supabase
        .from("ai_workflow_nodes")
        .select("*")
        .eq("workflow_id", workflowId);

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        position_x: Number(item.position_x) || 0,
        position_y: Number(item.position_y) || 0,
        config: (item.config || {}) as NodeConfig,
      })) as AIWorkflowNode[];
    },
    enabled: !!workflowId,
  });

  const createNode = useMutation({
    mutationFn: async (node: Partial<AIWorkflowNode>) => {
      const { data, error } = await supabase
        .from("ai_workflow_nodes")
        .insert({
          workflow_id: node.workflow_id!,
          type: node.type!,
          agent_id: node.agent_id,
          config: (node.config || {}) as any,
          position_x: node.position_x || 0,
          position_y: node.position_y || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        position_x: Number(data.position_x) || 0,
        position_y: Number(data.position_y) || 0,
        config: (data.config || {}) as NodeConfig,
      } as AIWorkflowNode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-nodes", workflowId] });
    },
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIWorkflowNode> & { id: string }) => {
      const updateData: any = {};
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.agent_id !== undefined) updateData.agent_id = updates.agent_id;
      if (updates.config !== undefined) updateData.config = updates.config;
      if (updates.position_x !== undefined) updateData.position_x = updates.position_x;
      if (updates.position_y !== undefined) updateData.position_y = updates.position_y;

      const { data, error } = await supabase
        .from("ai_workflow_nodes")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        position_x: Number(data.position_x) || 0,
        position_y: Number(data.position_y) || 0,
        config: (data.config || {}) as NodeConfig,
      } as AIWorkflowNode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-nodes", workflowId] });
    },
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_workflow_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-nodes", workflowId] });
    },
  });

  return {
    nodes,
    isLoading,
    createNode,
    updateNode,
    deleteNode,
  };
};

export const useWorkflowConnections = (workflowId: string | null) => {
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["workflow-connections", workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      
      const { data, error } = await supabase
        .from("ai_workflow_connections")
        .select("*")
        .eq("workflow_id", workflowId);

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        connection_type: (item.connection_type || "default") as AIWorkflowConnection["connection_type"],
      })) as AIWorkflowConnection[];
    },
    enabled: !!workflowId,
  });

  const createConnection = useMutation({
    mutationFn: async (connection: Partial<AIWorkflowConnection>) => {
      const { data, error } = await supabase
        .from("ai_workflow_connections")
        .insert({
          workflow_id: connection.workflow_id!,
          source_node_id: connection.source_node_id!,
          target_node_id: connection.target_node_id!,
          connection_type: connection.connection_type || "default",
          label: connection.label,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        connection_type: (data.connection_type || "default") as AIWorkflowConnection["connection_type"],
      } as AIWorkflowConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-connections", workflowId] });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_workflow_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-connections", workflowId] });
    },
  });

  return {
    connections,
    isLoading,
    createConnection,
    deleteConnection,
  };
};
