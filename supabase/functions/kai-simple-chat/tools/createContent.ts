/**
 * Tool `createContent` — gera rascunho de conteúdo via kai-content-agent
 * e persiste em planning_items com status "draft".
 *
 * Fluxo:
 *   1. LLM chama createContent({ platform, format, briefing, tone? })
 *   2. Invocamos edge function kai-content-agent (non-streaming) com o briefing
 *   3. Inserimos o conteúdo gerado em planning_items (status="draft")
 *   4. Emitimos action_card do tipo "draft" pro frontend renderizar
 *   5. Retornamos { planningItemId, content } pro LLM continuar o raciocínio
 */

import {
  newActionCardId,
  type KAIActionCard,
} from "../../_shared/kai-stream.ts";
import type { RegisteredTool } from "./types.ts";

interface CreateContentArgs {
  platform: string;
  format: string;
  briefing: string;
  tone?: string;
}

interface CreateContentData {
  planningItemId: string;
  content: string;
}

/**
 * Chama kai-content-agent (non-streaming) e retorna o texto gerado.
 */
async function invokeContentAgent(
  supabaseUrl: string,
  accessToken: string,
  clientId: string,
  briefing: string,
  format: string,
  platform: string,
  tone?: string,
): Promise<string> {
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const effectiveRequest = tone
    ? `${briefing}\n\n[Tom desejado: ${tone}]`
    : briefing;

  const res = await fetch(`${supabaseUrl}/functions/v1/kai-content-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      clientId,
      request: effectiveRequest,
      format,
      platform,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `kai-content-agent ${res.status}: ${errText.slice(0, 300)}`,
    );
  }

  const json = await res.json().catch(() => ({}));
  const content = typeof json?.content === "string" ? json.content : "";
  if (!content) {
    throw new Error("kai-content-agent retornou conteúdo vazio");
  }
  return content;
}

/** Busca a primeira coluna do workspace (idea/draft/primeira posição). */
async function resolveDraftColumnId(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  workspaceId: string,
): Promise<string | null> {
  // Preferir column_type="idea" ou "draft"
  const { data: preferred } = await supabase
    .from("kanban_columns")
    .select("id, column_type, position")
    .eq("workspace_id", workspaceId)
    .in("column_type", ["idea", "draft"])
    .order("position", { ascending: true })
    .limit(1);

  if (preferred && preferred.length > 0) return preferred[0].id;

  // Fallback: primeira coluna do workspace
  const { data: first } = await supabase
    .from("kanban_columns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .limit(1);

  return first && first.length > 0 ? first[0].id : null;
}

export const createContentTool: RegisteredTool<
  CreateContentArgs,
  CreateContentData
> = {
  definition: {
    name: "createContent",
    description:
      "Criar rascunho de post/conteúdo pra uma plataforma específica. Use quando o usuário pede pra criar, gerar, escrever, fazer um post, reel, carrossel, thread, newsletter ou vídeo. Gera o conteúdo via agente especializado e salva como rascunho no planejamento, devolvendo um card de aprovação pro usuário.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description: "Plataforma de destino do conteúdo.",
          enum: [
            "instagram",
            "twitter",
            "linkedin",
            "youtube",
            "newsletter",
            "tiktok",
          ],
        },
        format: {
          type: "string",
          description:
            "Formato do conteúdo (ex: post, carousel, reel, thread, short, long, story).",
        },
        briefing: {
          type: "string",
          description:
            "Pedido original do usuário detalhado — tema, ângulo, CTA, referências, qualquer contexto relevante pra produção.",
        },
        tone: {
          type: "string",
          description:
            "Tom desejado opcional (ex: informal, analítico, provocativo, educativo). Se omitido, usa o tom padrão da marca.",
        },
      },
      required: ["platform", "format", "briefing"],
    },
  },

  handler: async (args, ctx) => {
    const platform = String(args.platform ?? "").toLowerCase();
    const format = String(args.format ?? "").toLowerCase();
    const briefing = String(args.briefing ?? "").trim();
    const tone = args.tone ? String(args.tone) : undefined;

    if (!platform || !format || !briefing) {
      return {
        ok: false,
        error: "Faltam campos obrigatórios: platform, format ou briefing.",
      };
    }

    console.log(
      `[createContent] clientId=${ctx.clientId} platform=${platform} format=${format}`,
    );

    try {
      // 1. Buscar client pra pegar workspace_id
      const { data: client, error: clientErr } = await ctx.supabase
        .from("clients")
        .select("id, workspace_id")
        .eq("id", ctx.clientId)
        .single();

      if (clientErr || !client) {
        console.error("[createContent] client lookup failed:", clientErr);
        return {
          ok: false,
          error: "Cliente não encontrado ou sem workspace associado.",
        };
      }
      const workspaceId: string = client.workspace_id;
      if (!workspaceId) {
        return {
          ok: false,
          error: "Cliente não está associado a nenhum workspace.",
        };
      }

      // 2. Gerar conteúdo via kai-content-agent
      const content = await invokeContentAgent(
        ctx.supabaseUrl,
        ctx.accessToken,
        ctx.clientId,
        briefing,
        format,
        platform,
        tone,
      );
      console.log(
        `[createContent] content gerado — ${content.length} chars`,
      );

      // 3. Resolver column_id de rascunho
      const columnId = await resolveDraftColumnId(ctx.supabase, workspaceId);

      // 4. Inserir em planning_items
      const title = content.replace(/\s+/g, " ").trim().slice(0, 60);
      const { data: item, error: insertErr } = await ctx.supabase
        .from("planning_items")
        .insert({
          title,
          content,
          platform,
          status: "draft",
          client_id: ctx.clientId,
          workspace_id: workspaceId,
          created_by: ctx.userId,
          column_id: columnId,
          metadata: {
            source: "kai-tool:createContent",
            format,
            briefing,
            tone: tone ?? null,
          },
        })
        .select("id")
        .single();

      if (insertErr || !item) {
        console.error("[createContent] insert failed:", insertErr);
        return {
          ok: false,
          error: `Falha ao salvar rascunho: ${insertErr?.message ?? "unknown"}`,
        };
      }

      const planningItemId: string = item.id;

      // 5. Construir action_card
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: "draft",
        status: "pending_approval",
        data: {
          kind: "draft",
          clientId: ctx.clientId,
          platform,
          format,
          title,
          body: content,
          briefing,
        },
        requires_approval: true,
        available_actions: [
          {
            id: "approve_publish",
            label: "Aprovar e publicar",
            variant: "primary",
            tool_call: {
              name: "publishNow",
              args: { planningItemId },
            },
          },
          {
            id: "schedule",
            label: "Agendar",
            variant: "secondary",
            client_action: "edit",
          },
          {
            id: "regenerate",
            label: "Refazer",
            variant: "ghost",
            tool_call: {
              name: "createContent",
              args: { platform, format, briefing },
            },
          },
        ],
      };

      return {
        ok: true,
        data: { planningItemId, content },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[createContent] error:", err);
      return { ok: false, error: message };
    }
  },
};
