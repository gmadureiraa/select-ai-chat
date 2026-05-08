// SV adapter: o app `viral-sv-original` (cópia literal do Sequência Viral
// standalone) chama `/api/generate` com payload tipado pro SV original.
// Aqui re-mapeamos pro motor real `generate-viral-carousel` do KAI Neon e
// adaptamos a resposta pra shape que o `useGenerate` espera.
//
// SV envia:
//   { topic, sourceType, sourceUrl, niche, tone, language, designTemplate,
//     advanced, mode }
// SV espera receber:
//   { variations: [{ title, style, slides: [{ heading, body, imageQuery, imageUrl }] }],
//     promptUsed?: string }
//
// Estratégia:
//   1. clientId default = primeiro cliente do workspace do user (ou null)
//   2. briefing = topic (concat com niche/tone se vier)
//   3. slideCount = 8 (padrão Sequência Viral)
//   4. Chama generate-viral-carousel (persistAs='both' default)
//   5. Mapeia slides ViralSlide{body,image} → CreateSlide{heading,body,imageQuery,imageUrl}
//   6. Wrap como 1 variation só (SV mostra carousel grid de variations — 1 = OK)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { queryOne } from '../_lib/db.js';

interface SvPayload {
  topic?: string;
  sourceType?: string;
  sourceUrl?: string;
  niche?: string;
  tone?: string;
  language?: string;
  designTemplate?: string;
  advanced?: Record<string, any>;
  mode?: string;
  /** Permite override explícito quando user já selecionou cliente no shell KAI. */
  clientId?: string;
}

interface ViralSlide {
  id: string;
  order: number;
  body: string;
  image:
    | { kind: 'none' }
    | { kind: 'search'; query: string; url: string; attribution?: string };
}

interface SvSlide {
  heading: string;
  body: string;
  imageQuery: string;
  imageUrl?: string;
}

interface SvVariation {
  title: string;
  style: 'data' | 'story' | 'provocative';
  slides: SvSlide[];
}

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https';
  const host = req.headers.host ?? 'localhost:3000';
  return `${proto}://${host}`;
}

function pickStyle(designTemplate?: string): SvVariation['style'] {
  if (!designTemplate) return 'data';
  const t = designTemplate.toLowerCase();
  if (t.includes('twitter') || t.includes('story')) return 'story';
  if (t.includes('manifesto') || t.includes('provoc')) return 'provocative';
  return 'data';
}

function mapSlide(s: ViralSlide): SvSlide {
  // ViralSlide.body é parágrafo único. SV original tem heading + body separados.
  // Estratégia: pega 1ª linha como heading, resto como body.
  const lines = (s.body ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const heading = lines[0] ?? '';
  const body = lines.slice(1).join('\n').trim() || lines[0] || '';
  const imageUrl = s.image && s.image.kind === 'search' ? s.image.url : undefined;
  const imageQuery = s.image && s.image.kind === 'search' ? s.image.query : '';
  return { heading, body, imageQuery, imageUrl };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth
  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  const body = (req.body ?? {}) as SvPayload;
  const topic = (body.topic ?? '').trim();
  if (!topic) return jsonError(res, 400, 'topic is required');

  // Resolver clientId — SV não passa, KAI precisa. Tentamos:
  //   1. body.clientId explícito
  //   2. primeiro client do workspace ativo do user (último editado primeiro)
  let clientId = body.clientId;
  if (!clientId) {
    const row = await queryOne<{ id: string }>(
      `SELECT c.id FROM clients c
         JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
        WHERE wm.user_id = $1
        ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
        LIMIT 1`,
      [auth.user.id],
    ).catch(() => null);
    clientId = row?.id ?? undefined;
  }

  if (!clientId) {
    return jsonError(
      res,
      400,
      'Nenhum cliente associado ao seu workspace. Crie um cliente primeiro pra gerar carrosseis.',
    );
  }

  // Compose briefing — não concatena labels (use-generate.ts já faz isso).
  // Mas se vier niche/tone passamos como contexto extra inline.
  const briefingParts: string[] = [topic];
  if (body.niche) briefingParts.push(`Nicho: ${body.niche}`);
  const briefing = briefingParts.join('\n\n');

  const tone = body.tone ?? body.advanced?.tone ?? undefined;

  try {
    const internalRes = await fetch(`${getOrigin(req)}/api/generate-viral-carousel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization ?? '',
      },
      body: JSON.stringify({
        clientId,
        briefing,
        tone,
        slideCount: 8,
        title: topic.slice(0, 80),
        persistAs: 'both',
        source: 'manual',
      }),
    });

    if (!internalRes.ok) {
      const errText = await internalRes.text().catch(() => '');
      return jsonError(
        res,
        internalRes.status,
        `Geração falhou: ${errText.slice(0, 300)}`,
      );
    }

    const data = (await internalRes.json()) as {
      ok?: boolean;
      slides?: ViralSlide[];
      carouselId?: string;
      planningItemId?: string;
      error?: string;
      promptUsed?: string;
    };

    if (data.error || !data.slides?.length) {
      return jsonError(res, 500, data.error ?? 'Sem slides gerados');
    }

    const variation: SvVariation = {
      title: topic.slice(0, 80),
      style: pickStyle(body.designTemplate),
      slides: data.slides.map(mapSlide),
    };

    return res.status(200).json({
      variations: [variation],
      promptUsed: data.promptUsed,
      // Metadata extra pra SV navegar pro carrossel persistido
      carouselId: data.carouselId ?? null,
      planningItemId: data.planningItemId ?? null,
    });
  } catch (err: any) {
    console.error('[api/generate adapter] error:', err);
    return jsonError(res, 500, err?.message ?? 'Erro inesperado ao gerar.');
  }
}
