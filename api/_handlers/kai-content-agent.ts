// Migrated from supabase/functions/kai-content-agent/index.ts (FULL)
// Uses centralized prompt-builder + knowledge-loader for consistent context.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { assertClientAccess } from '../_lib/access.js';

const ContentBodySchema = z.object({
  clientId: z.string().min(1, 'clientId é obrigatório'),
  request: z.string().optional(),
  message: z.string().optional(),
  format: z.string().optional(),
  platform: z.string().optional(),
  workspaceId: z.string().optional(),
  conversationHistory: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .optional(),
  includePerformanceContext: z.boolean().optional(),
  additionalMaterial: z.string().optional(),
  stream: z.boolean().optional(),
});
import {
  buildWriterSystemPrompt,
  selectModelForFormat,
} from '../_lib/shared/prompt-builder.js';
import { normalizeFormatKey } from '../_lib/shared/knowledge-loader.js';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';
import {
  getClientContextServer,
  buildClientPromptContext,
  buildClientHistoricalReferences,
} from '../_lib/shared/client-context.js';
import { checkTokens, debitTokens, VIRAL_TOKEN_COSTS } from '../_lib/shared/tokens.js';

interface ContentRequest {
  clientId: string;
  request?: string;
  message?: string;
  format?: string;
  platform?: string;
  workspaceId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  includePerformanceContext?: boolean;
  additionalMaterial?: string;
  stream?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  try {
    const body = req.body && typeof req.body === 'object'
      ? req.body
      : (req.body ? JSON.parse(req.body) : {});
    const parsed = ContentBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        res,
        400,
        `Invalid input: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    const requestBody = parsed.data as ContentRequest;
    const {
      clientId,
      request,
      message,
      format,
      platform,
      workspaceId,
      conversationHistory,
      includePerformanceContext = true,
      additionalMaterial,
      stream = true,
    } = requestBody;

    const userRequest = request || message || '';

    const user = await tryAuth(req);
    let userId: string | null = user?.id ?? null;
    let resolvedWorkspaceId: string | null = workspaceId ?? null;
    if (user && clientId) await assertClientAccess(user.id, clientId);

    if (clientId) {
      const c = await queryOne<any>(
        `SELECT user_id, created_by, workspace_id FROM clients WHERE id = $1`,
        [clientId]
      );
      if (!userId) {
        userId = c?.user_id || c?.created_by || null;
      }
      if (!resolvedWorkspaceId) {
        resolvedWorkspaceId = c?.workspace_id ?? null;
      }
      if (!userId && c?.workspace_id) {
        const ws = await queryOne<any>(
          `SELECT owner_id FROM workspaces WHERE id = $1`,
          [c.workspace_id]
        );
        userId = ws?.owner_id || null;
      }
    }

    // Token check (Fase F — 2026-05-08).
    // Brief/post genérico custa VIRAL_TOKEN_COSTS.brief (default 10).
    // Cron/internal não pagam (este handler só atende request autenticado, mas
    // alguns chats internos podem chamar via service auth — checamos o header).
    const isInternalCall = req.headers['x-internal-call'] === 'true';
    const tokenCost = VIRAL_TOKEN_COSTS.brief;
    if (!isInternalCall && resolvedWorkspaceId) {
      const status = await checkTokens(resolvedWorkspaceId, tokenCost);
      if (!status.ok) {
        return res.status(402).json({
          ok: false,
          error: 'TOKENS_EXHAUSTED',
          message: `Créditos insuficientes (${status.remaining} disponíveis, ${tokenCost} necessários). Faça upgrade do seu plano.`,
          remaining: status.remaining,
          needed: tokenCost,
        });
      }
    }

    const normalizedFormat = normalizeFormatKey(format || 'post');

    // ===================================================
    // BUILD SYSTEM PROMPT using centralized builder
    // ===================================================
    const systemPrompt = await buildWriterSystemPrompt({
      clientId,
      format: normalizedFormat,
      workspaceId,
      includeVoice: true,
      includeLibrary: true,
      includePerformers: includePerformanceContext,
      includeGlobalKnowledge: !!workspaceId,
      includeSuccessPatterns: true,
      includeChecklist: true,
      additionalMaterial,
      maxLibraryExamples: 5,
      maxTopPerformers: 5,
    });

    // Multi-tenant context layer (tone/pillars/persona/keywords/competitors).
    // Layered ON TOP of buildWriterSystemPrompt so legacy paths still work
    // and new client_preferences rows are reflected immediately.
    let viralContextBlock = '';
    let viralHistoricalBlock = '';
    try {
      const clientContext = await getClientContextServer(clientId);
      viralContextBlock = buildClientPromptContext(clientContext);
      // Usa user request como query pra similarity search puxar refs relevantes.
      viralHistoricalBlock = await buildClientHistoricalReferences(
        clientContext,
        userRequest || '',
        3
      );
    } catch (ctxErr) {
      console.warn('[kai-content-agent] viral context load failed:', ctxErr);
    }

    const platformSuffix = `\n\n## Formato Solicitado: ${format || 'post'}\n## Plataforma: ${platform || 'Instagram'}`;
    const fullSystemPrompt = [
      systemPrompt,
      viralContextBlock,
      viralHistoricalBlock,
      platformSuffix,
    ]
      .filter(Boolean)
      .join('\n\n');

    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!apiKey) return jsonError(res, 500, 'Chave da API do Google AI não configurada');

