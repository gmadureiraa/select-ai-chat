import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SharePermission = "view" | "edit" | "admin";

export interface ProjectShare {
  id: string;
  project_id: string;
  shared_by: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  permission: SharePermission;
  created_at: string;
}

export const useResearchSharing = (projectId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["research-shares", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("research_project_shares")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProjectShare[];
    },
    enabled: !!projectId,
  });

  const shareProject = useMutation({
    mutationFn: async ({ 
      email, 
      permission = "view" 
    }: { 
      email: string; 
      permission?: SharePermission;
    }) => {
      const { data, error } = await supabase
        .from("research_project_shares")
        .insert([{ 
          project_id: projectId, 
          shared_with_email: email,
          permission,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["research-shares", projectId] });
      toast({ 
        title: "Projeto compartilhado", 
        description: `Convite enviado para ${variables.email}` 
      });
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast({
          title: "Já compartilhado",
          description: "Este projeto já foi compartilhado com este email.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao compartilhar",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ id, permission }: { id: string; permission: SharePermission }) => {
      const { data, error } = await supabase
        .from("research_project_shares")
        .update({ permission })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-shares", projectId] });
      toast({ title: "Permissão atualizada" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar permissão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeShare = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("research_project_shares")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-shares", projectId] });
      toast({ title: "Compartilhamento removido" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover compartilhamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    shares,
    isLoading,
    shareProject,
    updatePermission,
    removeShare,
  };
};
