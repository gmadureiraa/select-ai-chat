import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { GeneratedContent } from "./useContentRepurpose";

export interface RepurposeHistoryItem {
  id: string;
  workspace_id: string;
  client_id: string | null;
  youtube_url: string;
  video_title: string | null;
  video_thumbnail: string | null;
  transcript: string | null;
  objective: string | null;
  generated_contents: GeneratedContent[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useRepurposeHistory(clientId?: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const { user } = useAuth();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["repurpose-history", workspace?.id, clientId],
    queryFn: async () => {
      if (!workspace?.id) return [];

      let query = supabase
        .from("content_repurpose_history")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        generated_contents: item.generated_contents || [],
      })) as RepurposeHistoryItem[];
    },
    enabled: !!workspace?.id,
  });

  const saveHistory = useMutation({
    mutationFn: async (input: {
      clientId: string;
      youtubeUrl: string;
      videoTitle: string;
      videoThumbnail?: string;
      transcript: string;
      objective: string;
      generatedContents: GeneratedContent[];
    }) => {
      if (!workspace?.id || !user?.id) {
        throw new Error("Workspace ou usuário não encontrado");
      }

      const { data, error } = await supabase
        .from("content_repurpose_history")
        .insert({
          workspace_id: workspace.id,
          client_id: input.clientId,
          youtube_url: input.youtubeUrl,
          video_title: input.videoTitle,
          video_thumbnail: input.videoThumbnail,
          transcript: input.transcript,
          objective: input.objective,
          generated_contents: input.generatedContents as any,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repurpose-history"] });
    },
  });

  const deleteHistory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("content_repurpose_history")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repurpose-history"] });
    },
  });

  return {
    history,
    isLoading,
    saveHistory,
    deleteHistory,
  };
}