    // Build messages array (system + history + user)
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: fullSystemPrompt },
    ];
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-10));
    }
    messages.push({ role: 'user', content: userRequest });

    // Convert to Gemini format (system → user, assistant → model), merge consecutive same-role
    const geminiContents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const merged: typeof geminiContents = [];
    for (const c of geminiContents) {
      if (merged.length && merged[merged.length - 1].role === c.role) {
        merged[merged.length - 1].parts[0].text += '\n\n' + c.parts[0].text;
      } else {
        merged.push(c);
      }
    }

    const modelConfig = selectModelForFormat(normalizedFormat);
    const modelName = modelConfig.model;
    const useStreaming = stream !== false;

    console.log(`[kai-content-agent] Using model: ${modelName} (format: ${normalizedFormat}, streaming: ${useStreaming})`);

    // Non-streaming
    if (!useStreaming) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: merged,
            generationConfig: {
              temperature: modelConfig.temperature,
              maxOutputTokens: modelConfig.maxTokens,
            },
          }),
        }
      );
      if (!r.ok) {
        if (r.status === 429) return jsonError(res, 429, 'Rate limit excedido. Tente novamente.');
        const t = await r.text();
        console.error('Gemini API error:', t);
        return jsonError(res, 500, 'Erro ao gerar conteúdo');
      }
      const result = await r.json();
      const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const inTok = result?.usageMetadata?.promptTokenCount ?? estimateTokens(fullSystemPrompt + userRequest);
      const outTok = result?.usageMetadata?.candidatesTokenCount ?? estimateTokens(content);
      if (userId) {
        await logAIUsage(userId, modelName, 'kai-content-agent', inTok, outTok, {
          client_id: clientId,
          format: normalizedFormat,
          platform,
          streaming: false,
        });
      }
      // Debit tokens (Fase F) — non-streaming path. Failsoft.
      if (!isInternalCall && resolvedWorkspaceId) {
        try {
          await debitTokens(resolvedWorkspaceId, tokenCost, `kai-content-agent:${normalizedFormat}`);
        } catch (debitErr) {
          console.warn('[kai-content-agent] debit failed (non-blocking):', debitErr);
        }
      }
      return res.status(200).json({ content });
    }

    // P1 fix (2026-05-18) — abort se cliente fechar conexão durante streaming.
    const abortCtrl = new AbortController();
    const onClose = () => {
      if (!abortCtrl.signal.aborted) {
        console.log('[kai-content-agent] client disconnected — aborting Gemini stream');
        abortCtrl.abort();
      }
    };
    req.on('close', onClose);

    // Streaming (SSE)
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: merged,
          generationConfig: {
            temperature: modelConfig.temperature,
            maxOutputTokens: modelConfig.maxTokens,
          },
        }),
        signal: abortCtrl.signal,
      }
    );
    if (!r.ok || !r.body) {
      if (r.status === 429) return jsonError(res, 429, 'Rate limit excedido. Tente novamente.');
      return jsonError(res, 500, 'Erro ao gerar conteúdo');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let capturedIn = 0;
    let capturedOut = 0;
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const c = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (c) {
              accumulated += c;
              const ev = { choices: [{ delta: { content: c } }] };
              res.write(`data: ${JSON.stringify(ev)}\n\n`);
            }
            if (data.usageMetadata) {
              capturedIn = data.usageMetadata.promptTokenCount ?? capturedIn;
              capturedOut = data.usageMetadata.candidatesTokenCount ?? capturedOut;
            }
          } catch {
            // ignore invalid SSE chunks
          }
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();

    if (userId) {
      await logAIUsage(
        userId,
        modelName,
        'kai-content-agent',
        capturedIn || estimateTokens(fullSystemPrompt),
        capturedOut || estimateTokens(accumulated),
        { client_id: clientId, format: normalizedFormat, platform, streaming: true }
      );
    }
    // Debit tokens (Fase F) — streaming path, after stream ends. Failsoft.
    if (!isInternalCall && resolvedWorkspaceId) {
      try {
        await debitTokens(resolvedWorkspaceId, tokenCost, `kai-content-agent:${normalizedFormat}:stream`);
      } catch (debitErr) {
        console.warn('[kai-content-agent] debit failed (non-blocking):', debitErr);
      }
    }
    req.off('close', onClose);
  } catch (e: any) {
    console.error('Content agent error:', e);
    if (!res.writableEnded) jsonError(res, 500, e?.message || 'Erro desconhecido');
  }
}
