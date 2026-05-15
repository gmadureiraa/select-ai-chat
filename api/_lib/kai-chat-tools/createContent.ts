/**
 * Tool `createContent` — gera rascunho via kai-content-agent + persiste em planning_items.
 * Node port: Neon SQL em vez de Supabase, fetch interno em vez de supabase.functions.invoke.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { query, insertRow } from '../db.js';
import { notifyPlanningItemTelegram } from '../telegram-planning.js';

interface CreateContentArgs {
  platform: string;
  format: string;
  briefing: string;
  tone?: string;
}

interface CreateContentData {
  planningItemId: string;
  content: string;
}

function inferContentType(format: string, platform: string): string {
  const f = format.toLowerCase();
  if (f.includes('thread') || f.includes('fio')) return 'thread';
  if (f.includes('carousel') || f.includes('carrossel') || f.includes('carrosel')) return 'carousel';
  if (f.includes('reel') || f.includes('short')) return 'short_video';
  if (platform === 'linkedin') return 'linkedin_post';
  if (platform === 'twitter' || platform === 'x') return 'tweet';
  if (platform === 'instagram') return 'instagram_post';
  return 'social_post';
}

function parseThreadItems(text: string): Array<{ text: string; media_urls: string[] }> | undefined {
  const cleaned = text.trim();
  if (!cleaned) return undefined;
  const bySeparators = cleaned
    .split(/\n\s*(?:---+|—{3,})\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const byNumbers = cleaned
    .split(/\n(?=\s*(?:tweet\s*)?\d+\s*(?:[\/.)-]|:)\s+)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const parts = bySeparators.length >= 2 ? bySeparators : byNumbers;
  if (parts.length < 2) return undefined;
  const tweets = parts
    .map((part) =>
      part
        .replace(/^\s*(?:tweet\s*)?\d+\s*(?:[\/.)-]|:)\s*/i, '')
        .replace(/\n\s*(?:---+|—{3,})\s*$/g, '')
        .trim()
        .slice(0, 280),
    )
    .filter(Boolean)
    .map((part) => ({ text: part, media_urls: [] }));
  return tweets.length >= 2 ? tweets : undefined;
}

