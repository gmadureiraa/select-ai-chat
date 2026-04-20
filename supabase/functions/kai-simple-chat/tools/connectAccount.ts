/**
 * Tool `connectAccount` — devolve URL OAuth pra conectar uma conta social via
 * Late API. Chama a edge `late-oauth-start` com clientId + platform e retorna
 * card do tipo "connect_account" que o frontend renderiza com botão
 * "Conectar".
 *
 * Usado em dois cenários:
 *   1. Usuário pede explicitamente: "conectar meu Instagram", "plugar LinkedIn"
 *   2. publishNow/scheduleFor falham por falta de conta → KAI propõe conectar
 */

import {
  newActionCardId,
  type KAIActionCard,
} from "../../_shared/kai-stream.ts";
import type { RegisteredTool } from "./types.ts";

interface ConnectAccountArgs {
  platform: string;
}

interface ConnectAccountData {
  platform: string;
  oauthUrl: string;
}

const SUPPORTED_PLATFORMS = [
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "facebook",
] as const;

export const connectAccountTool: RegisteredTool<
  ConnectAccountArgs,
  ConnectAccountData
> = {
  definition: {
    name: "connectAccount",
    description:
      "Devolve URL OAuth pra conectar uma conta social. Use quando o usuário menciona conectar/plugar uma plataforma OU quando publishNow falha por falta de conta.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description:
            "Plataforma a ser conectada via OAuth através da Late API.",
          enum: [...SUPPORTED_PLATFORMS],
        },
      },
      required: ["platform"],
    },
  },

  handler: async (args, ctx) => {
    const platform = String(args.platform ?? "").toLowerCase().trim();

    if (!platform) {
      return { ok: false, error: "platform é obrigatório." };
    }
    if (!SUPPORTED_PLATFORMS.includes(platform as typeof SUPPORTED_PLATFORMS[number])) {
      return {
        ok: false,
        error: `Plataforma "${platform}" não suportada. Opções: ${SUPPORTED_PLATFORMS.join(", ")}.`,
      };
    }

    console.log(
      `[connectAccount] clientId=${ctx.clientId} platform=${platform}`,
    );

    try {
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

      const res = await fetch(
        `${ctx.supabaseUrl}/functions/v1/late-oauth-start`,
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
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(
          `[connectAccount] late-oauth-start ${res.status}: ${errText.slice(0, 300)}`,
        );

        let userMessage = `Falha ao iniciar conexão com ${platform}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson?.error) userMessage = String(errJson.error);
        } catch {
          if (errText) userMessage = errText.slice(0, 200);
        }

        const card: KAIActionCard = {
          id: newActionCardId(),
          type: "error",
          status: "error",
          data: {
            kind: "error",
            message: userMessage,
            toolName: "connectAccount",
            recoverable: true,
          },
          requires_approval: false,
          available_actions: [],
        };
        return {
          ok: false,
          error: userMessage,
          card,
        };
      }

      const json = await res.json().catch(() => ({}));
      const oauthUrl: string | undefined =
        typeof json?.authUrl === "string" ? json.authUrl : undefined;

      if (!oauthUrl) {
        const msg = "late-oauth-start não retornou authUrl.";
        console.error("[connectAccount]", msg, json);
        return { ok: false, error: msg };
      }

      // Card final: front renderiza botão "Conectar" a partir do oauthUrl
      const card: KAIActionCard = {
        id: newActionCardId(),
        type: "connect_account",
        status: "pending_approval",
        data: {
          kind: "connect_account",
          platform,
          oauthUrl,
          reason: `Clique pra conectar ${platform} via Late`,
        },
        requires_approval: true,
        available_actions: [],
      };

      return {
        ok: true,
        data: { platform, oauthUrl },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[connectAccount] error:", err);
      return { ok: false, error: message };
    }
  },
};
