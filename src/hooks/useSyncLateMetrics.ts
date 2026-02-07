import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SyncResult {
  success: boolean;
  clientsProcessed?: number;
  totalPostsUpdated?: number;
  totalMetricsUpdated?: number;
  totalErrors?: number;
  duration?: number;
  error?: string;
}

export function useSyncLateMetrics(clientId: string) {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const syncMetrics = async (): Promise<SyncResult> => {
    setIsSyncing(true);
    const toastId = toast.loading("Sincronizando métricas do Late...");

    try {
      const { data, error } = await supabase.functions.invoke("fetch-late-metrics", {
        body: { clientId },
      });

      if (error) {
        console.error("[sync-late-metrics] Error:", error);
        toast.error("Erro ao sincronizar métricas", { id: toastId });
        return { success: false, error: error.message };
      }

      const result = data as SyncResult;

      if (result.success) {
        const postsUpdated = result.totalPostsUpdated || 0;
        const metricsUpdated = result.totalMetricsUpdated || 0;
        
        toast.success(
          `Sincronização concluída: ${postsUpdated} posts e ${metricsUpdated} métricas atualizados`,
          { id: toastId }
        );

        // Invalidate all related queries to refresh the UI
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] }),
          queryClient.invalidateQueries({ queryKey: ["twitter-posts", clientId] }),
          queryClient.invalidateQueries({ queryKey: ["linkedin-posts", clientId] }),
          queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] }),
          queryClient.invalidateQueries({ queryKey: ["youtube-videos", clientId] }),
        ]);

        return result;
      } else {
        toast.error(result.error || "Erro desconhecido na sincronização", { id: toastId });
        return result;
      }
    } catch (err) {
      console.error("[sync-late-metrics] Exception:", err);
      toast.error("Erro de conexão ao sincronizar", { id: toastId });
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    } finally {
      setIsSyncing(false);
    }
  };

  return { syncMetrics, isSyncing };
}
