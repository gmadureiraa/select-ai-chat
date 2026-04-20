/**
 * Tool F3 `listPendingApprovals` — tool de contexto.
 *
 * Lista rascunhos/ideias aguardando decisão do usuário no planejamento.
 * NÃO emite action_card — apenas devolve `data` pro LLM consumir internamente
 * e responder em texto natural (ex: "Você tem 3 rascunhos pendentes: ...").
 *
 * Query: planning_items WHERE client_id=ctx.clientId
 *                         AND status IN ("draft", "idea")
 *                         ORDER BY updated_at DESC
 *                         LIMIT args.limit (default 20)
 */

import type { RegisteredTool } from "./types.ts";

interface ListPendingApprovalsArgs {
  limit?: number;
}

interface PendingItem {
  id: string;
  title: string;
  content_preview: string;
  platform: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ListPendingApprovalsData {
  items: PendingItem[];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PREVIEW_CHARS = 200;

export const listPendingApprovalsTool: RegisteredTool<
  ListPendingApprovalsArgs,
  ListPendingApprovalsData
> = {
  definition: {
    name: "listPendingApprovals",
    description:
      "Lista todos os rascunhos aguardando aprovação/decisão do usuário. Use quando o usuário pergunta 'o que tem pendente?', 'meus rascunhos', 'o que falta aprovar?'.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description:
            "Quantidade máxima de rascunhos a retornar. Default 20, máximo 100.",
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const rawLimit = typeof args.limit === "number" && args.limit > 0
      ? Math.floor(args.limit)
      : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);

    console.log(
      `[listPendingApprovals] clientId=${ctx.clientId} limit=${limit}`,
    );

    try {
      const { data, error } = await ctx.supabase
        .from("planning_items")
        .select("id, title, content, platform, status, created_at, updated_at")
        .eq("client_id", ctx.clientId)
        .in("status", ["draft", "idea"])
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[listPendingApprovals] query failed:", error);
        return {
          ok: false,
          error: `Falha ao buscar pendências: ${error.message ?? "unknown"}`,
        };
      }

      const rows = Array.isArray(data) ? data : [];
      const items: PendingItem[] = rows.map((row: Record<string, unknown>) => {
        const content = typeof row.content === "string" ? row.content : "";
        const preview = content.length > PREVIEW_CHARS
          ? `${content.slice(0, PREVIEW_CHARS).trim()}...`
          : content;
        return {
          id: String(row.id ?? ""),
          title: typeof row.title === "string" && row.title.trim()
            ? row.title
            : "(sem título)",
          content_preview: preview,
          platform: typeof row.platform === "string" ? row.platform : null,
          status: String(row.status ?? ""),
          created_at: String(row.created_at ?? ""),
          updated_at: String(row.updated_at ?? ""),
        };
      });

      console.log(
        `[listPendingApprovals] retornando ${items.length} item(s)`,
      );

      // Sem action_card — F3 tools só alimentam o LLM.
      return {
        ok: true,
        data: { items },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[listPendingApprovals] error:", err);
      return { ok: false, error: message };
    }
  },
};
