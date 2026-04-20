/**
 * Tool F3 `searchLibrary` — tool de contexto.
 *
 * Pesquisa a biblioteca de conteúdos e referências do cliente por palavra-chave.
 * Busca `title ILIKE %query%` OR `content ILIKE %query%` em:
 *   - client_content_library
 *   - client_reference_library (opcional — default true)
 *
 * Não emite card. Só devolve `data` pro LLM compor uma resposta natural.
 */

import type { RegisteredTool } from "./types.ts";

interface SearchLibraryArgs {
  query: string;
  limit?: number;
  includeReferences?: boolean;
}

interface ContentMatch {
  id: string;
  title: string;
  content_type: string | null;
  snippet: string;
}

interface ReferenceMatch {
  id: string;
  title: string;
  reference_type: string | null;
  source_url: string | null;
  snippet: string;
}

interface SearchLibraryData {
  content: ContentMatch[];
  references: ReferenceMatch[];
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 25;
const SNIPPET_CHARS = 240;

/** Escapa % e _ para evitar wildcards acidentais vindos do LLM. */
function escapeIlike(q: string): string {
  return q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function buildSnippet(content: unknown): string {
  if (typeof content !== "string") return "";
  const trimmed = content.trim();
  if (trimmed.length <= SNIPPET_CHARS) return trimmed;
  return `${trimmed.slice(0, SNIPPET_CHARS).trim()}...`;
}

export const searchLibraryTool: RegisteredTool<
  SearchLibraryArgs,
  SearchLibraryData
> = {
  definition: {
    name: "searchLibrary",
    description:
      "Pesquisa a biblioteca de conteúdos e referências do cliente por palavra-chave. Use quando o usuário pergunta 'tem algum post sobre X?', 'lembra daquela referência de Y?'.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Termo ou frase curta a buscar em título e corpo dos itens da biblioteca.",
        },
        limit: {
          type: "integer",
          description:
            "Número máximo de resultados por fonte (content e references). Default 5, máximo 25.",
        },
        includeReferences: {
          type: "boolean",
          description:
            "Se true (default), também busca em client_reference_library. Se false, busca só em client_content_library.",
        },
      },
      required: ["query"],
    },
  },

  handler: async (args, ctx) => {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) {
      return { ok: false, error: "Argumento 'query' obrigatório e não pode ser vazio." };
    }

    const rawLimit = typeof args.limit === "number" && args.limit > 0
      ? Math.floor(args.limit)
      : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const includeReferences = args.includeReferences !== false;

    const pattern = `%${escapeIlike(query)}%`;
    const orFilter = `title.ilike.${pattern},content.ilike.${pattern}`;

    console.log(
      `[searchLibrary] clientId=${ctx.clientId} query="${query}" limit=${limit} refs=${includeReferences}`,
    );

    try {
      // Busca na content library.
      const contentQuery = ctx.supabase
        .from("client_content_library")
        .select("id, title, content, content_type")
        .eq("client_id", ctx.clientId)
        .or(orFilter)
        .limit(limit);

      // Busca nas references (se habilitado).
      const referencesQuery = includeReferences
        ? ctx.supabase
            .from("client_reference_library")
            .select("id, title, content, reference_type, source_url")
            .eq("client_id", ctx.clientId)
            .or(orFilter)
            .limit(limit)
        : Promise.resolve({ data: [], error: null });

      const [contentRes, refsRes] = await Promise.all([
        contentQuery,
        referencesQuery,
      ]);

      if (contentRes.error) {
        console.error("[searchLibrary] content query failed:", contentRes.error);
        return {
          ok: false,
          error: `Falha ao buscar content library: ${contentRes.error.message ?? "unknown"}`,
        };
      }
      if (refsRes.error) {
        console.error("[searchLibrary] references query failed:", refsRes.error);
        return {
          ok: false,
          error: `Falha ao buscar reference library: ${refsRes.error.message ?? "unknown"}`,
        };
      }

      const contentRows = Array.isArray(contentRes.data) ? contentRes.data : [];
      const refRows = Array.isArray(refsRes.data) ? refsRes.data : [];

      const content: ContentMatch[] = contentRows.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ""),
        title: typeof row.title === "string" && row.title.trim()
          ? row.title
          : "(sem título)",
        content_type: typeof row.content_type === "string" ? row.content_type : null,
        snippet: buildSnippet(row.content),
      }));

      const references: ReferenceMatch[] = refRows.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ""),
        title: typeof row.title === "string" && row.title.trim()
          ? row.title
          : "(sem título)",
        reference_type: typeof row.reference_type === "string" ? row.reference_type : null,
        source_url: typeof row.source_url === "string" ? row.source_url : null,
        snippet: buildSnippet(row.content),
      }));

      console.log(
        `[searchLibrary] content=${content.length} references=${references.length}`,
      );

      return {
        ok: true,
        data: { content, references },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[searchLibrary] error:", err);
      return { ok: false, error: message };
    }
  },
};
