/**
 * Tool `deleteContent` — deleta conteúdo gerado (planning_item). Use pra
 * remover carrossel/post/tweet/thread/reel script que ainda não foi
 * publicado.
 *
 * AÇÃO DESTRUTIVA — exige `approved: true`. Se o item JÁ FOI PUBLICADO,
 * exige `force: true` adicional (deletar não despublica do feed, só apaga
 * a row).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import { query } from '../db.js';
import { requireApproval, consumeApprovalToken } from '../approval-flow.js';

interface DeleteContentArgs {
  planningItemId: string;
  approved?: boolean;
  /** Token gerado pela 1ª chamada (requires_approval). Obrigatório quando approved=true. */
  callbackToken?: string;
  force?: boolean;
}

interface DeleteContentData {
  planningItemId: string;
  requiresApproval?: boolean;
  wasPublished?: boolean;
}

export const deleteContentTool: RegisteredTool<DeleteContentArgs, DeleteContentData> = {
  definition: {
    name: 'deleteContent',
    description:
      'Deleta um planning_item (rascunho/carrossel/post). AÇÃO DESTRUTIVA — sempre passa requires_approval na primeira chamada. Se o post JÁ FOI PUBLICADO, exige force=true além de approved=true (deletar não remove da plataforma, só apaga o registro do KAI).',
    parameters: {
      type: 'object',
      properties: {
        planningItemId: { type: 'string', description: 'UUID do planning_item.' },
        approved: {
          type: 'boolean',
          description:
            'true quando o usuário JÁ confirmou via UI. Sempre false na primeira chamada.',
        },
        callbackToken: {
          type: 'string',
          description:
            'Token devolvido na 1ª chamada (campo callbackToken). OBRIGATÓRIO quando approved=true — sem ele a deleção é rejeitada.',
        },
        force: {
          type: 'boolean',
          description:
            'true pra forçar delete mesmo de item já publicado (só remove do KAI, não da plataforma).',
        },
      },
      required: ['planningItemId'],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId ?? '').trim();
    if (!planningItemId) return { ok: false, error: 'planningItemId obrigatório' };

    // Busca info do item pra mostrar preview + checar se publicado
    let title = '(sem título)';
    let wasPublished = false;
    try {
      const rows = await query<{ title: string; status: string; published_at: string | null }>(
        `SELECT title, status, published_at FROM planning_items WHERE id = $1 LIMIT 1`,
        [planningItemId],
      );
      const item = rows[0];
      if (item) {
        title = item.title ?? title;
        wasPublished = item.status === 'published' || !!item.published_at;
      } else {
        return { ok: false, error: 'Item não encontrado' };
      }
    } catch (err) {
      console.warn('[deleteContent] preview fetch failed:', err);
    }

    // Caso 1: ainda não aprovado — gera token approval e devolve preview.
    if (!args.approved) {
      const approval = requireApproval({
        action: 'delete_content',
        preview: {
          title: 'Confirmar deleção',
          description: `Deletar "${title}"?${
            wasPublished
              ? '\n\nEste item JÁ FOI PUBLICADO. Deletar não remove da plataforma — só apaga o registro no KAI.'
              : ''
          }`,
          impactedItems: [{ id: planningItemId, label: title }],
          irreversible: true,
        },
        toolName: 'deleteContent',
        toolArgs: { planningItemId, approved: true, force: wasPublished ? true : undefined },
      });
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'draft',
        status: 'pending_approval',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform: 'instagram',
          format: 'post',
          title: 'Confirmar deleção',
          body: `Tem certeza que quer deletar "${title}"?${
            wasPublished
              ? '\n\nESTE ITEM JÁ FOI PUBLICADO. Deletar não remove da plataforma — só apaga o registro no KAI.'
              : ''
          }`,
          briefing: planningItemId,
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'confirm_delete',
            label: wasPublished ? 'Deletar (já publicado)' : 'Deletar',
            variant: 'danger',
            tool_call: {
              name: 'deleteContent',
              args: {
                planningItemId,
                approved: true,
                callbackToken: approval.callbackToken,
                force: wasPublished ? true : undefined,
              },
            },
          },
          { id: 'cancel', label: 'Cancelar', variant: 'ghost', client_action: 'edit' },
        ],
      };
      // Retorna o approval como data — runner detecta via isApprovalRequest()
      // e propaga via stream pra UI abrir modal com o token correto.
      return { ok: true, data: approval, card };
    }

    // Caso 2: aprovado — SEMPRE exigir e consumir o token (single-use, TTL 5min).
    // Sem isso, qualquer caller (LLM, MCP, attacker) com approved=true direto
    // bypassava o flow. Token consume é o gate real.
    const token = typeof args.callbackToken === 'string' ? args.callbackToken : '';
    if (!consumeApprovalToken(token, 'delete_content')) {
      return {
        ok: false,
        error:
          'Token de aprovação inválido, expirado ou já consumido. Chame deleteContent SEM approved primeiro pra gerar um novo token.',
      };
    }

    // Caso 3: aprovado mas publicado e sem force
    if (wasPublished && !args.force) {
      return {
        ok: false,
        error: 'Item já publicado — passe force=true pra deletar (não despublica da plataforma).',
      };
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=planning-items-delete`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({ id: planningItemId }),
    }).catch((err) => {
      console.error('[deleteContent] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `planning-items-delete: ${errText.slice(0, 200)}` };
    }

    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId: ctx.clientId,
        platform: 'instagram',
        format: 'post',
        title: 'Conteúdo deletado',
        body: `"${title}" foi removido${wasPublished ? ' (mas continua publicado na plataforma)' : ''}.`,
        briefing: planningItemId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_planning',
          label: 'Ver planejamento',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { planningItemId, wasPublished }, card };
  },
};
