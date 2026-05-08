/**
 * useReelHistory — carrega histórico de reels adaptados pra um cliente
 * via TanStack Query. Lê direto de `viral_reels` (Supabase) — o handler
 * `adapt-viral-reel` é quem escreve.
 *
 * Também expõe mutations pra deletar reel e salvar como ideia/library.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ReelRow } from "../types";

const QUERY_KEY = (clientId: string) => ["viral-reels-v2", clientId];

export function useReelHistory(clientId: string | null | undefined) {
  return useQuery<ReelRow[]>({
    queryKey: QUERY_KEY(clientId ?? "none"),
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("viral_reels")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ReelRow[];
    },
    enabled: !!clientId,
  });
}

export function useDeleteReel(clientId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("viral_reels").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      if (clientId) qc.invalidateQueries({ queryKey: QUERY_KEY(clientId) });
      toast.success("Roteiro excluído");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao excluir");
    },
  });
}

export function useInvalidateReels(clientId: string | null | undefined) {
  const qc = useQueryClient();
  return () => {
    if (clientId) qc.invalidateQueries({ queryKey: QUERY_KEY(clientId) });
  };
}

/**
 * Salva o roteiro como ideia no Planning. Mantém compat de comportamento com
 * o `ViralReelsTab` original.
 */
export function useSaveReelAsIdea() {
  return useMutation({
    mutationFn: async (input: {
      reel: ReelRow;
      clientId: string;
      workspaceId: string;
    }) => {
      const { reel, clientId, workspaceId } = input;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem usuário autenticado");

      const title = reel.script?.titulo ?? reel.tema;
      const body = [
        `Roteiro adaptado do reel @${reel.source_meta?.ownerUsername ?? "—"}`,
        reel.source_url,
        "",
        `Hook: ${reel.script?.hook ?? ""}`,
        "",
        reel.script?.roteiroCompleto ?? "",
      ].join("\n");

      const { error } = await supabase.from("planning_items").insert([
        {
          client_id: clientId,
          workspace_id: workspaceId,
          title,
          content: body,
          status: "idea",
          platform: "instagram",
          created_by: u.user.id,
        },
      ]);
      if (error) throw error;
      return reel.id;
    },
    onSuccess: () => toast.success("Salvo como ideia no Planning"),
    onError: (err: any) => toast.error(err?.message ?? "Falha ao salvar"),
  });
}

export function useSaveReelToLibrary() {
  return useMutation({
    mutationFn: async (input: { reel: ReelRow; clientId: string }) => {
      const { reel, clientId } = input;
      const title = reel.script?.titulo ?? reel.tema;
      const content = [
        `# ${title}`,
        ``,
        `**Hook:** ${reel.script?.hook ?? ""}`,
        ``,
        `## Roteiro completo`,
        reel.script?.roteiroCompleto ?? "",
        ``,
        `## Caption sugerida`,
        reel.script?.captionSugerida ?? "",
        ``,
        `## Cenas`,
        ...(reel.script?.scenes ?? []).map(
          (s) => `- #${s.n} (${s.tempo}) [${s.papel}] ${s.copy}`,
        ),
        ``,
        `Fonte: ${reel.source_url} (@${reel.source_meta?.ownerUsername ?? "—"})`,
      ].join("\n");

      const { error } = await supabase.from("client_content_library").insert([
        {
          client_id: clientId,
          title,
          content,
          content_type: "reel_script",
          metadata: {
            source: "viral-reels-v2",
            reelId: reel.id,
            sourceUrl: reel.source_url,
            ownerUsername: reel.source_meta?.ownerUsername,
            objetivo: reel.objetivo,
            cta: reel.cta,
          },
        },
      ]);
      if (error) throw error;
      return reel.id;
    },
    onSuccess: () => toast.success("Salvo na Library"),
    onError: (err: any) => toast.error(err?.message ?? "Falha ao salvar"),
  });
}
