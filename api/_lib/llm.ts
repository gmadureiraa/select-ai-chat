// Minimal Node port of supabase/functions/_shared/llm.ts
// Supports Gemini + OpenAI with retry/fallback. Logs to ai_usage_logs via Neon if context provided.
import { getPool } from './db.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMUsageContext {
  userId: string;
  edgeFunction: string;
  clientId?: string;
  metadata?: Record<string, any>;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  provider?: 'google' | 'openai' | 'auto';
  model?: string;
  maxRetries?: number;
  usageContext?: LLMUsageContext;
}

export interface LLMResult {
  content: string;
  tokens: number;
  provider: 'google' | 'openai';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class LLMError extends Error {
  constructor(message: string, public isRetryable = false, public retryAfter?: number) {
    super(message);
    this.name = 'LLMError';
  }
}

const RETRYABLE = [429, 500, 502, 503, 504];
const DELAYS = [1000, 2000, 4000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function googleKey() {
  return process.env.GOOGLE_AI_STUDIO_API_KEY;
}
function openaiKey() {
  return process.env.OPENAI_API_KEY;
}

/**
 * True if at least one LLM provider is configured via env.
 */
export function isLLMConfigured(): boolean {
  return !!(googleKey() || openaiKey());
}

async function logUsageSafe(
  ctx: LLMUsageContext | undefined,
  model: string,
  inputTokens: number,
  outputTokens: number,
  extra: Record<string, any> = {}
) {
  if (!ctx) return;
  try {
    const pool = getPool();
    const meta = { ...(ctx.metadata || {}), ...extra, ...(ctx.clientId ? { client_id: ctx.clientId } : {}) };
    await pool.query(
      `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      [ctx.userId, model, ctx.edgeFunction, inputTokens, outputTokens, JSON.stringify(meta)]
    );
  } catch (e) {
    console.warn('[LLM] usage log failed (non-fatal):', e);
  }
}

async function callGemini(messages: LLMMessage[], opts: LLMOptions): Promise<LLMResult> {
  const apiKey = googleKey();
  if (!apiKey) throw new LLMError('GOOGLE_AI_STUDIO_API_KEY missing');
  const model = (opts.model || 'gemini-2.5-flash').replace('google/', '');
  const maxRetries = opts.maxRetries ?? 3;

  const contents: any[] = [];
  let systemInstruction = '';
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
  const body: any = {
    contents,
    generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens ?? 8192 },
  };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!r.ok) {
        const t = await r.text();
        console.error(`[LLM] Gemini error (attempt ${attempt + 1}):`, r.status, t);
        if (RETRYABLE.includes(r.status) && attempt < maxRetries) {
          await sleep(DELAYS[attempt] || 4000);
          continue;
        }
        throw new LLMError(`Gemini API error: ${r.status}`, RETRYABLE.includes(r.status), r.status === 429 ? 60 : undefined);
      }
      const data = await r.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const inputTokens = data?.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data?.usageMetadata?.candidatesTokenCount || 0;
      await logUsageSafe(opts.usageContext, model, inputTokens, outputTokens);
      return { content, tokens: inputTokens + outputTokens, provider: 'google', model, inputTokens, outputTokens };
    } catch (e) {
      lastErr = e as Error;
      if (e instanceof LLMError) throw e;
      if (attempt < maxRetries) {
        await sleep(DELAYS[attempt] || 4000);
        continue;
      }
    }
  }
  throw lastErr || new LLMError('Gemini call failed');
}

async function callOpenAI(messages: LLMMessage[], opts: LLMOptions): Promise<LLMResult> {
  const apiKey = openaiKey();
  if (!apiKey) throw new LLMError('OPENAI_API_KEY missing');
  const model = (opts.model || 'gpt-4o').replace('openai/', '');
  const maxRetries = opts.maxRetries ?? 3;

  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: opts.maxTokens ?? 8192,
    temperature: opts.temperature ?? 0.7,
  };
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error(`[LLM] OpenAI error (attempt ${attempt + 1}):`, r.status, t);
        if (RETRYABLE.includes(r.status) && attempt < maxRetries) {
          await sleep(DELAYS[attempt] || 4000);
          continue;
        }
        throw new LLMError(`OpenAI API error: ${r.status}`, RETRYABLE.includes(r.status), r.status === 429 ? 60 : undefined);
      }
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const inputTokens = data?.usage?.prompt_tokens || 0;
      const outputTokens = data?.usage?.completion_tokens || 0;
      await logUsageSafe(opts.usageContext, model, inputTokens, outputTokens);
      return { content, tokens: inputTokens + outputTokens, provider: 'openai', model, inputTokens, outputTokens };
    } catch (e) {
      lastErr = e as Error;
      if (e instanceof LLMError) throw e;
      if (attempt < maxRetries) {
        await sleep(DELAYS[attempt] || 4000);
        continue;
      }
    }
  }
  throw lastErr || new LLMError('OpenAI call failed');
}

export async function callLLM(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResult> {
  const primary =
    options.provider === 'auto' || !options.provider
      ? googleKey()
        ? 'google'
        : openaiKey()
        ? 'openai'
        : null
      : options.provider;
  if (!primary) throw new LLMError('No LLM provider configured', false);
  try {
    return primary === 'google' ? await callGemini(messages, options) : await callOpenAI(messages, options);
  } catch (err) {
    const fallback = primary === 'google' ? (openaiKey() ? 'openai' : null) : googleKey() ? 'google' : null;
    if (fallback) {
      try {
        return fallback === 'google' ? await callGemini(messages, options) : await callOpenAI(messages, options);
      } catch (e2) {
        throw new LLMError('LLM service unavailable (both providers failed)', true, 60);
      }
    }
    if (err instanceof LLMError) throw err;
    throw new LLMError('LLM service unavailable', true, 60);
  }
}

// ─── STREAMING ──────────────────────────────────────────────────────────
// Helper pra handlers SSE (kai-metrics-agent, kai-planning-agent) que
// streamam tokens diretamente pro response. Sem fallback automático: se o
// provider escolhido falhar, lança LLMError e o handler decide o que fazer
// (já que metade da resposta pode ter ido pro cliente).

/**
 * Streama deltas de texto do LLM como SSE no formato OpenAI-compat:
 *   data: {"choices":[{"delta":{"content":"..."}}]}\n\n
 *   data: [DONE]\n\n
 *
 * Por que esse formato? Os handlers anteriores (kai-metrics-agent / kai-planning-agent)
 * faziam proxy do Lovable Gateway que já entregava SSE OpenAI-compat. Frontend
 * consumia esse contrato. Mantemos a forma pra evitar mexer no frontend.
 *
 * Implementação: usa Gemini streamGenerateContent quando provider=google (default),
 * converte cada chunk de Gemini pro shape OpenAI-compat, escreve no res.
 */
export async function streamLLMToSse(
  res: any,
  messages: LLMMessage[],
  options: LLMOptions = {},
): Promise<{ tokens: number; provider: 'google' | 'openai'; model: string }> {
  const primary =
    options.provider === 'auto' || !options.provider
      ? googleKey()
        ? 'google'
        : openaiKey()
        ? 'openai'
        : null
      : options.provider;
  if (!primary) throw new LLMError('No LLM provider configured', false);

  // Set SSE headers (idempotent — handler pode ter setado antes)
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  }

  if (primary === 'google') {
    return await streamGeminiToSse(res, messages, options);
  }
  return await streamOpenAIToSse(res, messages, options);
}

async function streamGeminiToSse(
  res: any,
  messages: LLMMessage[],
  opts: LLMOptions,
): Promise<{ tokens: number; provider: 'google'; model: string }> {
  const apiKey = googleKey();
  if (!apiKey) throw new LLMError('GOOGLE_AI_STUDIO_API_KEY missing');
  const model = (opts.model || 'gemini-2.5-flash').replace('google/', '');

  const contents: any[] = [];
  let systemInstruction = '';
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
  const body: any = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 8192,
      // thinkingBudget: 0 — KAI default pra Gemini 2.5 (mais rápido, sem CoT).
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => '');
    throw new LLMError(`Gemini stream error ${r.status}: ${t.slice(0, 200)}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Gemini SSE delivers `data: {json}\n\n` chunks
    let nlIdx;
    while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 2);
      if (!event.startsWith('data: ')) continue;
      const payload = event.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json: any = JSON.parse(payload);
        const delta: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (delta) {
          const openaiChunk = JSON.stringify({
            choices: [{ delta: { content: delta }, index: 0 }],
          });
          res.write(`data: ${openaiChunk}\n\n`);
        }
        // Capture usage from final chunk
        if (json?.usageMetadata) {
          inputTokens = json.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = json.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
      } catch (e) {
        console.warn('[streamLLM] gemini chunk parse failed:', payload.slice(0, 100));
      }
    }
  }

  // Send [DONE] sentinel
  res.write('data: [DONE]\n\n');

  totalTokens = inputTokens + outputTokens;
  await logUsageSafe(opts.usageContext, model, inputTokens, outputTokens);

  return { tokens: totalTokens, provider: 'google', model };
}

async function streamOpenAIToSse(
  res: any,
  messages: LLMMessage[],
  opts: LLMOptions,
): Promise<{ tokens: number; provider: 'openai'; model: string }> {
  const apiKey = openaiKey();
  if (!apiKey) throw new LLMError('OPENAI_API_KEY missing');
  const model = (opts.model || 'gpt-4o-mini').replace('openai/', '');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: opts.maxTokens ?? 8192,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
  });
  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => '');
    throw new LLMError(`OpenAI stream error ${r.status}: ${t.slice(0, 200)}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // OpenAI já manda no shape correto — só repassamos.
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIdx;
    while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 2);
      res.write(`${event}\n\n`);
    }
  }
  if (buffer) res.write(buffer);

  // OpenAI não dá usage no stream sem flag explícita — estimamos zero.
  await logUsageSafe(opts.usageContext, model, 0, 0);
  return { tokens: 0, provider: 'openai', model };
}
