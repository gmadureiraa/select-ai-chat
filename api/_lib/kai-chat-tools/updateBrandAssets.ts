/**
 * Tool `updateBrandAssets` — wrapper semântico sobre updateClient pra mexer
 * só nos brand assets (logo, cores, fontes). Persiste em
 * `clients.brand_assets` jsonb. Faz merge raso com brand_assets atual se
 * `merge=true` (default).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import { query } from '../db.js';
import { assertToolClientAccess, isToolAccessFail } from './tool-access.js';

/**
 * Remove chaves perigosas de prototype pollution (__proto__, constructor, prototype).
 * Aplica recursivamente em objetos planos. Não toca em arrays.
 */
function sanitizePollutionKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sanitizePollutionKeys) as unknown as T;
  }
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = sanitizePollutionKeys(v);
  }
  return out as unknown as T;
}

interface UpdateBrandAssetsArgs {
  client_id?: string;
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  colors?: Record<string, string>;
  primary_font?: string;
  secondary_font?: string;
  typography?: Record<string, unknown>;
  /** Quando true (default), faz merge raso com brand_assets atual. false = substitui completo. */
  merge?: boolean;
}

interface UpdateBrandAssetsData {
  clientId: string;
  fieldsUpdated: string[];
}

export const updateBrandAssetsTool: RegisteredTool<
  UpdateBrandAssetsArgs,
  UpdateBrandAssetsData
> = {
  definition: {
    name: 'updateBrandAssets',
    description:
      'Atualiza brand assets do cliente (logo, cores, tipografia). Use quando o usuário pedir "muda a cor primária pro #FF3D2E", "atualiza logo do cliente", "troca a fonte", "salva paleta nova". Faz merge raso com brand_assets atual por padrão (use merge=false pra substituir completo).',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID do cliente. Default: cliente atual.' },
        logo_url: { type: 'string', description: 'URL do logo principal (light).' },
        logo_dark_url: { type: 'string', description: 'URL do logo pra fundo escuro.' },
        favicon_url: { type: 'string', description: 'URL do favicon.' },
        primary_color: { type: 'string', description: 'Cor primária (hex #RRGGBB).' },
        secondary_color: { type: 'string', description: 'Cor secundária.' },
        accent_color: { type: 'string', description: 'Cor de destaque/accent.' },
        background_color: { type: 'string', description: 'Cor de fundo.' },
        text_color: { type: 'string', description: 'Cor de texto principal.' },
        colors: {
          type: 'object',
          description: 'Objeto com qualquer outro mapping de cores extras.',
        },
        primary_font: { type: 'string', description: 'Fonte primária (heading).' },
        secondary_font: { type: 'string', description: 'Fonte secundária (body).' },
        typography: {
          type: 'object',
          description: 'Object com weights/sizes/line-heights extras.',
        },
        merge: {
          type: 'boolean',
          description:
            'true (default) = merge raso com brand_assets atual. false = substitui completo.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id obrigatório (nenhum cliente selecionado)' };
    }

    // SECURITY: validar acesso ANTES de mutate.
    const guard = await assertToolClientAccess(ctx, clientId);
    if (isToolAccessFail(guard)) return { ok: false, error: guard.error };

    const merge = args.merge ?? true;

    // SECURITY: sanitizar args contra prototype pollution. brand_assets é
    // JSONB no Postgres (não é mais executado como JS), mas consumers (front
    // que renderiza brand) podem fazer `assets[key]` direto → poluição via
    // __proto__/constructor seria danosa.
    const sanitizedArgs = sanitizePollutionKeys(args);

    // Monta brand_assets a partir dos args
    const incoming: Record<string, unknown> = {};
    const colors: Record<string, string> = { ...(sanitizedArgs.colors ?? {}) };
    if (sanitizedArgs.primary_color) colors.primary = sanitizedArgs.primary_color;
    if (sanitizedArgs.secondary_color) colors.secondary = sanitizedArgs.secondary_color;
    if (sanitizedArgs.accent_color) colors.accent = sanitizedArgs.accent_color;
    if (sanitizedArgs.background_color) colors.background = sanitizedArgs.background_color;
    if (sanitizedArgs.text_color) colors.text = sanitizedArgs.text_color;
    if (Object.keys(colors).length > 0) incoming.colors = colors;

    if (sanitizedArgs.logo_url) incoming.logo_url = sanitizedArgs.logo_url;
    if (sanitizedArgs.logo_dark_url) incoming.logo_dark_url = sanitizedArgs.logo_dark_url;
    if (sanitizedArgs.favicon_url) incoming.favicon_url = sanitizedArgs.favicon_url;

    const typography: Record<string, unknown> = { ...(sanitizedArgs.typography ?? {}) };
    if (sanitizedArgs.primary_font) typography.primary_font = sanitizedArgs.primary_font;
    if (sanitizedArgs.secondary_font) typography.secondary_font = sanitizedArgs.secondary_font;
    if (Object.keys(typography).length > 0) incoming.typography = typography;

    if (Object.keys(incoming).length === 0) {
      return { ok: false, error: 'Passe ao menos um campo de brand asset.' };
    }

    // Se merge=true, busca brand_assets atual e faz merge raso
    let newBrandAssets: Record<string, unknown> = incoming;
    if (merge) {
      try {
        const rows = await query<{ brand_assets: Record<string, unknown> | null }>(
          `SELECT brand_assets FROM clients WHERE id = $1 LIMIT 1`,
          [clientId],
        );
        // Sanitizar current também — proteção contra dados antigos
        // potencialmente poluídos antes deste fix.
        const current = sanitizePollutionKeys(rows[0]?.brand_assets ?? {});
        newBrandAssets = { ...current };
        for (const [k, v] of Object.entries(incoming)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
          if (k === 'colors' || k === 'typography') {
            const currentSub = (current as any)?.[k];
            const isObj = currentSub && typeof currentSub === 'object' && !Array.isArray(currentSub);
            newBrandAssets[k] = isObj ? { ...currentSub, ...(v as Record<string, unknown>) } : v;
          } else {
            newBrandAssets[k] = v;
          }
        }
      } catch (err) {
        console.warn('[updateBrandAssets] merge fetch failed, using replace:', err);
        newBrandAssets = incoming;
      }
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=client-update`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({
        client_id: clientId,
        brand_assets: newBrandAssets,
      }),
    }).catch((err) => {
      console.error('[updateBrandAssets] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `client-update: ${errText.slice(0, 200)}` };
    }

    const fieldsUpdated = Object.keys(incoming);
    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId,
        platform: 'client',
        format: 'client',
        title: 'Brand assets atualizados',
        body: `Campos atualizados: ${fieldsUpdated.join(', ')}${
          merge ? '\nModo: merge' : '\nModo: replace'
        }`,
        briefing: clientId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_client',
          label: 'Ver cliente',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { clientId, fieldsUpdated }, card };
  },
};
