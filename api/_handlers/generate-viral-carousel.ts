// Migrated from supabase/functions/generate-viral-carousel/index.ts
// Motor central de geração de carrosséis Twitter-style. Chamado por:
//   - UI manual (Sequência Viral)
//   - Tool createViralCarousel do KAI Chat
//   - process-automations quando content_type === 'viral_carousel'
//
// Diferente do generate-content-v2: sai com slides estruturados (body + image)
// já gravados em viral_carousels e/ou planning_items prontos pra render.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { assertClientAccess } from '../_lib/access.js';
import { isValidCronCall } from '../_lib/cron-auth.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { put } from '@vercel/blob';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';
import {
  getClientContextServer,
  buildClientPromptContext,
  buildClientHistoricalReferences,
  type ClientContext,
} from '../_lib/shared/client-context.js';
import { checkTokens, debitTokens, VIRAL_TOKEN_COSTS } from '../_lib/shared/tokens.js';

const TARGET_SLIDES_DEFAULT = 8;

interface ViralProfile {
  name: string;
  handle: string;
  avatarUrl?: string;
}

interface ViralSlide {
  id: string;
  order: number;
  body: string;
  image:
    | { kind: 'none' }
    | { kind: 'search'; query: string; url: string; attribution?: string };
}

interface RequestBody {
  clientId: string;
  briefing: string;
  tone?: string;
  slideCount?: number;
  profile?: ViralProfile;
  persistAs?: 'planning' | 'carousel' | 'both' | 'none';
  title?: string;
  source?: 'manual' | 'automation' | 'chat';
  automationId?: string;
  /** Optional cover image applied below text on slide 1 (used by RSS news automations). */
  coverImageUrl?: string | null;
  coverImageAttribution?: string | null;
  /** Optional override for owner user_id. Used when called with cron/service auth. */
  userId?: string;
  /**
   * Optional visual template ID — defaults to 'twitter' (mais comum). Caller
   * pode passar qualquer um dos 12 templates suportados (manifesto, futurista,
   * twitter, bohdan, etc — ver `TemplateId` em components/app/templates/types).
   * Quando trocado depois no editor, o auto-save grava no style_meta.visual_template.
   */
  visualTemplate?: string;
}

const VALID_VISUAL_TEMPLATES = new Set([
  'manifesto',
  'futurista',
  'autoral',
  'twitter',
  'ambitious',
  'blank',
  'bohdan',
  'paper-mono',
  'madureira',
  'madureira-reflection',
  'dsec-dark',
  'defiverso-carrossel',
]);

function normalizeVisualTemplate(raw: unknown): string {
  if (typeof raw !== 'string') return 'twitter';
  return VALID_VISUAL_TEMPLATES.has(raw) ? raw : 'twitter';
}

async function buildPrompt(
  briefing: string,
  slideCount: number,
  tone?: string,
  clientContext?: ClientContext | null
): Promise<string> {
  const contextBlock = buildClientPromptContext(clientContext ?? null);
  // Passa o briefing como query pra similarity search puxar referências relevantes.
  const historicalBlock = await buildClientHistoricalReferences(
    clientContext ?? null,
    briefing,
    3
  );
  const prefix = [contextBlock, historicalBlock].filter(Boolean).join('\n\n');
  const corePrompt = buildCorePrompt(briefing, slideCount, tone);
  return prefix ? `${prefix}\n\n---\n\n${corePrompt}` : corePrompt;
}

