// Adapter SV: /api/generate/caption (resolvido pelo router → generate-caption)
// Gera legenda + hashtags pra carrossel pronto.
//
// Input  (CaptionGenerateInput, ver use-caption.ts):
//   { slides: [{ heading, body }], title, niche?, tone?, language? }
// Output (esperado pelo useCaption.generate):
//   { caption: string, hashtags: string[] }
//
// Não persiste — a página `preview.tsx` usa só pra preencher o textarea.
// O usuário pode editar antes de copiar.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { callLLM } from '../_lib/llm.js';

interface CaptionSlideInput {
  heading?: string;
  body?: string;
}

interface CaptionPayload {
  slides?: CaptionSlideInput[];
  title?: string;
  niche?: string;
  tone?: string;
  language?: string;
}

const SYSTEM_PROMPT = `Você é um copywriter sênior brasileiro especializado em legendas
de carrossel de Instagram/LinkedIn pra criadores de conteúdo.

Escreva UMA legenda (6-10 linhas, parágrafos curtos) com:
- Hook na primeira linha que repita ou ecoe o gancho do carrossel
- Tese central condensada (1-2 frases)
- Linha de ressonância pessoal ("se você...")
- CTA suave no final ("salva pra revisitar", "compartilha com quem precisa", etc)

REGRAS:
- PT-BR informal, frases curtas, energia de quem sabe.
- SEM hashtag dentro da legenda (vão num campo separado).
- SEM emoji decorativo, só funcional se fizer sentido (raríssimo).
- 600-1000 chars. Nunca mais de 2200 (limite IG).

Depois, devolva 5-8 hashtags TOPIC-driven (não genéricas tipo #motivation).
Hashtags em PT-BR salvo se o tema for técnico/internacional.

Devolva APENAS JSON válido nesse shape (sem markdown):
{
  "caption": "...",
  "hashtags": ["#tag1", "#tag2", ...]
}`;

function buildUserPrompt(p: CaptionPayload): string {
  const lines: string[] = [];
  lines.push(`TÍTULO DO CARROSSEL: ${p.title ?? '(sem título)'}`);
  if (p.niche) lines.push(`NICHO: ${p.niche}`);
  if (p.tone) lines.push(`TOM: ${p.tone}`);
  if (p.language) lines.push(`IDIOMA: ${p.language}`);
  lines.push('');
  lines.push('SLIDES (heading + body):');
  const slides = Array.isArray(p.slides) ? p.slides : [];
  slides.slice(0, 16).forEach((s, i) => {
    const h = (s.heading ?? '').trim();
    const b = (s.body ?? '').trim();
    lines.push(`Slide ${i + 1}: ${h}${b ? `\n  ${b}` : ''}`);
  });
  lines.push('');
  lines.push('Gere a legenda + hashtags. APENAS JSON.');
  return lines.join('\n');
}

function tryParseCaption(raw: string): { caption: string; hashtags: string[] } | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  const caption = typeof parsed?.caption === 'string' ? parsed.caption.trim() : '';
  if (!caption) return null;
  const hashtags = Array.isArray(parsed?.hashtags)
    ? parsed.hashtags
        .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t: string) => t.length > 0)
        .map((t: string) => (t.startsWith('#') ? t : `#${t}`))
    : [];
  return { caption, hashtags };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  const body = (req.body ?? {}) as CaptionPayload;
  const slides = Array.isArray(body.slides) ? body.slides : [];
  if (slides.length === 0) return jsonError(res, 400, 'slides is required');

  try {
    const result = await callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(body) },
      ],
      {
        provider: 'auto',
        model: 'gemini-2.5-flash',
        temperature: 0.75,
        maxTokens: 1500,
        usageContext: {
          userId: auth.id,
          edgeFunction: 'generate-caption',
          metadata: { slides: slides.length },
        },
      },
    );

    const parsed = tryParseCaption(result.content);
    if (!parsed) {
      console.warn('[generate-caption] parse failed', {
        rawSample: result.content.slice(0, 300),
      });
      return jsonError(
        res,
        502,
        'IA não devolveu legenda válida. Tente novamente.',
      );
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    console.error('[generate-caption] error:', err?.message || err);
    return jsonError(
      res,
      500,
      err?.message
        ? `Falha ao gerar legenda: ${err.message}`
        : 'Erro inesperado ao gerar legenda.',
    );
  }
}
