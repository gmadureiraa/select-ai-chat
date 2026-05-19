// Migrated from supabase/functions/kai-planning-agent/index.ts
// 2026-05-16 — Lovable Gateway morto; trocado por streamLLMToSse + Gemini 2.5 Flash.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, applyCors, jsonError } from '../_lib/cors.js';
import { verifyAuth } from '../_lib/auth.js';
import { queryOne, query } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { streamLLMToSse, isLLMConfigured } from '../_lib/llm.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  let authedUser;
  try {
    authedUser = await verifyAuth(req);
  } catch (e: any) {
    return jsonError(res, 401, e.message || 'Authentication required');
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
    const { clientId, workspaceId, request, action, quantity } = body;
    // 2026-05-18 — userId removido do body. authedUser.id é a fonte da verdade
    // (vem do JWT). Antes aceitava userId arbitrário pra registrar como
    // target_user_id em metadata — vetor de log spoofing baixo, mas tirado.
    const userId = authedUser.id;
    if (!clientId || !workspaceId) return jsonError(res, 400, 'clientId e workspaceId são obrigatórios');
    await assertClientAccess(authedUser.id, clientId);
    if (!isLLMConfigured()) {
      return jsonError(res, 500, 'Nenhum provider LLM configurado (GOOGLE_AI_STUDIO_API_KEY ou OPENAI_API_KEY).');
    }

    const client = await queryOne<any>(`SELECT name, description, identity_guide FROM clients WHERE id = $1`, [clientId]);
    const topPosts = await query<any>(
      `SELECT caption, post_type, engagement_rate, likes FROM instagram_posts WHERE client_id = $1 ORDER BY engagement_rate DESC NULLS LAST LIMIT 5`,
      [clientId]
    );

    let contextPrompt = `## Cliente: ${client?.name || 'Não especificado'}\n`;
    if (client?.description) contextPrompt += `${client.description}\n`;
    if (topPosts && topPosts.length > 0) {
      contextPrompt += `\n### Posts com Melhor Performance\n`;
      topPosts.forEach((p, i) => {
        contextPrompt += `${i + 1}. ${p.post_type || 'Post'} - ${(p.engagement_rate || 0).toFixed(2)}% eng\n`;
        if (p.caption) contextPrompt += `   "${String(p.caption).slice(0, 60)}..."\n`;
      });
    }

    const systemPrompt = `Você é um estrategista de conteúdo especializado em planejamento editorial.

${contextPrompt}

## Sua Tarefa:
${action === 'suggest' ? 'Gerar ideias de conteúdo criativas e estratégicas' : ''}
${action === 'create' ? 'Criar cards de planejamento prontos para execução' : ''}
${action === 'schedule' ? 'Sugerir um cronograma de publicações' : ''}

${quantity ? `Quantidade solicitada: ${quantity} ideias/posts` : ''}

## Formato:
Para cada ideia, forneça Título, Formato, Objetivo, Conceito.
Se for para criar no planejamento, responda com JSON:
\`\`\`json
{
  "ideas": [
    { "title": "...", "format": "...", "description": "...", "platform": "instagram" }
  ],
  "createInPlanning": true
}
\`\`\``;

    await streamLLMToSse(
      res,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request || '' },
      ],
      {
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 4096,
        usageContext: {
          userId: authedUser.id,
          edgeFunction: 'kai-planning-agent',
          clientId,
          metadata: { action: action || null, requested_quantity: quantity || null, target_user_id: userId, workspace_id: workspaceId },
        },
      },
    );
    res.end();
  } catch (e: any) {
    console.error('[kai-planning-agent] error:', e);
    if (!res.writableEnded) {
      res.status(500).json({ error: e?.message || 'Erro desconhecido' });
    }
  }
}
