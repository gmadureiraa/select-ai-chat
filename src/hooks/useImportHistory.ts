import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

export interface ImportHistory {
  id: string;
  client_id: string;
  platform: string;
  imported_at: string;
  records_count: number;
  file_name: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  user_id: string;
}

export function useImportHistory(clientId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ["import-history", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("import_history")
        .select("*")
        .eq("client_id", clientId)
        .order("imported_at", { ascending: false });

      if (error) throw error;
      return data as ImportHistory[];
    },
    enabled: !!clientId,
  });

  const logImport = useMutation({
    mutationFn: async ({
      clientId,
      platform,
      recordsCount,
      fileName,
      status = "completed",
      metadata = {},
    }: {
      clientId: string;
      platform: string;
      recordsCount: number;
      fileName?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from("import_history")
        .insert([{
          client_id: clientId,
          platform,
          records_count: recordsCount,
          file_name: fileName,
          status,
          metadata: metadata as Json,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
    },
  });

  const deleteImport = useMutation({
    mutationFn: async (importId: string) => {
      const { error } = await supabase
        .from("import_history")
        .delete()
        .eq("id", importId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
      toast({
        title: "Registro removido",
        description: "O registro de importação foi removido.",
      });
    },
  });

  const clearPlatformData = useMutation({
    mutationFn: async ({ clientId, platform }: { clientId: string; platform: string }) => {
      // Delete data based on platform
      if (platform === "instagram") {
        await supabase.from("instagram_posts").delete().eq("client_id", clientId);
        // Also delete platform metrics for instagram
        await supabase.from("platform_metrics").delete().eq("client_id", clientId).eq("platform", "instagram");
      } else if (platform === "youtube") {
        await supabase.from("youtube_videos").delete().eq("client_id", clientId);
        await supabase.from("platform_metrics").delete().eq("client_id", clientId).eq("platform", "youtube");
      } else if (platform === "newsletter") {
        await supabase.from("platform_metrics").delete().eq("client_id", clientId).eq("platform", "newsletter");
      } else if (platform === "twitter") {
        await supabase.from("platform_metrics").delete().eq("client_id", clientId).eq("platform", "twitter");
      } else if (platform === "tiktok") {
        await supabase.from("platform_metrics").delete().eq("client_id", clientId).eq("platform", "tiktok");
      }

      // Delete import history for this platform
      await supabase.from("import_history").delete().eq("client_id", clientId).eq("platform", platform);
    },
    onSuccess: (_, { platform }) => {
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["youtube-videos", clientId] });
      queryClient.invalidateQueries({ queryKey: ["platform-metrics", clientId] });
      toast({
        title: "Dados limpos",
        description: `Todos os dados de ${platform} foram removidos.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao limpar dados",
        description: "Não foi possível limpar os dados.",
        variant: "destructive",
      });
    },
  });

  const clearAllData = useMutation({
    mutationFn: async (clientId: string) => {
      // Delete all performance data
      await supabase.from("instagram_posts").delete().eq("client_id", clientId);
      await supabase.from("youtube_videos").delete().eq("client_id", clientId);
      await supabase.from("platform_metrics").delete().eq("client_id", clientId);
      await supabase.from("import_history").delete().eq("client_id", clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["youtube-videos", clientId] });
      queryClient.invalidateQueries({ queryKey: ["platform-metrics", clientId] });
      toast({
        title: "Todos os dados limpos",
        description: "Todas as métricas de performance foram removidas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao limpar dados",
        description: "Não foi possível limpar os dados.",
        variant: "destructive",
      });
    },
  });

  return {
    imports,
    isLoading,
    logImport,
    deleteImport,
    clearPlatformData,
    clearAllData,
  };
}
