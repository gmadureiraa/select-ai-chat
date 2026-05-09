// transcribe-post — Gera transcrição completa (caption + visual + carrossel + reel + story)
// usando Gemini 2.5 Flash com Vision pra um post específico do cliente.
//
// Body: {
//   clientId: string;            // obrigatório
//   postId: string;              // obrigatório (metricool_post_id ou external id)
//   source: 'metricool' | 'instagram_posts' | 'planning';
//   postType?: 'post' | 'carousel' | 'reel' | 'story' | 'video';
//   network?: string;            // default 'instagram'
//   imageUrls?: string[];        // imagens/slides
//   videoUrl?: string;           // pra reels
//   caption?: string;            // se vier do caller, salva direto
//   force?: boolean;             // re-transcreve mesmo se já existe
// }
//
// Lógica:
//   1. Se já existe transcription pro UNIQUE (client_id, post_id, source) e force=false, retorna
//   2. Pra cada imageUrl chama Gemini Vision com prompt pt-BR pedindo descrição detalhada
//   3. Carrossel: descreve slide-a-slide
//   4. Reel: vídeo via inlineData (até 18MB) — Gemini extrai cenas + áudio
//   5. Story: caption + visual
//   6. Gera full_summary
//   7. Upsert em client_post_transcriptions

import { authedPost } from '../_lib/handler.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { logAIUsage, estimateImageTokens, estimateTokens } from '../_lib/shared/ai-usage.js';

const MODEL = 'gemini-2.5-flash';
const MAX_VIDEO_SIZE = 18 * 1024 * 1024; // 18MB pra inlineData (Gemini limita 20MB total)

interface TranscribeBody {
  clientId?: string;
  postId?: string;
  source?: 'metricool' | 'instagram_posts' | 'planning';
  network?: string;
  postType?: 'post' | 'carousel' | 'reel' | 'story' | 'video' | string;
  imageUrls?: string[];
  videoUrl?: string;
  caption?: string;
  force?: boolean;
}

interface InlineData {
  inlineData: { mimeType: string; data: string };
}

interface CarouselSlide {
  index: number;
  image_url: string;
  description: string;
}

interface ReelScene {
  start_sec: number;
  end_sec: number;
  description: string;
}

interface TranscriptionRow {
  id: string;
  client_id: string;
  post_id: string;
  source: string;
  network: string;
  post_type: string | null;
  caption: string | null;
  visual_description: string | null;
  carousel_slides: CarouselSlide[] | null;
  reel_audio_transcript: string | null;
  reel_scenes: ReelScene[] | null;
  story_description: string | null;
  full_summary: string | null;
  language: string;
  model: string;
  tokens_used: number;
  created_at: string;
  updated_at: string;
}

