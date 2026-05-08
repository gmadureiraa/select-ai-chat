/**
 * Tool `listAutomations` — lista planning_automations do workspace.
 * Útil pra "quais automações tenho ativas?" ou "lista as automações desse cliente".
 */
import type { RegisteredTool } from './types.js';

interface ListAutomationsArgs {
  status?: 'active' | 'paused' | 'all';
  platform?: string;
  client_id?: string;
}

interface AutomationSummary {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  platform: string | null;
  platforms?: string[] | null;
  content_type: string;
  auto_publish: boolean;
  auto_generate_image: boolean;
  last_triggered_at: string | null;
  items_created: number;
}

interface ListAutomationsData {
  automations: AutomationSummary[];
  count: number;
}

export const listAutomationsTool: RegisteredTool<ListAutomationsArgs, ListAutomationsData> = {
  definition: {
    name: 'listAutomations',
    description:
      "Lista as automações de conteúdo (planning_automations) do workspace. Use quando o usuário perguntar 'quais automações tenho?', 'lista as automações ativas', 'tem alguma automação rodando pra Twitter?'. Devolve lista resumida (id, nome, trigger, plataforma, ativa/pausada).",
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'all'],
          description: 'Filtra por status. Default: all.',
        },
        platform: {
          type: 'string',
          description: 'Filtra por plataforma (instagram, twitter, etc).',
        },
        client_id: {
          type: 'string',
          description: 'UUID do cliente — se passado, filtra automações desse cliente.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=automations-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
      },
      body: JSON.stringify({
        status: args.status ?? 'all',
        platform: args.platform,
        client_id: args.client_id ?? ctx.clientId ?? undefined,
      }),
    }).catch((err) => {
      console.error('[listAutomations] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `automations-list: ${errText.slice(0, 200)}` };
    }

    const json: any = await res.json();
    const automations: AutomationSummary[] = Array.isArray(json?.automations)
      ? json.automations.map((a: any) => ({
          id: String(a.id ?? ''),
          name: String(a.name ?? '(sem nome)'),
          is_active: !!a.is_active,
          trigger_type: String(a.trigger_type ?? 'schedule'),
          platform: a.platform ?? null,
          platforms: a.platforms ?? null,
          content_type: String(a.content_type ?? 'social_post'),
          auto_publish: !!a.auto_publish,
          auto_generate_image: !!a.auto_generate_image,
          last_triggered_at: a.last_triggered_at ?? null,
          items_created: Number(a.items_created ?? 0),
        }))
      : [];

    return { ok: true, data: { automations, count: automations.length } };
  },
};
