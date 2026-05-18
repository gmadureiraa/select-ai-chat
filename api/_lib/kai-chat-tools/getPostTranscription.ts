/**
 * Tool `getPostTranscription` — busca (ou gera, se não existir) transcrição
 * detalhada de um post do cliente. Usar quando o usuário mencionar um post
 * específico (link, ID, "o último carrossel", "o reel da semana passada")
 * pra trazer caption + descrição visual + cenas/slides como contexto.
 *
 * Args:
 *   - postId: id do post (post_id da tabela instagram_posts ou external_post_id)
 *   - source: 'metricool' | 'instagram_posts' | 'planning' (default 'instagram_posts')
 *   - network: 'instagram' | 'facebook' | ... (default 'instagram')
 *   - generate: boolean — se true e não existir, gera nova transcrição (default false)
 *
 * Retorna a transcrição completa pra o LLM consumir como contexto.
 */
import type { RegisteredTool } from './types.js';
import { query, queryOne } from '../db.js';
import { assertToolClientAccess, isToolAccessFail } from './tool-access.js';

interface GetPostTranscriptionArgs {
  postId?: string;
  source?: string;
  network?: string;
  generate?: boolean;
}

interface PostTranscriptionData {
  found: boolean;
  postId: string;
  source: string;
  network: string;
  postType: string | null;
  caption: string | null;
  fullSummary: string | null;
  visualDescription: string | null;
  carouselSlides: Array<{ index: number; description: string }> | null;
  reelAudioTranscript: string | null;
  reelScenes: Array<{ start_sec: number; end_sec: number; description: string }> | null;
  storyDescription: string | null;
  updatedAt: string | null;
  generated: boolean;
}

export const getPostTranscriptionTool: RegisteredTool<
  GetPostTranscriptionArgs,
  PostTranscriptionData
