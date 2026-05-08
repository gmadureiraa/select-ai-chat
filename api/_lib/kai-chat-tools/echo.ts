/**
 * Tool demo `echo` — prova o loop Gemini function calling end-to-end.
 */
import { newActionCardId } from './kai-stream.js';
import type { RegisteredTool } from './types.js';

interface EchoArgs {
  text: string;
}

interface EchoData {
  echoedText: string;
  receivedAt: string;
}

export const echoTool: RegisteredTool<EchoArgs, EchoData> = {
  definition: {
    name: 'echo',
    description:
      "Ferramenta de diagnóstico que repete o texto recebido. Use quando o usuário pedir 'eco', 'echo', 'teste', ou 'repita X'. Retorna o texto e cria um card visual com o eco.",
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'O texto exato que deve ser ecoado de volta.',
        },
      },
      required: ['text'],
    },
  },
  handler: async (args, ctx) => {
    const text = args.text ?? '(vazio)';
    const card = {
      id: newActionCardId(),
      type: 'draft' as const,
      status: 'done' as const,
      data: {
        kind: 'draft' as const,
        clientId: ctx.clientId,
        platform: 'echo',
        format: 'echo',
        title: 'Eco',
        body: text,
        briefing: `echo tool chamada em ${new Date().toLocaleTimeString('pt-BR')}`,
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