async function urlToInlineData(url: string, maxSize?: number): Promise<InlineData | null> {
  if (url.startsWith('data:')) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return { inlineData: { mimeType: m[1], data: m[2] } };
  }
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!r.ok) {
      console.warn(`[transcribe-post] fetch failed ${r.status} for ${url.slice(0, 100)}`);
      return null;
    }
    const buf = await r.arrayBuffer();
    if (maxSize && buf.byteLength > maxSize) {
      console.warn(
        `[transcribe-post] media too large: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB > ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
      );
      return null;
    }
    const base64 = Buffer.from(buf).toString('base64');
    const mimeType = r.headers.get('content-type') || 'image/jpeg';
    return { inlineData: { mimeType, data: base64 } };
  } catch (e) {
    console.warn('[transcribe-post] fetch error:', e);
    return null;
  }
}

async function callGemini(
  parts: Array<InlineData | { text: string }>,
  apiKey: string,
  maxTokens = 4096,
  temperature = 0.3,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    },
  );
  if (!r.ok) {
    const t = await r.text();
    console.error(`[transcribe-post] Gemini error ${r.status}:`, t.slice(0, 500));
    throw new Error(`Gemini API error: ${r.status}`);
  }
  const data = await r.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data?.usageMetadata?.promptTokenCount || 0;
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || estimateTokens(text);
  return { text, inputTokens, outputTokens };
}

async function describeImage(
  imageUrl: string,
  apiKey: string,
  contextLabel = 'imagem',
): Promise<{ description: string; tokens: number }> {
  const inline = await urlToInlineData(imageUrl);
  if (!inline) {
    return { description: '[falha ao baixar imagem]', tokens: 0 };
  }
  const prompt = `Descreva esta ${contextLabel} em português brasileiro, em detalhes ricos mas concisos (máximo 4 frases).

Inclua:
- Quem aparece (pessoas, objetos, lugares)
- O que está acontecendo (ação, contexto)
- Estilo visual (cores dominantes, mood, ângulo de câmera, iluminação)
- Texto sobreposto se houver (transcreva literalmente)

Retorne APENAS a descrição em texto corrido, sem markdown, sem títulos.`;
  const result = await callGemini(
    [inline, { text: prompt }],
    apiKey,
    1024,
    0.3,
  );
  return {
    description: result.text.trim(),
    tokens: result.inputTokens + result.outputTokens,
  };
}

async function describeReel(
  videoUrl: string,
  caption: string | undefined,
  apiKey: string,
): Promise<{
  audioTranscript: string;
  scenes: ReelScene[];
  visualDescription: string;
  tokens: number;
}> {
  const inline = await urlToInlineData(videoUrl, MAX_VIDEO_SIZE);
  if (!inline) {
    return {
      audioTranscript: '[vídeo indisponível ou maior que 18MB]',
      scenes: [],
      visualDescription: '[vídeo não pôde ser processado]',
      tokens: 0,
    };
  }
  const prompt = `Você está analisando um vídeo curto (reel/short). Retorne JSON estruturado em português brasileiro.

${caption ? `Legenda do post: """${caption.slice(0, 500)}"""\n` : ''}

Retorne APENAS este JSON, sem markdown:
{
  "audio_transcript": "transcrição literal do áudio falado em pt-BR (se houver fala). Se for instrumental ou sem voz, descreva: 'sem fala / música ambiente'",
  "visual_description": "descrição geral do reel em 2-3 frases — quem aparece, o tema, o estilo visual",
  "scenes": [
    { "start_sec": 0, "end_sec": 3, "description": "cena descrita em 1 frase" }
  ]
}

Regras:
- Divida em 5-7 cenas (start_sec e end_sec inteiros, em ordem).
- audio_transcript em pt-BR mesmo que o vídeo seja em inglês — traduza.
- Não invente. Se não houver áudio, escreve "sem fala".`;
  const result = await callGemini(
    [inline, { text: prompt }],
    apiKey,
    8192,
    0.3,
  );
  let parsed: any = {};
  try {
    const jm = result.text.match(/\{[\s\S]*\}/);
    parsed = jm ? JSON.parse(jm[0]) : {};
  } catch (e) {
    console.warn('[transcribe-post] failed to parse reel JSON, using fallback:', e);
    parsed = {
      audio_transcript: result.text.slice(0, 1000),
      visual_description: '[falha ao parsear cenas]',
      scenes: [],
    };
  }
  return {
    audioTranscript: typeof parsed.audio_transcript === 'string' ? parsed.audio_transcript : '',
    visualDescription:
      typeof parsed.visual_description === 'string' ? parsed.visual_description : '',
    scenes: Array.isArray(parsed.scenes)
      ? parsed.scenes
          .map((s: any, i: number) => ({
            start_sec: Number(s?.start_sec ?? i * 3),
            end_sec: Number(s?.end_sec ?? (i + 1) * 3),
            description: String(s?.description ?? '').trim(),
          }))
          .filter((s: ReelScene) => s.description.length > 0)
      : [],
    tokens: result.inputTokens + result.outputTokens,
  };
}

async function buildSummary(
  parts: {
    caption?: string | null;
    visualDescription?: string | null;
    slides?: CarouselSlide[] | null;
    reelAudio?: string | null;
    reelScenes?: ReelScene[] | null;
    storyDescription?: string | null;
    postType?: string;
  },
  apiKey: string,
): Promise<{ summary: string; tokens: number }> {
  const sections: string[] = [];
  if (parts.caption) sections.push(`Legenda: ${parts.caption.slice(0, 1500)}`);
  if (parts.visualDescription) sections.push(`Visual: ${parts.visualDescription}`);
  if (parts.slides && parts.slides.length > 0) {
    sections.push(
      `Slides:\n${parts.slides.map((s) => `${s.index + 1}. ${s.description}`).join('\n')}`,
    );
  }
  if (parts.reelAudio) sections.push(`Áudio do reel: ${parts.reelAudio.slice(0, 1500)}`);
  if (parts.reelScenes && parts.reelScenes.length > 0) {
    sections.push(
      `Cenas do reel:\n${parts.reelScenes.map((s) => `${s.start_sec}-${s.end_sec}s: ${s.description}`).join('\n')}`,
    );
  }
  if (parts.storyDescription) sections.push(`Story: ${parts.storyDescription}`);

  if (sections.length === 0) {
    return { summary: '', tokens: 0 };
  }

  const prompt = `Resuma o post abaixo (${parts.postType || 'post'}) em 2-3 frases curtas em português brasileiro. Capture o tema central, o tom e o gancho principal. Sem markdown, sem títulos.

${sections.join('\n\n')}`;

  const result = await callGemini([{ text: prompt }], apiKey, 512, 0.4);
  return {
    summary: result.text.trim(),
    tokens: result.inputTokens + result.outputTokens,
  };
}

export default authedPost(async ({ user, body }) => {
  const {
    clientId,
    postId,
    source = 'instagram_posts',
    network = 'instagram',
    postType,
    imageUrls = [],
    videoUrl,
    caption,
    force = false,
  } = (body || {}) as TranscribeBody;

  if (!clientId) throw new Error('clientId é obrigatório');
  if (!postId) throw new Error('postId é obrigatório');

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured');

  const validSources = new Set(['metricool', 'instagram_posts', 'planning']);
  if (!validSources.has(source)) {
    throw new Error(`source inválido: ${source} (use metricool|instagram_posts|planning)`);
  }

  // 1. Verifica se já existe
  const existing = await queryOne<TranscriptionRow>(
    `SELECT * FROM client_post_transcriptions
       WHERE client_id = $1 AND post_id = $2 AND source = $3
       LIMIT 1`,
    [clientId, postId, source],
  );

  if (existing && !force) {
    console.log(
      `[transcribe-post] cache hit ${clientId}/${postId}/${source}`,
    );
    return { transcription: existing, cached: true };
  }

  console.log(
    `[transcribe-post] start client=${clientId} post=${postId} src=${source} type=${postType ?? '?'} imgs=${imageUrls.length} video=${videoUrl ? 'yes' : 'no'}`,
  );

  let totalTokens = 0;
  let visualDescription: string | null = null;
  let carouselSlides: CarouselSlide[] | null = null;
  let reelAudioTranscript: string | null = null;
  let reelScenes: ReelScene[] | null = null;
  let storyDescription: string | null = null;

  const isCarousel =
    (postType === 'carousel' || imageUrls.length > 1) && imageUrls.length > 1;
  const isReel = postType === 'reel' || (!!videoUrl && imageUrls.length === 0);
  const isStory = postType === 'story';

  try {
    if (isReel && videoUrl) {
      const reel = await describeReel(videoUrl, caption, apiKey);
      reelAudioTranscript = reel.audioTranscript;
      reelScenes = reel.scenes;
      visualDescription = reel.visualDescription;
      totalTokens += reel.tokens;
    } else if (isCarousel) {
      // Carousel: descreve cada slide
      const slides: CarouselSlide[] = [];
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        try {
          const result = await describeImage(url, apiKey, `slide ${i + 1} de ${imageUrls.length} de um carrossel`);
          slides.push({ index: i, image_url: url, description: result.description });
          totalTokens += result.tokens;
        } catch (e: any) {
          console.warn(`[transcribe-post] slide ${i} failed:`, e?.message);
          slides.push({ index: i, image_url: url, description: '[falha ao descrever]' });
        }
      }
      carouselSlides = slides;
      // Visual description = resumo dos slides
      visualDescription = slides
        .map((s) => `${s.index + 1}. ${s.description.slice(0, 200)}`)
        .join('\n');
    } else if (imageUrls.length > 0) {
      // Post simples (1 imagem) ou story
      const result = await describeImage(
        imageUrls[0],
        apiKey,
        isStory ? 'imagem de um story (24h)' : 'imagem do post',
      );
      visualDescription = result.description;
      totalTokens += result.tokens;
      if (isStory) storyDescription = result.description;
    }

    // Full summary consolidando tudo
    const summaryResult = await buildSummary(
      {
        caption,
        visualDescription,
        slides: carouselSlides,
        reelAudio: reelAudioTranscript,
        reelScenes,
        storyDescription,
        postType: postType || (isReel ? 'reel' : isCarousel ? 'carousel' : isStory ? 'story' : 'post'),
      },
      apiKey,
    );
    totalTokens += summaryResult.tokens;

    // Upsert
    const pool = getPool();
    const upsertSql = `
      INSERT INTO client_post_transcriptions (
        client_id, post_id, source, network, post_type, caption,
        visual_description, carousel_slides, reel_audio_transcript,
        reel_scenes, story_description, full_summary, language,
        model, tokens_used, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, 'pt-BR', $13, $14, NOW(), NOW())
      ON CONFLICT (client_id, post_id, source)
      DO UPDATE SET
        network = EXCLUDED.network,
        post_type = EXCLUDED.post_type,
        caption = EXCLUDED.caption,
        visual_description = EXCLUDED.visual_description,
        carousel_slides = EXCLUDED.carousel_slides,
        reel_audio_transcript = EXCLUDED.reel_audio_transcript,
        reel_scenes = EXCLUDED.reel_scenes,
        story_description = EXCLUDED.story_description,
        full_summary = EXCLUDED.full_summary,
        model = EXCLUDED.model,
        tokens_used = EXCLUDED.tokens_used,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(upsertSql, [
      clientId,
      postId,
      source,
      network,
      postType || (isReel ? 'reel' : isCarousel ? 'carousel' : isStory ? 'story' : 'post'),
      caption || null,
      visualDescription,
      carouselSlides ? JSON.stringify(carouselSlides) : null,
      reelAudioTranscript,
      reelScenes ? JSON.stringify(reelScenes) : null,
      storyDescription,
      summaryResult.summary || null,
      MODEL,
      totalTokens,
    ]);

    const saved = result.rows[0] as TranscriptionRow;

    // Log AI usage (estimativa: tokens já vieram do Gemini API)
    try {
      await logAIUsage(user.id, MODEL, 'transcribe-post', totalTokens, 0, {
        client_id: clientId,
        post_id: postId,
        source,
        post_type: postType,
        has_video: !!videoUrl,
        image_count: imageUrls.length,
      });
    } catch (e) {
      console.warn('[transcribe-post] failed to log usage:', e);
    }

    console.log(
      `[transcribe-post] done client=${clientId} post=${postId} tokens=${totalTokens}`,
    );

    return { transcription: saved, cached: false };
  } catch (err: any) {
    console.error(`[transcribe-post] error client=${clientId} post=${postId}:`, err);
    throw err;
  }
});
