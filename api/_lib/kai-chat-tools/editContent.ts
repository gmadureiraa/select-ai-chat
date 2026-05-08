/**
 * Tool `editContent` — edita/reescreve um rascunho via kai-content-agent.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { query } from '../db.js';

interface EditContentArgs {
  planningItemId: string;
  instruction: string;
}

interface EditContentData {
  planningItemId: string;
  content: string;
}

async function invokeContentAgentForEdit(
  internalBaseUrl: string,
  accessToken: string,
  clientId: string,
  currentContent: string,
  instruction: string,
  format: string,
  platform: string,
): Promise<string> {
  const editRequest =
    `Reescreva/edite o conteúdo abaixo seguindo esta instrução do usuário:\n\n` +
    `INSTRUÇÃO: ${instruction}\n\n` +
    `CONTEÚDO ATUAL:\n${currentContent}\n\n` +
    `Devolva SOMENTE a versão reescrita, mantendo o mesmo formato e plataforma.`;

  const res = await fetch(`${internalBaseUrl}/api/kai-content-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId,
      request: editRequest,
      format,
      platform,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`kai-content-agent ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json: any = await res.json().catch(() => ({}));
  const content = typeof json?.content === 'string' ? json.content : '';
  if (!content) throw new Error('kai-content-agent retornou conteúdo vazio');
  return content;
}

export const editContentTool: RegisteredTool<EditContentArgs, EditContentData> = {
  definition: {
    name: 'editContent',
    description:
      'Edita/reescreve um rascunho existente com base em instruções do usuário. Use quando o usuário quer ajustar, encurtar, alongar, mudar o tom, regenerar parcialmente, ou aplicar feedback específico sobre um rascunho que já existe. Atualiza o planning_item e retorna um card com a nova versão.',
    parameters: {
      type: 'object',
      properties: {
        planningItemId: {
          type: 'string',
          description: 'ID do planning_item (UUID) que contém o rascunho a ser editado.',
        },
        instruction: {
          type: 'string',
          description:
            "O que exatamente mudar no rascunho — ex: 'deixa mais curto', 'tom mais informal', 'adicionar CTA no fim', 'remover emojis', 'trocar exemplo de empresa'.",
        },
      },
      required: ['planningItemId', 'instruction'],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId ?? '').trim();
    const instruction = String(args.instruction ?? '').trim();

    if (!planningItemId || !instruction) {
      return { ok: false, error: 'Faltam campos obrigatórios: planningItemId ou instruction.' };
    }

    console.log(`[editContent] planningItemId=${planningItemId} client=${ctx.clientId}`);

    try {
      const items = await query<{
        id: string;
        title: string;
        content: string;
        platform: string;
        metadata: any;
        client_id: string;
      }>(
        `SELECT id, title, content, platform, metadata, client_id
           FROM planning_items
          WHERE id = $1 AND client_id = $2 LIMIT 1`,
        [planningItemId, ctx.clientId],
      );
      const item = items[0];
      if (!item) return { ok: false, error: 'Rascunho não encontrado' };

      const currentContent = item.content ?? '';
      const platform = item.platform ?? 'instagram';
      const meta = (item.metadata ?? {}) as Record<string, any>;
      const format = meta.format ?? 'post';

      const newContent = await invokeContentAgentForEdit(
        ctx.internalBaseUrl,
        ctx.accessToken,
        ctx.clientId,
        currentContent,
        instruction,
        format,
        platform,
      );
      console.log(`[editContent] novo conteúdo gerado — ${newContent.length} chars`);

      const newTitle = newContent.replace(/\s+/g, ' ').trim().slice(0, 60);
      const nowIso = new Date().toISOString();
      const newMeta = {
        ...meta,
        last_edit_instruction: instruction,
        last_edited_at: nowIso,
      };
      await query(
        `UPDATE planning_items
            SET content = $1,
                title = $2,
                updated_at = $3,
                metadata = $4::jsonb
          WHERE id = $5`,
        [newContent, newTitle, nowIso, JSON.stringify(newMeta), planningItemId],
      );

      const briefing = meta.briefing ?? instruction;
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'draft',
        status: 'done',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform,
          format,
          title: newTitle,
          body: newContent,
          briefing,
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'approve_publish',
            label: 'Aprovar e publicar',
            variant: 'primary',
            tool_call: { name: 'publishNow', args: { planningItemId } },
          },
          { id: 'schedule', label: 'Agendar', variant: 'secondary', client_action: 'edit' },
          {
            id: 'regenerate',
            label: 'Refazer',
            variant: 'ghost',
            tool_call: { name: 'editContent', args: { planningItemId, instruction } },
          },
        ],
      };

      return { ok: true, data: { planningItemId, content: newContent }, card };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[editContent] error:', err);
      return { ok: false, error: message };
    }
  },
};
