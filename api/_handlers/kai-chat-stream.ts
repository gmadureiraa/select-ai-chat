// Generic chat (with optional SSE streaming) for KAI assistant utilities.
// New handler — no Supabase original. Used for ad-hoc LLM calls from the frontend
// (e.g., keyword extraction, summarization). Does NOT load client context.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';
import { assertClientAccess } from '../_lib/access.js';

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

interface ChatRequest {
  messages: ChatMessage[];
  mode?: 'general' | 'content' | string;
  stream?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  clientId?: string | null;
}

function normalizeModel(input?: string): string {
  if (!input) return 'gemini-2.5-flash';
  return input.replace(/^google\//, '').replace(/^openai\//, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  try {
    const body = req.body && typeof req.body === 'object'
      ? req.body
      : (req.body ? JSON.parse(req.body) : {});
    const { messages, stream = false, model, temperature, maxTokens, clientId } = body as ChatRequest;

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError(res, 400, 'messages é obrigatório');
    }

    const user = await tryAuth(req);
    const userId = user?.id ?? null;
    if (user && clientId) await assertClientAccess(user.id, clientId);
    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!apiKey) return jsonError(res, 500, 'Chave da API do Google AI não configurada');

    const modelName = normalizeModel(model);
    const temp = typeof temperature === 'number' ? temperature : 0.7;
    const maxOut = typeof maxTokens === 'number' ? maxTokens : 4096;

    // Convert to Gemini format (system → user prefix), merge consecutive
    let systemInstruction = '';
    const contents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemInstruction += (systemInstruction ? '\n\n' : '') + m.content;
        continue;
      }
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (contents.length && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + m.content;
      } else {
        contents.push({ role, parts: [{ text: m.content }] });
      }
    }

    const reqBody: any = {
      contents,
      generationConfig: { temperature: temp, maxOutputTokens: maxOut },
    };
    if (systemInstruction) reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };

    if (!stream) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) }
      );
      if (!r.ok) {
        if (r.status === 429) return jsonError(res, 429, 'Rate limit excedido. Tente novamente.');
        const t = await r.text();
        console.error('[kai-chat-stream] Gemini error:', t);
        return jsonError(res, 500, 'Erro ao gerar resposta');
      }
      const result = await r.json();
      const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const inTok = result?.usageMetadata?.promptTokenCount
        ?? estimateTokens(systemInstruction + messages.map((m) => m.content).join('\n'));
      const outTok = result?.usageMetadata?.candidatesTokenCount ?? estimateTokens(content);
      if (userId) {
        await logAIUsage(userId, modelName, 'kai-chat-stream', inTok, outTok, {
          client_id: clientId || null, streaming: false,
        });
      }
      return res.status(200).json({ content, message: content });
    }

    // Streaming SSE
    // P1 fix (2026-05-18) — abort se cliente desconectar mid-stream.
    const abortCtrl = new AbortController();
    const onClose = () => {
      if (!abortCtrl.signal.aborted) abortCtrl.abort();
    };
    req.on('close', onClose);

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: abortCtrl.signal,
      }
    );
    if (!r.ok || !r.body) {
      if (r.status === 429) return jsonError(res, 429, 'Rate limit excedido. Tente novamente.');
      return jsonError(res, 500, 'Erro ao gerar resposta');
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
            // skip
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
        'kai-chat-stream',
        capturedIn || estimateTokens(systemInstruction + messages.map((m) => m.content).join('\n')),
        capturedOut || estimateTokens(accumulated),
        { client_id: clientId || null, streaming: true }
      );
    }
    req.off('close', onClose);
  } catch (e: any) {
    console.error('[kai-chat-stream] error:', e);
    if (!res.writableEnded) jsonError(res, 500, e?.message || 'Erro desconhecido');
  }
}
