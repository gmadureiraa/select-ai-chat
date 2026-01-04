import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import type { RssTrigger, CreateRssTriggerInput, UpdateRssTriggerInput } from "@/types/rssTrigger";

export function useRssTriggers() {
  const { workspace: currentWorkspace } = useWorkspaceContext();
  const queryClient = useQueryClient();

  const { data: triggers, isLoading } = useQuery({
    queryKey: ["rss-triggers", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from("rss_triggers")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RssTrigger[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const createTrigger = useMutation({
    mutationFn: async (input: CreateRssTriggerInput) => {
      const { data, error } = await supabase
        .from("rss_triggers")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rss-triggers"] });
      toast.success("RSS Trigger criado com sucesso");
    },
    onError: (error) => {
      console.error("Error creating RSS trigger:", error);
      toast.error("Erro ao criar RSS Trigger");
    },
  });

  const updateTrigger = useMutation({
    mutationFn: async ({ id, ...input }: UpdateRssTriggerInput & { id: string }) => {
      const { data, error } = await supabase
        .from("rss_triggers")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rss-triggers"] });
      toast.success("RSS Trigger atualizado");
    },
    onError: (error) => {
      console.error("Error updating RSS trigger:", error);
      toast.error("Erro ao atualizar RSS Trigger");
    },
  });

  const deleteTrigger = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rss_triggers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rss-triggers"] });
      toast.success("RSS Trigger removido");
    },
    onError: (error) => {
      console.error("Error deleting RSS trigger:", error);
      toast.error("Erro ao remover RSS Trigger");
    },
  });

  const toggleTrigger = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("rss_triggers")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rss-triggers"] });
      toast.success(data.is_active ? "RSS Trigger ativado" : "RSS Trigger desativado");
    },
    onError: (error) => {
      console.error("Error toggling RSS trigger:", error);
      toast.error("Erro ao alterar status do RSS Trigger");
    },
  });

  const testFeed = async (rssUrl: string): Promise<{ success: boolean; items?: number; error?: string }> => {
    try {
      const response = await fetch(rssUrl);
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const text = await response.text();
      const itemCount = (text.match(/<item>/gi) || []).length;
      
      return { success: true, items: itemCount };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Erro ao testar feed" 
      };
    }
  };

  const previewTrigger = useMutation({
    mutationFn: async (triggerId: string) => {
      const { data, error } = await supabase.functions.invoke('test-rss-trigger', {
        body: { triggerId, createCard: false }
      });
      if (error) throw error;
      return data;
    },
    onError: (error) => {
      console.error("Error previewing RSS trigger:", error);
      toast.error("Erro ao visualizar feed RSS");
    },
  });

  const executeTrigger = useMutation({
    mutationFn: async (triggerId: string) => {
      const { data, error } = await supabase.functions.invoke('test-rss-trigger', {
        body: { triggerId, createCard: true }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.created) {
        queryClient.invalidateQueries({ queryKey: ["planning-items"] });
        toast.success(`Card criado: ${data.preview?.title?.substring(0, 50)}...`);
      } else {
        toast.info("Nenhum card novo para criar");
      }
    },
    onError: (error) => {
      console.error("Error executing RSS trigger:", error);
      toast.error("Erro ao executar RSS Trigger");
    },
  });

  return {
    triggers,
    isLoading,
    createTrigger,
    updateTrigger,
    deleteTrigger,
    toggleTrigger,
    testFeed,
    previewTrigger,
    executeTrigger,
  };
}
