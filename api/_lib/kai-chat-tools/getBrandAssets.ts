/**
 * Tool `getBrandAssets` — retorna brand assets do cliente (logo, cores, tipografia).
 *
 * Lê:
 *  - `clients.brand_assets` JSONB — shape novo (logos[], colors[], fonts[], etc)
 *  - `client_visual_references` — entries com reference_type='logo' / 'color_palette' / 'style_example'
 *
 * Use quando o user perguntar "cores do cliente", "logo dele", "tipografia",
 * "qual a paleta?", "tem logo cadastrada?".
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';
import { assertToolClientAccess, isToolAccessFail } from './tool-access.js';

interface GetBrandAssetsArgs {
  client_id?: string;
  includeVisualRefs?: boolean;
}

interface VisualRefOut {
  id: string;
  imageUrl: string;
  title: string | null;
  referenceType: string;
  isPrimary: boolean;
}

interface GetBrandAssetsData {
  clientId: string;
  clientName: string | null;
  brandAssets: Record<string, unknown>;
  hasBrandAssets: boolean;
  logos: VisualRefOut[];
  colorPalettes: VisualRefOut[];
  otherVisualRefs: VisualRefOut[];
}

const MAX_VISUAL_REFS = 30;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export const getBrandAssetsTool: RegisteredTool<GetBrandAssetsArgs, GetBrandAssetsData> = {
  definition: {
    name: 'getBrandAssets',
    description:
      "Retorna brand assets do cliente: cores, tipografia, logos cadastradas e refs visuais (logos, paletas, style examples). Use quando o user perguntar sobre identidade visual, cores, logo, tipografia, paleta, design system do cliente.",
    parameters: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual.',
        },
        includeVisualRefs: {
          type: 'boolean',
          description:
            'Se true (default), inclui entries de client_visual_references (logos, paletas, style examples). Se false, apenas o JSONB clients.brand_assets.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id obrigatório (nenhum cliente selecionado).' };
    }
    const includeVisualRefs = args.includeVisualRefs !== false;

    // SECURITY: brand_assets pode conter URLs internas / refs visuais privadas.
    // Validar acesso antes de devolver.
    const guard = await assertToolClientAccess(ctx, clientId);
    if (isToolAccessFail(guard)) return { ok: false, error: guard.error };

    try {
      const c = await queryOne<{
        name: string | null;
        brand_assets: unknown;
      }>(
        `SELECT name, brand_assets FROM clients WHERE id = $1 LIMIT 1`,
        [clientId],
      );
      if (!c) return { ok: false, error: 'Cliente não encontrado.' };

      const brandAssets: Record<string, unknown> = isPlainObject(c.brand_assets)
        ? c.brand_assets
        : {};
      const hasBrandAssets = Object.keys(brandAssets).length > 0;

      let logos: VisualRefOut[] = [];
      let colorPalettes: VisualRefOut[] = [];
      let otherVisualRefs: VisualRefOut[] = [];

      if (includeVisualRefs) {
        const refs = await query<{
          id: string;
          image_url: string;
          title: string | null;
          reference_type: string;
          is_primary: boolean | null;
        }>(
          `SELECT id, image_url, title, reference_type, is_primary
             FROM client_visual_references
            WHERE client_id = $1
            ORDER BY is_primary DESC NULLS LAST, created_at DESC
            LIMIT $2`,
          [clientId, MAX_VISUAL_REFS],
        );

        for (const r of refs) {
          const item: VisualRefOut = {
            id: String(r.id ?? ''),
            imageUrl: String(r.image_url ?? ''),
            title: r.title ?? null,
            referenceType: r.reference_type ?? 'style_example',
            isPrimary: !!r.is_primary,
          };
          if (item.referenceType === 'logo') logos.push(item);
          else if (item.referenceType === 'color_palette') colorPalettes.push(item);
          else otherVisualRefs.push(item);
        }
      }

      console.log(
        `[getBrandAssets] client=${clientId} brandAssets=${hasBrandAssets} logos=${logos.length} palettes=${colorPalettes.length} other=${otherVisualRefs.length}`,
      );

      return {
        ok: true,
        data: {
          clientId,
          clientName: c.name ?? null,
          brandAssets,
          hasBrandAssets,
          logos,
          colorPalettes,
          otherVisualRefs,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getBrandAssets] error:', err);
      return { ok: false, error: message };
    }
  },
};