function buildCorePrompt(briefing: string, slideCount: number, tone?: string): string {
  if (slideCount === 1) {
    return [
      'Você vai gerar UM ÚNICO post estilo tweet visual sobre o tema abaixo.',
      'É um post de notícia pra Instagram (formato 4:5) — vai junto com a imagem da notícia abaixo do texto.',
      '',
      `TEMA/BRIEFING: ${briefing}`,
      tone ? `\nTOM: ${tone}` : '',
      '',
      'REGRAS:',
      '- 1 slide só. Texto até ~260 caracteres no total.',
      '- Estrutura: **manchete forte** (até 80 chars, em negrito) + linha em branco + lead/contexto (1-2 frases curtas explicando a notícia).',
      '- Linguagem informal, direta, em pt-BR. Nada de corporativês.',
      '- Use **negrito** apenas na manchete (e opcionalmente em 1 termo-chave do lead).',
      '- NÃO use hashtags. NÃO use emojis. NÃO numere.',
      '- NÃO comece com "Slide 1:" nem com "Manchete:".',
      '',
      'FORMATO DE SAÍDA: APENAS um array JSON válido com 1 item, sem texto antes nem depois.',
      'Item: { "body": string }',
      '',
      'Exemplo:',
      '[{"body":"**Bitcoin perde US$ 77 mil e liquida US$ 1 bi em alavancagem**\\n\\nQueda foi puxada por venda institucional e quebra do suporte técnico. Mercado segue em alerta."}]',
      '',
      'Agora gera o post pro tema acima.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Você vai gerar um carrossel de ${slideCount} slides estilo tweet sobre o tema abaixo.`,
    'Cada slide é UM tweet completo — texto livre com **palavras em negrito** pra destacar trechos-chave.',
    '',
    `TEMA/BRIEFING: ${briefing}`,
    tone ? `\nTOM: ${tone}` : '',
    '',
    'REGRAS DOS SLIDES:',
    `- ${slideCount} slides no total, cada um com até ~280 caracteres (pode respirar em 2-3 parágrafos curtos).`,
    '- Slide 1 (capa): hook irresistível + promessa. Pode ter uma palavra forte em **negrito**.',
    `- Slides 2-${slideCount - 1}: UM insight por slide. Pense em tweet de thread — direto ao ponto, 1-3 frases. Destaque o termo-chave com **negrito**.`,
    `- Slide ${slideCount} (CTA): chamada clara pra ação (comentar, salvar, compartilhar, seguir).`,
    '- Linguagem informal, direta, em pt-BR. Nada genérico ou corporativo.',
    '- Use **negrito** em 1-3 palavras por slide pra criar hierarquia visual.',
    '- NÃO use hashtags (é carrossel, não post solto).',
    '- NÃO numere os slides no texto — a numeração é automática.',
    '- NÃO comece com "Slide X:" nem títulos separados — o texto é um bloco só.',
    '',
    'FORMATO DE SAÍDA: APENAS um array JSON válido, sem texto antes nem depois.',
    'Cada item: { "body": string }   ← apenas o campo body, sem heading.',
    '',
    'Exemplo:',
    '[{"body":"Ninguém te conta isso sobre **self-custody**, mas aqui vai: você não é o dono do seu Bitcoin até ter as chaves."},{"body":"**Erro 1:** manter na exchange esperando \\"ficar mais fácil\\". Exchange quebra, seu Bitcoin vai junto."}]',
    '',
    `Agora gera os ${slideCount} slides pro tema acima.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function emptySlide(order: number): ViralSlide {
  return {
    id: `slide_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
    order,
    body: '',
    image: { kind: 'none' },
  };
}

function normalizeSlides(raw: unknown[], target: number): ViralSlide[] {
  const slides: ViralSlide[] = [];
  for (let i = 0; i < raw.length && i < target; i++) {
    const item = raw[i] as {
      body?: string;
      text?: string;
      content?: string;
      heading?: string;
      title?: string;
    };
    const body = item.body ?? item.text ?? item.content ?? '';
    const heading = item.heading ?? item.title;
    let finalBody = typeof body === 'string' ? body.trim() : '';
    if (
      typeof heading === 'string' &&
      heading.trim() &&
      finalBody &&
      !finalBody.startsWith('**')
    ) {
      finalBody = `**${heading.trim()}**\n\n${finalBody}`;
    } else if (typeof heading === 'string' && heading.trim() && !finalBody) {
      finalBody = `**${heading.trim()}**`;
    }
    slides.push({ ...emptySlide(i + 1), body: finalBody });
  }
  while (slides.length < target) slides.push(emptySlide(slides.length + 1));
  return slides;
}

/**
 * Calls Gemini 2.5 Flash with retry on 5xx/timeout. Returns raw text reply.
 */
async function callGemini(prompt: string, apiKey: string): Promise<{ text: string; inTok: number; outTok: number; model: string }> {
  const RETRIES = [0, 2000, 5000];
  const model = 'gemini-2.5-flash';
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < RETRIES.length; attempt++) {
    if (RETRIES[attempt] > 0) {
      console.log(
        `[generate-viral-carousel] retry ${attempt} in ${RETRIES[attempt]}ms`
      );
      await new Promise((r) => setTimeout(r, RETRIES[attempt]));
    }

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
          }),
          signal: ctrl.signal,
        }
      );
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (res.status >= 500 && attempt < RETRIES.length - 1) {
          lastErr = new Error(`gemini ${res.status}: ${errText.slice(0, 200)}`);
          console.warn(
            `[generate-viral-carousel] attempt ${attempt + 1} failed: ${lastErr.message}`
          );
          continue;
        }
        throw new Error(`gemini ${res.status}: ${errText.slice(0, 300)}`);
      }

      const json = await res.json().catch(() => ({} as any));
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        if (attempt < RETRIES.length - 1) {
          lastErr = new Error('gemini retornou conteúdo vazio');
          continue;
        }
        throw lastErr ?? new Error('gemini retornou conteúdo vazio');
      }
      const inTok = json?.usageMetadata?.promptTokenCount ?? estimateTokens(prompt);
      const outTok = json?.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);
      return { text, inTok, outTok, model };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRIES.length - 1) {
        console.warn(
          `[generate-viral-carousel] attempt ${attempt + 1} threw:`,
          lastErr.message
        );
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr ?? new Error('gemini falhou em todas as tentativas');
}

