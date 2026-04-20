/**
 * Tool F3 `getClientContext` — tool de contexto.
 *
 * Busca o contexto completo do cliente (brand voice, guidelines, social,
 * tags) + contagens das bibliotecas. Sem action_card — alimenta o LLM.
 *
 * Usada quando o usuário pergunta "quem é esse cliente?", "qual o tom de
 * voz?", "me lembra dos guidelines".
 */

import type { RegisteredTool } from "./types.ts";

interface GetClientContextArgs {
  // sem args — usa ctx.clientId
  [key: string]: unknown;
}

interface ClientStats {
  planningItems: number;
  libraryItems: number;
  references: number;
}

interface GetClientContextData {
  name: string;
  description: string | null;
  contextNotes: string | null;
  identityGuideSummary: string | null;
  socialMedia: unknown;
  tags: string[];
  stats: ClientStats;
}

const MAX_LONG_FIELD = 2000;

/**
 * Resume um campo textual preservando o começo. Se já está dentro do limite,
 * devolve como está. Caso contrário, corta no último espaço antes do limite
 * pra não quebrar palavras e sinaliza o truncamento.
 */
function summarizeLongField(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_LONG_FIELD) return trimmed;

  const slice = trimmed.slice(0, MAX_LONG_FIELD);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > MAX_LONG_FIELD * 0.7
    ? slice.slice(0, lastSpace)
    : slice;
  return `${base.trim()}... [resumido, ${trimmed.length} chars no total]`;
}

export const getClientContextTool: RegisteredTool<
  GetClientContextArgs,
  GetClientContextData
> = {
  definition: {
    name: "getClientContext",
    description:
      "Busca o contexto completo do cliente (brand voice, público, guidelines, perfis sociais). Use quando o usuário pergunta 'quem é esse cliente?', 'qual o tom de voz?', 'me lembra dos guidelines'.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  handler: async (_args, ctx) => {
    console.log(`[getClientContext] clientId=${ctx.clientId}`);

    try {
      const { data: client, error: clientErr } = await ctx.supabase
        .from("clients")
        .select(
          "id, name, description, context_notes, identity_guide, social_media, tags",
        )
        .eq("id", ctx.clientId)
        .single();

      if (clientErr || !client) {
        console.error("[getClientContext] client lookup failed:", clientErr);
        return {
          ok: false,
          error: `Cliente não encontrado: ${clientErr?.message ?? "unknown"}`,
        };
      }

      // Contagens rápidas (head:true → só count, sem trazer linhas).
      const [planningCount, libraryCount, referencesCount] = await Promise.all([
        ctx.supabase
          .from("planning_items")
          .select("id", { count: "exact", head: true })
          .eq("client_id", ctx.clientId),
        ctx.supabase
          .from("client_content_library")
          .select("id", { count: "exact", head: true })
          .eq("client_id", ctx.clientId),
        ctx.supabase
          .from("client_reference_library")
          .select("id", { count: "exact", head: true })
          .eq("client_id", ctx.clientId),
      ]);

      const tagsRaw = (client as Record<string, unknown>).tags;
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.filter((t): t is string => typeof t === "string")
        : [];

      const data: GetClientContextData = {
        name: typeof client.name === "string" ? client.name : "(sem nome)",
        description: typeof client.description === "string"
          ? client.description
          : null,
        contextNotes: summarizeLongField(
          (client as Record<string, unknown>).context_notes,
        ),
        identityGuideSummary: summarizeLongField(
          (client as Record<string, unknown>).identity_guide,
        ),
        socialMedia: (client as Record<string, unknown>).social_media ?? null,
        tags,
        stats: {
          planningItems: planningCount.count ?? 0,
          libraryItems: libraryCount.count ?? 0,
          references: referencesCount.count ?? 0,
        },
      };

      console.log(
        `[getClientContext] ${data.name} — plan=${data.stats.planningItems} lib=${data.stats.libraryItems} refs=${data.stats.references}`,
      );

      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[getClientContext] error:", err);
      return { ok: false, error: message };
    }
  },
};
