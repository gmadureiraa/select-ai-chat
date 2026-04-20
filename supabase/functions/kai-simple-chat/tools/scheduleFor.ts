/**
 * Tool `scheduleFor` — agenda um rascunho pra publicar numa data/hora futura.
 * Invoca `late-post` com publishNow=false + scheduledFor e atualiza
 * `planning_items` pra status="scheduled".
 *
 * Fluxo:
 *   1. LLM chama scheduleFor({ planningItemId, datetime })
 *   2. Valida datetime (parseável + futuro de pelo menos 60s)
 *   3. SELECT planning_items (client_id match + não publicado)
 *   4. POST /functions/v1/late-post com scheduledFor + publishNow:false
 *   5. Se LATE retornar "not connected" → card connect_account com oauthUrl
 *   6. Se sucesso → UPDATE status='scheduled', scheduled_at=datetime
 *   7. Emit action_card type="scheduled" status="done"
 */

import {
  newActionCardId,
  type KAIActionCard,
} from "../../_shared/kai-stream.ts";
import type { RegisteredTool } from "./types.ts";

interface ScheduleForArgs {
  planningItemId: string;
  datetime: string;
}

interface ScheduleForData {
  planningItemId: string;
  platform: string;
  scheduledFor: string;
  status: "scheduled" | "needs_connect" | "failed";
}

/** Identifica se o erro do LATE é por conta não conectada. */
function isNotConnectedError(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  const lower = body.toLowerCase();
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
        `[scheduleFor] late-oauth-start ${res.status}: ${t.slice(0, 200)}`,
      );
      return null;
    }
    const json = await res.json().catch(() => ({}));
    return typeof json?.authUrl === "string" ? json.authUrl : null;
  } catch (err) {
    console.error("[scheduleFor] late-oauth-start fetch error:", err);
    return null;
  }
}

export const scheduleForTool: RegisteredTool<ScheduleForArgs, ScheduleForData> =
  {
    definition: {
      name: "scheduleFor",
      description:
        "Agenda um rascunho pra publicar numa data/hora futura.",
      parameters: {
        type: "object",
        properties: {
          planningItemId: {
            type: "string",
            description:
              "ID do rascunho em planning_items a ser agendado.",
          },
          datetime: {
            type: "string",
            description:
              "Data e hora ISO 8601 (ex: '2026-04-21T14:30:00-03:00'). Precisa estar no futuro.",
            format: "date-time",
          },
        },
        required: ["planningItemId", "datetime"],
      },
    },

    handler: async (args, ctx) => {
      const planningItemId = String(args.planningItemId ?? "").trim();
      const datetime = String(args.datetime ?? "").trim();

      if (!planningItemId) {
        return { ok: false, error: "planningItemId é obrigatório." };
      }
      if (!datetime) {
        return { ok: false, error: "datetime é obrigatório (ISO 8601)." };
      }

      // 1. Validar datetime
      const parsed = new Date(datetime);
      if (isNaN(parsed.getTime())) {
        return {
          ok: false,
          error: `datetime inválido: "${datetime}". Use ISO 8601 (ex: 2026-04-21T14:30:00-03:00).`,
        };
      }
      const now = Date.now();
      const MIN_AHEAD_MS = 60 * 1000;
      if (parsed.getTime() < now + MIN_AHEAD_MS) {
        return {
          ok: false,
          error:
            "datetime precisa estar pelo menos 60 segundos no futuro.",
        };
      }
      const scheduledForIso = parsed.toISOString();

      console.log(
        `[scheduleFor] clientId=${ctx.clientId} planningItemId=${planningItemId} scheduledFor=${scheduledForIso}`,
      );

      try {
        // 2. Carregar planning_item
        const { data: item, error: itemErr } = await ctx.supabase
          .from("planning_items")
          .select(
            "id, client_id, platform, content, media_urls, status, scheduled_at",
          )
          .eq("id", planningItemId)
          .eq("client_id", ctx.clientId)
          .single();

        if (itemErr || !item) {
          console.error("[scheduleFor] planning_item lookup failed:", itemErr);
          return {
            ok: false,
            error: "Rascunho não encontrado ou não pertence a este cliente.",
          };
        }

        if (item.status === "published") {
          const card: KAIActionCard = {
            id: newActionCardId(),
            planning_item_id: planningItemId,
            type: "error",
            status: "error",
            data: {
              kind: "error",
              message: "Já foi publicado — não dá pra agendar.",
              toolName: "scheduleFor",
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
              scheduledFor: scheduledForIso,
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

        // 3. Invocar late-post em modo agendamento
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
              scheduledFor: scheduledForIso,
              publishNow: false,
            }),
          },
        );

        const responseText = await postResponse.text();
        console.log(
          `[scheduleFor] late-post status=${postResponse.status} body=${responseText.slice(0, 300)}`,
        );

        // 4. Erro: tratar "not connected"
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
                  reason: `Conecte sua conta do ${platform} pra agendar`,
                },
                requires_approval: true,
                available_actions: [],
              };
              return {
                ok: true,
                data: {
                  planningItemId,
                  platform,
                  scheduledFor: scheduledForIso,
                  status: "needs_connect",
                },
                card,
              };
            }
          }

          let userMessage = "Falha ao agendar";
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
              toolName: "scheduleFor",
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
              scheduledFor: scheduledForIso,
              status: "failed",
            },
            card,
          };
        }

        // 5. Sucesso — late-post atualiza status='scheduled' e scheduled_at,
        //    mas garantimos via UPDATE defensivo.
        const { error: updateErr } = await ctx.supabase
          .from("planning_items")
          .update({
            status: "scheduled",
            scheduled_at: scheduledForIso,
            updated_at: new Date().toISOString(),
          })
          .eq("id", planningItemId);

        if (updateErr) {
          console.warn(
            "[scheduleFor] update planning_items falhou (late-post já deve ter atualizado):",
            updateErr.message,
          );
        }

        // 6. Card de sucesso
        const card: KAIActionCard = {
          id: newActionCardId(),
          planning_item_id: planningItemId,
          type: "scheduled",
          status: "done",
          data: {
            kind: "scheduled",
            clientId: ctx.clientId,
            platform,
            scheduledFor: scheduledForIso,
            body: content,
            mediaUrls,
            planningItemId,
          },
          requires_approval: false,
          available_actions: [],
        };

        return {
          ok: true,
          data: {
            planningItemId,
            platform,
            scheduledFor: scheduledForIso,
            status: "scheduled",
          },
          card,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[scheduleFor] error:", err);
        return { ok: false, error: message };
      }
    },
  };
