/**
 * Hook pra importar últimos posts dos perfis sociais do cliente direto pra
 * client_content_library. Usado no onboarding wizard (auto-trigger pós-criação)
 * e no ClientEdit (botão "Atualizar biblioteca").
 *
 * Backend: api/_handlers/import-client-social-content.ts
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiInvoke } from "@/lib/apiInvoke";
import { toast } from "sonner";

export type ImportPlatform =
  | "instagram"
  | "tiktok"
  | "twitter"
  | "threads"
  | "linkedin";

export interface ImportRequest {
  clientId: string;
  /** Se omitido, importa de TODAS as plataformas com handle cadastrado. */
  platforms?: ImportPlatform[];
  /** Default 30. Range: 1-60. */
  postsPerPlatform?: number;
}

export interface ImportResultPerPlatform {
  platform: ImportPlatform;
  handle: string | null;
  scraped: number;
  inserted: number;
  skipped: number;
  error?: string;
}

export interface ImportResult {
  ok: boolean;
  clientId: string;
  totals: { scraped: number; inserted: number; skipped: number };
  results: ImportResultPerPlatform[];
}

export function useImportClientSocialContent() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, ImportRequest>({
    mutationFn: async (request) => {
      const res = await apiInvoke<ImportResult>(
        "import-client-social-content",
        request,
      );
      return res;
    },
    onSuccess: (data) => {
      const { totals } = data;
      const platformsOk = data.results
        .filter((r) => !r.error && r.inserted > 0)
        .map((r) => r.platform);
      const platformsFail = data.results
        .filter((r) => r.error)
        .map((r) => `${r.platform}(${r.error})`);

      if (totals.inserted > 0) {
        toast.success(
          `Importação concluída: ${totals.inserted} posts novos na biblioteca.`,
          {
            description: platformsOk.length
              ? `Plataformas: ${platformsOk.join(", ")}`
              : undefined,
          },
        );
      } else {
        toast.info(
          `Nenhum post novo. ${totals.scraped} encontrados, ${totals.skipped} já existentes.`,
        );
      }

      if (platformsFail.length > 0) {
        toast.warning(`Falhas em: ${platformsFail.join(", ")}`);
      }

      // Invalida queries da biblioteca pra refetch
      queryClient.invalidateQueries({
        queryKey: ["client-content-library", data.clientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["client-context", data.clientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["client-workspace-context", data.clientId],
      });
    },
    onError: (error) => {
      console.error("[useImportClientSocialContent] error:", error);
      toast.error("Erro ao importar posts", {
        description: error.message.slice(0, 200),
      });
    },
  });
}
