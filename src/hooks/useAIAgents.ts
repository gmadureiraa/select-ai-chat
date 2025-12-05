import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { toast } from "sonner";
import type { AIAgent } from "@/types/agentBuilder";

export const useAIAgents = () => {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["ai-agents", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        tools: (item.tools || []) as unknown as AIAgent["tools"],
        knowledge: (item.knowledge || []) as unknown as string[],
        variables: (item.variables || {}) as Record<string, any>,
        metadata: (item.metadata || {}) as Record<string, any>,
      })) as AIAgent[];
    },
    enabled: !!workspace?.id,
  });

  const createAgent = useMutation({
    mutationFn: async (agent: Partial<AIAgent>) => {
      if (!workspace?.id) throw new Error("No workspace");
      
      const { data, error } = await supabase
        .from("ai_agents")
        .insert({
          name: agent.name || "Novo Agente",
          description: agent.description,
          avatar_url: agent.avatar_url,
          system_prompt: agent.system_prompt || "",
          model: agent.model || "google/gemini-2.5-flash",
          temperature: agent.temperature || 0.7,
          tools: agent.tools as any || [],
          knowledge: agent.knowledge as any || [],
          variables: agent.variables as any || {},
          memory_enabled: agent.memory_enabled ?? true,
          escalation_agent_id: agent.escalation_agent_id,
          metadata: agent.metadata as any || {},
          workspace_id: workspace.id,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        tools: (data.tools || []) as unknown as AIAgent["tools"],
        knowledge: (data.knowledge || []) as unknown as string[],
        variables: (data.variables || {}) as Record<string, any>,
        metadata: (data.metadata || {}) as Record<string, any>,
      } as AIAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("Agente criado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao criar agente: " + error.message);
    },
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIAgent> & { id: string }) => {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
      if (updates.system_prompt !== undefined) updateData.system_prompt = updates.system_prompt;
      if (updates.model !== undefined) updateData.model = updates.model;
      if (updates.temperature !== undefined) updateData.temperature = updates.temperature;
      if (updates.tools !== undefined) updateData.tools = updates.tools;
      if (updates.knowledge !== undefined) updateData.knowledge = updates.knowledge;
      if (updates.variables !== undefined) updateData.variables = updates.variables;
      if (updates.memory_enabled !== undefined) updateData.memory_enabled = updates.memory_enabled;
      if (updates.escalation_agent_id !== undefined) updateData.escalation_agent_id = updates.escalation_agent_id;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      const { data, error } = await supabase
        .from("ai_agents")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        tools: (data.tools || []) as unknown as AIAgent["tools"],
        knowledge: (data.knowledge || []) as unknown as string[],
        variables: (data.variables || {}) as Record<string, any>,
        metadata: (data.metadata || {}) as Record<string, any>,
      } as AIAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("Agente atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar agente: " + error.message);
    },
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("Agente excluído");
    },
    onError: (error) => {
      toast.error("Erro ao excluir agente: " + error.message);
    },
  });

  return {
    agents,
    isLoading,
    createAgent,
    updateAgent,
    deleteAgent,
  };
};