async function invokeContentAgent(
  internalBaseUrl: string,
  accessToken: string,
  clientId: string,
  briefing: string,
  format: string,
  platform: string,
  tone?: string,
): Promise<string> {
  const effectiveRequest = tone ? `${briefing}\n\n[Tom desejado: ${tone}]` : briefing;
  const res = await fetch(`${internalBaseUrl}/api/kai-content-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      clientId,
      request: effectiveRequest,
      format,
      platform,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`kai-content-agent ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json().catch(() => ({} as any));
  const content = typeof json?.content === 'string' ? json.content : '';
  if (!content) throw new Error('kai-content-agent retornou conteúdo vazio');
  return content;
}

async function resolveDraftColumnId(workspaceId: string): Promise<string | null> {
  const preferred = await query<{ id: string }>(
    `SELECT id FROM kanban_columns
       WHERE workspace_id = $1
         AND column_type = ANY($2::text[])
       ORDER BY position ASC LIMIT 1`,
    [workspaceId, ['idea', 'draft']],
  );
  if (preferred.length > 0) return preferred[0].id;

  const first = await query<{ id: string }>(
    `SELECT id FROM kanban_columns WHERE workspace_id = $1 ORDER BY position ASC LIMIT 1`,
    [workspaceId],
  );
  return first[0]?.id ?? null;
}

export const createContentTool: RegisteredTool<CreateContentArgs, CreateContentData> = {
  definition: {
    name: 'createContent',
    description:
      'Criar rascunho de post/conteúdo pra uma plataforma específica. Use quando o usuário pede pra criar, gerar, escrever, fazer um post, reel, carrossel, thread, newsletter ou vídeo. Gera o conteúdo via agente especializado e salva como rascunho no planejamento, devolvendo um card de aprovação pro usuário.',
    parameters: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'Plataforma de destino do conteúdo.',
          enum: ['instagram', 'twitter', 'linkedin', 'youtube', 'newsletter', 'tiktok'],
        },
        format: {
          type: 'string',
          description: 'Formato do conteúdo (ex: post, carousel, reel, thread, short, long, story).',
        },
        briefing: {
          type: 'string',
          description:
            'Pedido original do usuário detalhado — tema, ângulo, CTA, referências, qualquer contexto relevante pra produção.',
        },
        tone: {
          type: 'string',
          description:
            'Tom desejado opcional (ex: informal, analítico, provocativo, educativo). Se omitido, usa o tom padrão da marca.',
        },
      },
      required: ['platform', 'format', 'briefing'],
    },
  },

  handler: async (args, ctx) => {
    const platform = String(args.platform ?? '').toLowerCase();
    const format = String(args.format ?? '').toLowerCase();
    const briefing = String(args.briefing ?? '').trim();
    const tone = args.tone ? String(args.tone) : undefined;

    if (!platform || !format || !briefing) {
      return { ok: false, error: 'Faltam campos obrigatórios: platform, format ou briefing.' };
    }

    console.log(`[createContent] clientId=${ctx.clientId} platform=${platform} format=${format}`);

    try {
      const clients = await query<{ id: string; workspace_id: string }>(
        `SELECT id, workspace_id FROM clients WHERE id = $1`,
        [ctx.clientId],
      );
      const client = clients[0];
      if (!client) {
        return { ok: false, error: 'Cliente não encontrado ou sem workspace associado.' };
      }
      const workspaceId = client.workspace_id;
      if (!workspaceId) {
        return { ok: false, error: 'Cliente não está associado a nenhum workspace.' };
      }

      const content = await invokeContentAgent(
        ctx.internalBaseUrl,
        ctx.accessToken,
        ctx.clientId,
        briefing,
        format,
        platform,
        tone,
      );
      console.log(`[createContent] content gerado — ${content.length} chars`);

      const columnId = await resolveDraftColumnId(workspaceId);

      // Strip markdown heading + **Hook:** prefix antes de extrair título.
      // O Gemini frequentemente devolve `# {título}\n\n**Hook:** {mesmo título}\n\n{body}`.
      // Sem isso, title vira o cabeçalho markdown e duplica visualmente
      // quando a biblioteca mostra title + content lado a lado.
      const firstNonMetaLine = content
        .split(/\n/)
        .map((l) => l.trim())
        .find((l) => l && !/^\*\*Hook:\*\*/i.test(l) && !/^\*\*Gancho:\*\*/i.test(l));
      const rawTitle = (firstNonMetaLine ?? content).trim();
      const title = rawTitle
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
      const contentType = inferContentType(format, platform);
      const threadTweets =
        contentType === 'thread' || format.includes('thread') || format.includes('fio')
          ? parseThreadItems(content)
          : undefined;
      const item = await insertRow<{ id: string }>('planning_items', {
        title,
        content,
        platform,
        content_type: contentType,
        status: 'draft',
        client_id: ctx.clientId,
        workspace_id: workspaceId,
        created_by: ctx.userId,
        column_id: columnId,
        metadata: JSON.stringify({
          source: 'kai-tool:createContent',
          format,
          briefing,
          tone: tone ?? null,
          content_type: contentType,
          target_platforms: [platform],
          ...(threadTweets ? { thread_tweets: threadTweets } : {}),
        }),
      });
      const planningItemId = item.id;
      notifyPlanningItemTelegram(planningItemId, {
        mode: 'review',
        reason: 'Criado pelo KAI Chat',
      }).catch((error) => {
        console.warn('[createContent] telegram notify failed:', error);
      });

      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'draft',
        status: 'pending_approval',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform,
          format,
          title,
          body: content,
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
          {
            id: 'schedule',
            label: 'Agendar',
            variant: 'secondary',
            client_action: 'edit',
          },
          {
            id: 'regenerate',
            label: 'Refazer',
            variant: 'ghost',
            tool_call: { name: 'createContent', args: { platform, format, briefing } },
          },
        ],
      };

      return { ok: true, data: { planningItemId, content }, card };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[createContent] error:', err);
      return { ok: false, error: message };
    }
  },
};