/**
 * Caches the cover image into Vercel Blob so the Storage URL won't expire.
 * Falls back to original URL on any failure.
 */
async function cacheCoverImage(sourceUrl: string, clientId: string): Promise<string> {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return sourceUrl;
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return sourceUrl;
    const path = `viral-covers/${clientId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const blob = await put(path, buf, {
      access: 'public',
      contentType: ct,
      addRandomSuffix: false,
    });
    return blob.url;
  } catch (err) {
    console.warn('[generate-viral-carousel] cover cache failed:', err);
    return sourceUrl;
  }
}

async function resolveDraftColumnId(workspaceId: string): Promise<string | null> {
  const preferred = await query<{ id: string }>(
    `SELECT id
       FROM kanban_columns
      WHERE workspace_id = $1
        AND column_type IN ('draft', 'idea')
      ORDER BY position ASC
      LIMIT 1`,
    [workspaceId]
  );
  if (preferred[0]) return preferred[0].id;
  const first = await query<{ id: string }>(
    `SELECT id FROM kanban_columns WHERE workspace_id = $1 ORDER BY position ASC LIMIT 1`,
    [workspaceId]
  );
  return first[0]?.id ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  try {
    const apiKey =
      process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return jsonError(res, 500, 'GOOGLE_AI_STUDIO_API_KEY não configurada');

    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body)
        : {};
    const requestBody = body as RequestBody;
    const {
      clientId,
      briefing,
      tone,
      slideCount = TARGET_SLIDES_DEFAULT,
      profile,
      persistAs = 'carousel',
      title,
      source = 'manual',
      automationId,
      coverImageUrl,
      coverImageAttribution,
      userId: providedUserId,
      visualTemplate: requestedVisualTemplate,
    } = requestBody;
    const visualTemplate = normalizeVisualTemplate(requestedVisualTemplate);

    if (!clientId || !briefing) {
      return jsonError(res, 400, 'clientId e briefing são obrigatórios');
    }

    // Auth: cron (Bearer CRON_SECRET) OR authed user OR explicit userId override (internal calls).
    // Header `x-vercel-cron` standalone NÃO é confiável.
    const isCron = isValidCronCall(req);
    const isInternalCall = req.headers['x-internal-call'] === 'true';

    let userId: string | null = providedUserId ?? null;
    let authedUserId: string | null = null;
    if (!userId && !isCron && !isInternalCall) {
      const user = await tryAuth(req);
      if (!user) return jsonError(res, 401, 'Authentication required');
      userId = user.id;
      authedUserId = user.id;
    } else if (!userId) {
      // Try optional auth even on internal calls
      const user = await tryAuth(req);
      if (user) {
        userId = user.id;
        authedUserId = user.id;
      }
    } else {
      // userId foi informado explicitamente — checar se há header de auth real
      const user = await tryAuth(req);
      if (user) authedUserId = user.id;
    }
    // Se há um user real autenticado, garantir que ele tem acesso ao client.
    if (authedUserId && clientId) {
      await assertClientAccess(authedUserId, clientId);
    }

    // Resolve client + workspace
    const client = await queryOne<any>(
      `SELECT id, name, workspace_id, avatar_url, social_media
         FROM clients
        WHERE id = $1`,
      [clientId]
    );
    if (!client) return jsonError(res, 404, 'Cliente não encontrado');

    // Fallback userId: workspace owner
    if (!userId && client.workspace_id) {
      const owner = await queryOne<any>(
        `SELECT owner_id FROM workspaces WHERE id = $1`,
        [client.workspace_id]
      );
      userId = owner?.owner_id ?? null;
    }

    if (!userId) {
      return jsonError(res, 401, 'Sem user_id pra persistir');
    }

    // Token check (Fase F — 2026-05-08).
    // Cron/internal calls não pagam tokens (system-level). Usuários autenticados sim.
    const tokenCost = VIRAL_TOKEN_COSTS.carousel;
    const skipTokenCheck = isCron || isInternalCall;
    if (!skipTokenCheck && client.workspace_id) {
      const status = await checkTokens(client.workspace_id as string, tokenCost);
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

    // Load client context (multi-tenant prompt enrichment).
    // Fail-soft: empty context just means a generic prompt — keeps backward compat.
    let clientContext: ClientContext | null = null;
    try {
      clientContext = await getClientContextServer(clientId);
    } catch (ctxErr) {
      console.warn('[generate-viral-carousel] context load failed (proceeding without):', ctxErr);
    }

    // Resolve effective tone: explicit body > client_preferences.tone
    const effectiveTone = tone ?? clientContext?.tone ?? undefined;

    // Generate slides via Gemini
    const prompt = await buildPrompt(briefing, slideCount, effectiveTone, clientContext);
    const { text: rawText, inTok, outTok, model } = await callGemini(prompt, apiKey);

    const arr = extractJsonArray(rawText);
    if (!arr) {
      return res.status(502).json({
        ok: false,
        error: 'Não consegui extrair JSON do Gemini',
        raw: rawText.slice(0, 500),
      });
    }
    const slides = normalizeSlides(arr, slideCount);

    // Debit tokens (Fase F) — AFTER gemini success, BEFORE persist.
    // Failsoft: log mas não bloqueia se debit falhar (job já gerou conteúdo válido).
    if (!skipTokenCheck && client.workspace_id) {
      try {
        await debitTokens(
          client.workspace_id as string,
          tokenCost,
          `generate-viral-carousel:${source}`
        );
      } catch (debitErr) {
        console.warn('[generate-viral-carousel] debit failed (non-blocking):', debitErr);
      }
    }

    // Apply cover image to slide 1 when provided
    if (slides.length > 0 && coverImageUrl) {
      const cachedUrl = await cacheCoverImage(coverImageUrl, clientId);
      slides[0] = {
        ...slides[0],
        image: {
          kind: 'search',
          query: title ?? briefing.slice(0, 60),
          url: cachedUrl,
          attribution: coverImageAttribution ?? undefined,
        },
      };
    }

    // Resolve final profile
    const socialMedia = (client.social_media as Record<string, unknown> | null) ?? null;
    const igHandle =
      typeof socialMedia?.instagram_handle === 'string'
        ? (socialMedia.instagram_handle as string)
        : undefined;
    const fallbackHandle = (client.name as string).toLowerCase().replace(/\s+/g, '');
    const finalProfile: ViralProfile = profile ?? {
      name: client.name as string,
      handle: `@${igHandle?.replace(/^@/, '') || fallbackHandle}`,
      avatarUrl: (client.avatar_url as string) ?? undefined,
    };
    const finalTitle = title ?? briefing.slice(0, 60);

    // Persist
    let carouselId: string | undefined;
    let planningItemId: string | undefined;
    const pool = getPool();

    if (persistAs === 'planning' || persistAs === 'both') {
      const columnId = await resolveDraftColumnId(client.workspace_id as string);
      const metadata = {
        source:
          source === 'automation'
            ? 'automation:viral_carousel'
            : `kai:${source}:viral_carousel`,
        content_type: 'viral_carousel',
        viral_carousel_briefing: briefing,
        viral_carousel_tone: tone ?? null,
        viral_carousel_slides: slides,
        automation_id: automationId ?? null,
      };
      const planRes = await pool.query<{ id: string }>(
        `INSERT INTO planning_items
          (workspace_id, client_id, column_id, title, content, platform, content_type,
           status, created_by, metadata)
         VALUES ($1, $2, $3, $4, $5, 'instagram', 'viral_carousel', 'draft', $6, $7::jsonb)
         RETURNING id`,
        [
          client.workspace_id,
          clientId,
          columnId,
          finalTitle,
          slides.map((s, i) => `=== Slide ${i + 1} ===\n${s.body}`).join('\n\n'),
          userId,
          JSON.stringify(metadata),
        ]
      );
      planningItemId = planRes.rows[0]?.id;
    }

    if (persistAs === 'carousel' || persistAs === 'both') {
      // `template` na tabela viral_carousels é o "design_template" (estratégia
       //   de conteúdo) — mantemos 'manifesto' (default narrativo). O visual
       //   real do render é gravado em `style_meta.visual_template` pra que o
       //   editor leia corretamente quando user abrir o carrossel.
       // Migration 0038: view `carousels` faz merge `template` + `style_meta`
       //   no campo `style`, então frontend recebe os dois corretamente.
      const styleMeta = {
        slideStyle: 'white',
        visual_template: visualTemplate,
      };
      const carRes = await pool.query<{ id: string }>(
        `INSERT INTO viral_carousels
          (client_id, workspace_id, user_id, title, briefing, tone, template,
           profile, slides, status, source, planning_item_id, style_meta)
         VALUES ($1, $2, $3, $4, $5, $6, 'manifesto', $7::jsonb, $8::jsonb, 'draft', $9, $10, $11::jsonb)
         RETURNING id`,
        [
          clientId,
          client.workspace_id,
          userId,
          finalTitle,
          briefing,
          tone ?? null,
          JSON.stringify(finalProfile),
          JSON.stringify(slides),
          source,
          planningItemId ?? null,
          JSON.stringify(styleMeta),
        ]
      );
      carouselId = carRes.rows[0]?.id;

      // Link the planning_item back to the carousel
      if (planningItemId && carouselId) {
        const linkedMetadata = {
          source:
            source === 'automation'
              ? 'automation:viral_carousel'
              : `kai:${source}:viral_carousel`,
          content_type: 'viral_carousel',
          viral_carousel_id: carouselId,
          viral_carousel_briefing: briefing,
          viral_carousel_tone: tone ?? null,
          viral_carousel_slides: slides,
          automation_id: automationId ?? null,
        };
        await pool.query(
          `UPDATE planning_items SET metadata = $1::jsonb WHERE id = $2`,
          [JSON.stringify(linkedMetadata), planningItemId]
        );
      }
    }

    // Log AI usage
    if (userId) {
      await logAIUsage(userId, model, 'generate-viral-carousel', inTok, outTok, {
        client_id: clientId,
        slide_count: slideCount,
        source,
        persist_as: persistAs,
      });
    }

    return res.status(200).json({
      ok: true,
      slides,
      carouselId: carouselId ?? null,
      planningItemId: planningItemId ?? null,
      profile: finalProfile,
      title: finalTitle,
    });
  } catch (err: any) {
    console.error('[generate-viral-carousel] fatal:', err);
    return jsonError(res, 500, err?.message || String(err));
  }
}
