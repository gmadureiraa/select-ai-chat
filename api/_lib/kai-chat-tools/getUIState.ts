/**
 * Tool `getUIState` — retorna o snapshot da UI que o user estava vendo
 * quando enviou a mensagem.
 *
 * O front injeta `x-kai-ui-state: <base64-json>` no header da request.
 * O handler `kai-simple-chat` decodifica e expõe no `ctx.uiState`. Essa
 * tool apenas faz "espelho" desse contexto pro LLM.
 *
 * Shape esperado (best-effort, nada é obrigatório):
 *   {
 *     tab?: string,            // ex: "assistant", "library", "planning", "performance"
 *     clientId?: string,
 *     itemId?: string,         // planning_item ou ref selecionado
 *     draftDirty?: boolean,    // se há mudanças não salvas num editor
 *     monthInView?: string,    // ex: "2026-05"
 *     filters?: Record<string, unknown>,
 *     pathname?: string,
 *   }
 *
 * Use quando o user disser coisas tipo "esse mesmo", "o que tô vendo agora",
 * "esse item", "essa aba", "esse mês", ou quando precisar saber em que
 * contexto da UI o user está.
 */
import type { RegisteredTool } from './types.js';

interface GetUIStateArgs {
  [key: string]: unknown;
}

interface GetUIStateData {
  available: boolean;
  tab: string | null;
  clientId: string | null;
  itemId: string | null;
  draftDirty: boolean | null;
  monthInView: string | null;
  filters: Record<string, unknown> | null;
  pathname: string | null;
  /** Pass-through de qualquer outro campo extra que o front mandar (não
   *  documentado mas tolerado, pra evolução incremental sem mudar o tool). */
  extras: Record<string, unknown>;
}

const KNOWN_KEYS = new Set([
  'tab',
  'clientId',
  'itemId',
  'draftDirty',
  'monthInView',
  'filters',
  'pathname',
]);

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export const getUIStateTool: RegisteredTool<GetUIStateArgs, GetUIStateData> = {
  definition: {
    name: 'getUIState',
    description:
      "Retorna o snapshot da UI que o user está vendo agora (aba, cliente selecionado, item aberto, mês visível, filtros). Use quando o user disser 'esse mesmo', 'o que tô vendo', 'esse item', 'essa aba', 'esse mês', 'esse filtro' — pra resolver pronomes contextuais. Se available=false, o front não mandou o snapshot (modo legado ou bot).",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  handler: async (_args, ctx) => {
    const ui = ctx.uiState ?? null;

    if (!ui || typeof ui !== 'object') {
      return {
        ok: true,
        data: {
          available: false,
          tab: null,
          clientId: null,
          itemId: null,
          draftDirty: null,
          monthInView: null,
          filters: null,
          pathname: null,
          extras: {},
        },
      };
    }

    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ui)) {
      if (!KNOWN_KEYS.has(k)) extras[k] = v;
    }

    const data: GetUIStateData = {
      available: true,
      tab: asStr(ui.tab),
      clientId: asStr(ui.clientId),
      itemId: asStr(ui.itemId),
      draftDirty: asBool(ui.draftDirty),
      monthInView: asStr(ui.monthInView),
      filters: asObj(ui.filters),
      pathname: asStr(ui.pathname),
      extras,
    };

    console.log(
      `[getUIState] tab=${data.tab ?? '-'} client=${data.clientId ?? '-'} item=${data.itemId ?? '-'} dirty=${data.draftDirty ?? '-'}`,
    );

    return { ok: true, data };
  },
};
