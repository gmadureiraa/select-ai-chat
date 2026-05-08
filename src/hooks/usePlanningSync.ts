import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiInvoke } from "@/lib/apiInvoke";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

/**
 * Unified "save to planning" hook used by SV / Reels / Radar.
 *
 * - SV: salva carrossel como planning_item (link_to.viral_carousel_id)
 * - Reels: salva script como planning_item (link_to.viral_reel_id)
 * - Radar: captura ideia/insight como planning_item status='idea'
 *
 * Backend: POST /api/save-as-planning-item (Zod-validated)
 */

export type ViralPlanningSource = "sv" | "reels" | "radar";

export interface SaveAsPlanningInput {
  client_id: string;
  workspace_id: string;
  source: ViralPlanningSource;
  title: string;
  content?: string;
  description?: string;
  content_type?:
    | "carousel"
    | "reel_script"
    | "static_image"
    | "thread"
    | "social_post"
    | "newsletter"
    | "other";
  platform?: string;
  status?: "idea" | "draft" | "review" | "approved" | "scheduled";
  scheduled_at?: string;
  metadata?: Record<string, unknown>;
  link_to?: {
    viral_carousel_id?: string;
    viral_reel_id?: string;
  };
}

export interface SaveAsPlanningResult {
  ok: boolean;
  planning_item: {
    id: string;
    workspace_id: string;
    client_id: string | null;
    column_id: string | null;
    title: string;
    status: string;
    content_type: string | null;
    metadata: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export function useSaveAsPlanningItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveAsPlanningInput): Promise<SaveAsPlanningResult> => {
      const { data, error } = await apiInvoke<SaveAsPlanningResult>(
        "save-as-planning-item",
        { body: input }
      );
      if (error) throw new Error(error.message || "Falha ao salvar");
      if (!data) throw new Error("Resposta vazia do servidor");
      return data;
    },
    onSuccess: (_data, vars) => {
      // Invalida queries de planning pra refetch imediato
      queryClient.invalidateQueries({ queryKey: ["planning-items"] });
      queryClient.invalidateQueries({
        queryKey: ["planning-items", vars.workspace_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["planning-items", vars.client_id],
      });

      const successMsg =
        vars.source === "radar"
          ? "Ideia salva no planejamento"
          : "Conteúdo salvo no planejamento";
      toast.success(successMsg);

      // Vercel Analytics — eventos product-level
      trackEvent("planning_item_created", {
        source: vars.source,
        content_type: vars.content_type ?? "auto",
      });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });
}

/**
 * Helper específico do Radar — captura insight/ideia como planning_item.
 * Pré-preenche metadata com url + source_type + captured_at e status='idea'.
 */
export function useSaveIdeaFromRadar() {
  const save = useSaveAsPlanningItem();
  return {
    mutateAsync: (input: {
      client_id: string;
      workspace_id: string;
      title: string;
      summary?: string;
      url?: string;
      source_type?: string;
    }) =>
      save.mutateAsync({
        client_id: input.client_id,
        workspace_id: input.workspace_id,
        source: "radar",
        title: input.title,
        description: input.summary,
        content_type: "other",
        status: "idea",
        metadata: {
          url: input.url,
          source_type: input.source_type,
          captured_at: new Date().toISOString(),
        },
      }),
    isPending: save.isPending,
    isError: save.isError,
    error: save.error,
  };
}
