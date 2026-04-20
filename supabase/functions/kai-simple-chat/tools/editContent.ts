/**
 * Tool `editContent` — edita/reescreve um rascunho existente seguindo
 * instrução do usuário. Usa kai-content-agent com o conteúdo atual +
 * instrução anexada, atualiza planning_items e devolve card "done".
 */

import {
  newActionCardId,
  type KAIActionCard,
} from "../../_shared/kai-stream.ts";
import type { RegisteredTool } from "./types.ts";

interface EditContentArgs {
  planningItemId: string;
  instruction: string;
}

interface EditContentData {
  planningItemId: string;
  content: string;
}

async function invokeContentAgentForEdit(
  supabaseUrl: string,
  accessToken: string,
  clientId: string,
  currentContent: string,
  instruction: string,
  format: string,
  platform: string,
): Promise<string> {
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const editRequest =
    `Reescreva/edite o conteúdo abaixo seguindo esta instrução do usuário:\n\n` +
    `INSTRUÇÃO: ${instruction}\n\n` +
    `CONTEÚDO ATUAL:\n${currentContent}\n\n` +
    `Devolva SOMENTE a versão reescrita, mantendo o mesmo formato e plataforma.`;

  const res = await fetch(`${supabaseUrl}/functions/v1/kai-content-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      clientId,
      request: editRequest,
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

export const editContentTool: RegisteredTool<
  EditContentArgs,
  EditContentData
> = {
  definition: {
    name: "editContent",
    description:
      "Edita/reescreve um rascunho existente com base em instruções do usuário. Use quando o usuário quer ajustar, encurtar, alongar, mudar o tom, regenerar parcialmente, ou aplicar feedback específico sobre um rascunho que já existe. Atualiza o planning_item e retorna um card com a nova versão.",
    parameters: {
      type: "object",
      properties: {
        planningItemId: {
          type: "string",
          description:
            "ID do planning_item (UUID) que contém o rascunho a ser editado.",
        },
        instruction: {
          type: "string",
          description:
            "O que exatamente mudar no rascunho — ex: 'deixa mais curto', 'tom mais informal', 'adicionar CTA no fim', 'remover emojis', 'trocar exemplo de empresa'.",
        },
      },
      required: ["planningItemId", "instruction"],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId ?? "").trim();
    const instruction = String(args.instruction ?? "").trim();

    if (!planningItemId || !instruction) {
      return {
        ok: false,
        error: "Faltam campos obrigatórios: planningItemId ou instruction.",
      };
    }

    console.log(
      `[editContent] planningItemId=${planningItemId} client=${ctx.clientId}`,
    );

    try {
      // 1. Buscar o rascunho existente
      const { data: item, error: fetchErr } = await ctx.supabase
        .from("planning_items")
        .select("id, title, content, platform, metadata, client_id")
        .eq("id", planningItemId)
        .eq("client_id", ctx.clientId)
        .single();

      if (fetchErr || !item) {
        console.error("[editContent] fetch failed:", fetchErr);
        return { ok: false, error: "Rascunho não encontrado" };
      }

      const currentContent: string = item.content ?? "";
      const platform: string = item.platform ?? "instagram";
      const format: string = item.metadata?.format ?? "post";

      // 2. Gerar conteúdo revisado
      const newContent = await invokeContentAgentForEdit(
        ctx.supabaseUrl,
        ctx.accessToken,
        ctx.clientId,
        currentContent,
        instruction,
        format,
        platform,
      );
      console.log(
        `[editContent] novo conteúdo gerado — ${newContent.length} chars`,
      );

      // 3. Atualizar planning_item
      const newTitle = newContent.replace(/\s+/g, " ").trim().slice(0, 60);
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await ctx.supabase
        .from("planning_items")
        .update({
          content: newContent,
          title: newTitle,
          updated_at: nowIso,
          metadata: {
            ...(item.metadata ?? {}),
            last_edit_instruction: instruction,
            last_edited_at: nowIso,
          },
        })
        .eq("id", planningItemId);

      if (updateErr) {
        console.error("[editContent] update failed:", updateErr);
        return {
          ok: false,
          error: `Falha ao atualizar rascunho: ${updateErr.message}`,
        };
      }

      // 4. Card "done" — conteúdo atualizado, ainda aprovável
      const briefing: string = item.metadata?.briefing ?? instruction;
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: "draft",
        status: "done",
        data: {
          kind: "draft",
          clientId: ctx.clientId,
          platform,
          format,
          title: newTitle,
          body: newContent,
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
              name: "editContent",
              args: { planningItemId, instruction },
            },
          },
        ],
      };

      return {
        ok: true,
        data: { planningItemId, content: newContent },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[editContent] error:", err);
      return { ok: false, error: message };
    }
  },
};
