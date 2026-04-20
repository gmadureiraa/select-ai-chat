/**
 * Tool `publishNow` — publica um rascunho imediatamente via edge function
 * `late-post`. Atualiza `planning_items` pra status "published" e retorna
 * card do tipo "published" pro frontend.
 *
 * Fluxo:
 *   1. LLM chama publishNow({ planningItemId })
 *   2. SELECT planning_items (+ checagem client_id + status)
 *   3. POST /functions/v1/late-post com publishNow=true
 *   4. Se LATE retornar erro "not connected" → devolve card connect_account
 *      com oauthUrl obtido via late-oauth-start
 *   5. Se sucesso → UPDATE status, published_at, external_post_id
 *   6. Emit action_card type="published" status="done"
 */

import {
  newActionCardId,
  type KAIActionCard,
} from "../../_shared/kai-stream.ts";
import type { RegisteredTool } from "./types.ts";

interface PublishNowArgs {
  planningItemId: string;
}

interface PublishNowData {
  planningItemId: string;
  platform: string;
  externalUrl?: string;
  publishedAt?: string;
  status: "published" | "needs_connect" | "failed";
}

/** Identifica se o erro do LATE é por conta não conectada. */
function isNotConnectedError(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  const lower = body.toLowerCase();
  // Mensagens conhecidas do late-post (pt-BR) quando não há credencial:
  //   "Conta {platform} não conectada. Conecte a conta primeiro..."
  //   "Credenciais do {platform} expiradas ou inválidas. Reconecte a conta."
  //   "Credenciais expiradas. Reconecte a conta."
  //   "Conta não configurada corretamente. Reconecte nas Integrações."
  if (status === 400) {
    if (
      lower.includes("não conectada") ||
      lower.includes("nao conectada") ||
      lower.includes("not connected") ||
      lower.includes("reconecte") ||
      lower.includes("expiradas") ||
      lower.includes("não configurada") ||
      lower.includes("nao configurada")
    ) {
      return true;
    }
  }
  return false;
}

/** Pede ao late-oauth-start a URL pra reconectar a plataforma. */
async function fetchOAuthUrl(
  supabaseUrl: string,
  accessToken: string,
  clientId: string,
  platform: string,
): Promise<string | null> {
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/late-oauth-start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ clientId, platform }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(
        `[publishNow] late-oauth-start ${res.status}: ${t.slice(0, 200)}`,
      );
      return null;
    }
    const json = await res.json().catch(() => ({}));
    return typeof json?.authUrl === "string" ? json.authUrl : null;
  } catch (err) {
    console.error("[publishNow] late-oauth-start fetch error:", err);
    return null;
  }
}

