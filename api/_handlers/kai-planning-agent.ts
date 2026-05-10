// Migrated from supabase/functions/kai-planning-agent/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, applyCors, jsonError } from '../_lib/cors.js';
import { verifyAuth } from '../_lib/auth.js';
import { queryOne, query } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  let authedUser;
  try {
    authedUser = await verifyAuth(req);
  } catch (e: any) {
    return jsonError(res, 401, e.message || 'Authentication required');
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
    const { clientId, workspaceId, userId, request, action, quantity } = body;
    if (!clientId || !workspaceId || !userId) return jsonError(res, 400, 'clientId, workspaceId e userId são obrigatórios');
    await assertClientAccess(authedUser.id, clientId);

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

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) return jsonError(res, 500, 'LOVABLE_API_KEY não configurada');

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request || '' },
        ],
        stream: true,
      }),
    });
    if (!aiRes.ok || !aiRes.body) {
      const errText = await aiRes.text().catch(() => '');
      console.error('[kai-planning-agent] AI error:', aiRes.status, errText);
      return jsonError(res, 500, 'Erro ao gerar planejamento');
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);
    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
  } catch (e: any) {
    console.error('[kai-planning-agent] error:', e);
    if (!res.writableEnded) {
      res.status(500).json({ error: e?.message || 'Erro desconhecido' });
    }
  }
}
