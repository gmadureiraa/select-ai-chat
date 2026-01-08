import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Json } from "@/integrations/supabase/types";

export interface FormatRule {
  id: string;
  workspace_id: string;
  format_id: string;
  name: string;
  description: string | null;
  rules: Json;
  prompt_template: string | null;
  is_system: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CreateFormatRuleInput {
  format_id: string;
  name: string;
  description?: string;
  rules: Json;
  prompt_template?: string;
}

export const useFormatRules = () => {
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();

  const { data: formatRules, isLoading } = useQuery({
    queryKey: ["format-rules", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const { data, error } = await supabase
        .from("format_rules")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name");

      if (error) throw error;
      return data as FormatRule[];
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateFormatRuleInput) => {
      if (!workspaceId) throw new Error("Workspace não encontrado");

      const { data, error } = await supabase
        .from("format_rules")
        .insert({
          workspace_id: workspaceId,
          format_id: input.format_id,
          name: input.name,
          description: input.description || null,
          rules: input.rules,
          prompt_template: input.prompt_template || null,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Formato criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["format-rules", workspaceId] });
    },
    onError: () => {
      toast({ title: "Erro ao criar formato", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FormatRule> & { id: string }) => {
      const { data, error } = await supabase
        .from("format_rules")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Formato atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["format-rules", workspaceId] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar formato", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("format_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Formato excluído!" });
      queryClient.invalidateQueries({ queryKey: ["format-rules", workspaceId] });
    },
    onError: () => {
      toast({ title: "Erro ao excluir formato", variant: "destructive" });
    },
  });

  return {
    formatRules: formatRules || [],
    isLoading,
    createFormatRule: createMutation.mutateAsync,
    updateFormatRule: updateMutation.mutateAsync,
    deleteFormatRule: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
};