export const publishNowTool: RegisteredTool<PublishNowArgs, PublishNowData> = {
  definition: {
    name: "publishNow",
    description:
      "Publica um rascunho imediatamente na plataforma dele. Use quando o usuário aprova e quer publicar agora.",
    parameters: {
      type: "object",
      properties: {
        planningItemId: {
          type: "string",
          description:
            "ID do item em planning_items a ser publicado. Deve vir de um rascunho existente (status='draft').",
        },
      },
      required: ["planningItemId"],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId ?? "").trim();
    if (!planningItemId) {
      return { ok: false, error: "planningItemId é obrigatório." };
    }

    console.log(
      `[publishNow] clientId=${ctx.clientId} planningItemId=${planningItemId}`,
    );

    try {
      // 1. Carregar o planning_item
      const { data: item, error: itemErr } = await ctx.supabase
        .from("planning_items")
        .select(
          "id, client_id, platform, content, media_urls, status, scheduled_at",
        )
        .eq("id", planningItemId)
        .eq("client_id", ctx.clientId)
        .single();

      if (itemErr || !item) {
        console.error("[publishNow] planning_item lookup failed:", itemErr);
        return {
          ok: false,
          error: "Rascunho não encontrado ou não pertence a este cliente.",
        };
      }

      // 2. Se já publicado, devolve card de erro
      if (item.status === "published") {
        const card: KAIActionCard = {
          id: newActionCardId(),
          planning_item_id: planningItemId,
          type: "error",
          status: "error",
          data: {
            kind: "error",
            message: "Já foi publicado",
            toolName: "publishNow",
            recoverable: false,
          },
          requires_approval: false,
          available_actions: [],
        };
        return {
          ok: true,
          data: {
            planningItemId,
            platform: item.platform,
            status: "failed",
          },
          card,
        };
      }

      const platform = String(item.platform ?? "").toLowerCase();
      const content = String(item.content ?? "");
      const mediaUrls: string[] | undefined = Array.isArray(item.media_urls)
        ? (item.media_urls as string[])
        : undefined;

      // 3. Invocar late-post
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const postResponse = await fetch(
        `${ctx.supabaseUrl}/functions/v1/late-post`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.accessToken}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            clientId: ctx.clientId,
            platform,
            content,
            mediaUrls,
            planningItemId: item.id,
            publishNow: true,
          }),
        },
      );

      const responseText = await postResponse.text();
      console.log(
        `[publishNow] late-post status=${postResponse.status} body=${responseText.slice(0, 300)}`,
      );

      // 4. Erro: tratar caso "not connected"
      if (!postResponse.ok) {
        if (isNotConnectedError(postResponse.status, responseText)) {
          const oauthUrl = await fetchOAuthUrl(
            ctx.supabaseUrl,
            ctx.accessToken,
            ctx.clientId,
            platform,
          );
          if (oauthUrl) {
            const card: KAIActionCard = {
              id: newActionCardId(),
              planning_item_id: planningItemId,
              type: "connect_account",
              status: "pending_approval",
              data: {
                kind: "connect_account",
                platform,
                oauthUrl,
                reason: `Conecte sua conta do ${platform} pra publicar`,
              },
              requires_approval: true,
              available_actions: [],
            };
            return {
              ok: true,
              data: {
                planningItemId,
                platform,
                status: "needs_connect",
              },
              card,
            };
          }
          // Se não conseguimos OAuth URL, cai no erro genérico abaixo
        }

        // Erro genérico
        let userMessage = "Falha ao publicar";
        try {
          const errJson = JSON.parse(responseText);
          if (errJson?.error) userMessage = String(errJson.error);
          else if (errJson?.message) userMessage = String(errJson.message);
        } catch {
          if (responseText) userMessage = responseText.slice(0, 200);
        }

        const card: KAIActionCard = {
          id: newActionCardId(),
          planning_item_id: planningItemId,
          type: "error",
          status: "error",
          data: {
            kind: "error",
            message: userMessage,
            toolName: "publishNow",
            recoverable: true,
          },
          requires_approval: false,
          available_actions: [],
        };
        return {
          ok: true,
          data: {
            planningItemId,
            platform,
            status: "failed",
          },
          card,
        };
      }

      // 5. Sucesso — late-post já atualizou planning_items internamente (status,
      //    published_at, external_post_id). Ainda assim garantimos via UPDATE
      //    defensivo caso a edge tenha rodado como service role sem concluir.
      let postJson: Record<string, unknown> = {};
      try {
        postJson = JSON.parse(responseText);
      } catch {
        postJson = {};
      }
      const externalUrl: string | undefined =
        typeof postJson?.url === "string" ? postJson.url : undefined;
      const externalPostId: string | undefined =
        typeof postJson?.postId === "string" ? postJson.postId : undefined;
      const publishedAt = new Date().toISOString();

      const { error: updateErr } = await ctx.supabase
        .from("planning_items")
        .update({
          status: "published",
          published_at: publishedAt,
          ...(externalPostId ? { external_post_id: externalPostId } : {}),
          updated_at: publishedAt,
        })
        .eq("id", planningItemId);

      if (updateErr) {
        console.warn(
          "[publishNow] update planning_items falhou (late-post já deve ter atualizado):",
          updateErr.message,
        );
      }

      // 6. Card de sucesso
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: "published",
        status: "done",
        data: {
          kind: "published",
          clientId: ctx.clientId,
          platform,
          externalUrl,
          publishedAt,
          body: content,
          mediaUrls,
        },
        requires_approval: false,
        available_actions: [],
      };

      return {
        ok: true,
        data: {
          planningItemId,
          platform,
          externalUrl,
          publishedAt,
          status: "published",
        },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[publishNow] error:", err);
      return { ok: false, error: message };
    }
  },
};
