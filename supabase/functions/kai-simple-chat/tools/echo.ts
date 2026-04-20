/**
 * Tool demo `echo` — prova o loop Gemini function calling end-to-end.
 *
 * O LLM decide chamar `echo({ text: "hello" })`, o runner executa,
 * emite um action_card do tipo "draft" (usando o payload como body),
 * e devolve `data` pro LLM continuar o raciocínio.
 *
 * Usa-se apenas pra smoke test da infra (F0.4). Será removida ou
 * substituída na F0.3c quando createContent/publishNow etc. entrarem.
 */

import {
  newActionCardId,
} from "../../_shared/kai-stream.ts";
import type {
  RegisteredTool,
} from "./types.ts";

interface EchoArgs {
  text: string;
}

interface EchoData {
  echoedText: string;
  receivedAt: string;
}

export const echoTool: RegisteredTool<EchoArgs, EchoData> = {
  definition: {
    name: "echo",
    description:
      "Ferramenta de diagnóstico que repete o texto recebido. Use quando o usuário pedir 'eco', 'echo', 'teste', ou 'repita X'. Retorna o texto e cria um card visual com o eco.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "O texto exato que deve ser ecoado de volta.",
        },
      },
      required: ["text"],
    },
  },
  handler: async (args, ctx) => {
    const text = args.text ?? "(vazio)";
    const card = {
      id: newActionCardId(),
      type: "draft" as const,
      status: "done" as const,
      data: {
        kind: "draft" as const,
        clientId: ctx.clientId,
        platform: "echo",
        format: "echo",
        title: "Eco",
        body: text,
        briefing: `echo tool chamada em ${new Date().toLocaleTimeString("pt-BR")}`,
      },
      requires_approval: false,
      available_actions: [],
    };

    return {
      ok: true,
      data: { echoedText: text, receivedAt: new Date().toISOString() },
      card,
    };
  },
};
