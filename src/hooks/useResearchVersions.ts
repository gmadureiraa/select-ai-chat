import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResearchItem, ResearchConnection } from "./useResearchItems";

export interface ProjectVersion {
  id: string;
  project_id: string;
  user_id: string;
  version_number: number;
  name: string | null;
  description: string | null;
  snapshot: {
    items: ResearchItem[];
    connections: ResearchConnection[];
  };
  created_at: string;
}

export const useResearchVersions = (projectId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["research-versions", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("research_project_versions")
        .select("*")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return data.map(v => ({
        ...v,
        snapshot: v.snapshot as unknown as { items: ResearchItem[]; connections: ResearchConnection[] }
      })) as ProjectVersion[];
    },
    enabled: !!projectId,
  });

  const createVersion = useMutation({
    mutationFn: async ({ 
      name, 
      description,
      items,
      connections,
    }: { 
      name?: string; 
      description?: string;
      items: ResearchItem[];
      connections: ResearchConnection[];
    }) => {
      // Get next version number
      const nextVersion = versions.length > 0 
        ? Math.max(...versions.map(v => v.version_number)) + 1 
        : 1;

      const snapshotData = JSON.parse(JSON.stringify({ items, connections }));
      
      const { data, error } = await supabase
        .from("research_project_versions")
        .insert([{ 
          project_id: projectId,
          version_number: nextVersion,
          name: name || `Versão ${nextVersion}`,
          description,
          snapshot: snapshotData,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["research-versions", projectId] });
      toast({ 
        title: "Versão salva", 
        description: `${data.name} criada com sucesso` 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar versão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const restoreVersion = useMutation({
    mutationFn: async (version: ProjectVersion) => {
      // Delete all current items
      const { error: deleteError } = await supabase
        .from("research_items")
        .delete()
        .eq("project_id", projectId);
      
      if (deleteError) throw deleteError;

      // Recreate items from snapshot
      if (version.snapshot.items.length > 0) {
        const itemsToInsert = version.snapshot.items.map(item => ({
          project_id: projectId,
          type: item.type,
          title: item.title,
          content: item.content,
          source_url: item.source_url,
          file_path: item.file_path,
          thumbnail_url: item.thumbnail_url,
          position_x: item.position_x,
          position_y: item.position_y,
          width: item.width,
          height: item.height,
          metadata: item.metadata,
          processed: item.processed,
        }));

        const { error: insertError } = await supabase
          .from("research_items")
          .insert(itemsToInsert);

        if (insertError) throw insertError;
      }

      return version;
    },
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: ["research-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["research-connections", projectId] });
      toast({ 
        title: "Versão restaurada", 
        description: `${version.name} foi restaurada` 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao restaurar versão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteVersion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("research_project_versions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-versions", projectId] });
      toast({ title: "Versão excluída" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir versão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    versions,
    isLoading,
    createVersion,
    restoreVersion,
    deleteVersion,
  };
};