> = {
  definition: {
    name: 'getPostTranscription',
    description:
      'Busca a transcrição detalhada (caption + descrição visual + slides de carrossel + cenas de reel + áudio) de um post específico do cliente. Use quando o usuário mencionar um post, link, ID, "último carrossel", "reel da semana", etc, pra trazer contexto visual ao chat. Se não houver transcrição cacheada e generate=true, gera na hora.',
    parameters: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description:
            'ID do post (post_id de instagram_posts, ou external_post_id de planning_items, ou metricool_post_id).',
        },
        source: {
          type: 'string',
          description:
            "Origem do post. Default: 'instagram_posts'.",
          enum: ['metricool', 'instagram_posts', 'planning'],
        },
        network: {
          type: 'string',
          description: "Rede social do post. Default: 'instagram'.",
          enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'],
        },
        generate: {
          type: 'boolean',
          description:
            'Se true e a transcrição ainda não existe, dispara o pipeline de geração (Gemini Vision). Default false (apenas leitura).',
        },
      },
      required: ['postId'],
    },
  },

  handler: async (args, ctx) => {
    const postId = String(args.postId || '').trim();
    const source = (args.source || 'instagram_posts') as string;
    const network = (args.network || 'instagram') as string;
    const generate = !!args.generate;

    if (!postId) {
      return { ok: false, error: 'postId é obrigatório' };
    }

    // SECURITY: validar acesso ao cliente do contexto. Em service mode
    // attacker poderia setar clientId arbitrário pra ler transcrições alheias
    // ou disparar geração custosa (Gemini Vision).
    if (!ctx.clientId) {
      return { ok: false, error: 'Cliente atual obrigatório.' };
    }
    const guard = await assertToolClientAccess(ctx, ctx.clientId);
    if (isToolAccessFail(guard)) return { ok: false, error: guard.error };

    console.log(
      `[getPostTranscription] clientId=${ctx.clientId} postId=${postId} source=${source} generate=${generate}`,
    );

    try {
      // 1. Tenta buscar transcrição cacheada
      const existing = await queryOne<any>(
        `SELECT * FROM client_post_transcriptions
           WHERE client_id = $1 AND post_id = $2 AND source = $3
           LIMIT 1`,
        [ctx.clientId, postId, source],
      );

      if (existing) {
        return {
          ok: true,
          data: shape(existing, false),
        };
      }

      // 2. Se não generate, retorna found=false
      if (!generate) {
        return {
          ok: true,
          data: {
            found: false,
            postId,
            source,
            network,
            postType: null,
            caption: null,
            fullSummary: null,
            visualDescription: null,
            carouselSlides: null,
            reelAudioTranscript: null,
            reelScenes: null,
            storyDescription: null,
            updatedAt: null,
            generated: false,
          } satisfies PostTranscriptionData,
        };
      }

      // 3. Generate=true: tenta resolver imageUrls/videoUrl da tabela instagram_posts
      let imageUrls: string[] = [];
      let videoUrl: string | undefined;
      let caption = '';
      let postType: string | undefined;

      const ipRow = await queryOne<any>(
        `SELECT post_id, post_type, caption, images, thumbnail_url, metadata
           FROM instagram_posts WHERE client_id = $1 AND post_id = $2 LIMIT 1`,
        [ctx.clientId, postId],
      );
      if (ipRow) {
        if (Array.isArray(ipRow.images)) {
          imageUrls = ipRow.images.filter((u: any) => typeof u === 'string');
        }
        if (imageUrls.length === 0 && ipRow.thumbnail_url) {
          imageUrls = [ipRow.thumbnail_url];
        }
        if (ipRow.metadata && typeof ipRow.metadata === 'object') {
          videoUrl = ipRow.metadata.video_url || ipRow.metadata.videoUrl;
        }
        caption = ipRow.caption || '';
        postType = ipRow.post_type || undefined;
      }

      // 4. Chama /api/transcribe-post via fetch interno
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (ctx.isInternalCall) {
        headers['x-internal-call'] = 'true';
        if (process.env.CRON_SECRET) {
          headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;
        }
      } else if (ctx.accessToken) {
        headers['Authorization'] = `Bearer ${ctx.accessToken}`;
      }

      const r = await fetch(`${ctx.internalBaseUrl}/api/transcribe-post`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientId: ctx.clientId,
          postId,
          source,
          network,
          postType,
          imageUrls,
          videoUrl,
          caption,
          force: false,
        }),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        return {
          ok: false,
          error: `Falha ao gerar transcrição (HTTP ${r.status}): ${text.slice(0, 200)}`,
        };
      }

      const json = (await r.json().catch(() => ({}))) as any;
      const generated = json?.transcription;
      if (!generated) {
        return { ok: false, error: 'Resposta da geração veio vazia' };
      }

      return { ok: true, data: shape(generated, true) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getPostTranscription] error:', err);
      return { ok: false, error: message };
    }
  },
};

function shape(row: any, generated: boolean): PostTranscriptionData {
  const carouselRaw = row.carousel_slides;
  const carouselSlides = Array.isArray(carouselRaw)
    ? carouselRaw.map((s: any) => ({
        index: Number(s?.index ?? 0),
        description: String(s?.description ?? ''),
      }))
    : null;
  const scenesRaw = row.reel_scenes;
  const reelScenes = Array.isArray(scenesRaw)
    ? scenesRaw.map((s: any) => ({
        start_sec: Number(s?.start_sec ?? 0),
        end_sec: Number(s?.end_sec ?? 0),
        description: String(s?.description ?? ''),
      }))
    : null;
  return {
    found: true,
    postId: String(row.post_id),
    source: String(row.source),
    network: String(row.network),
    postType: row.post_type ?? null,
    caption: row.caption ?? null,
    fullSummary: row.full_summary ?? null,
    visualDescription: row.visual_description ?? null,
    carouselSlides,
    reelAudioTranscript: row.reel_audio_transcript ?? null,
    reelScenes,
    storyDescription: row.story_description ?? null,
    updatedAt: row.updated_at ?? null,
    generated,
  };
}
