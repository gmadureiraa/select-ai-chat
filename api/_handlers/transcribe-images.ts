// Migrated from supabase/functions/transcribe-images/index.ts
import { anonPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

const MAX_IMAGES_PER_REQUEST = 1;
const MODEL = 'gemini-2.5-flash';

type InlineDataPart = { inline_data: { mime_type: string; data: string } };
type TextPart = { text: string };
type GeminiPart = InlineDataPart | TextPart;

async function urlToInlineData(url: string): Promise<InlineDataPart | null> {
  if (url.startsWith('data:')) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return { inline_data: { mime_type: m[1], data: m[2] } };
  }
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!r.ok) {
      console.warn(`[transcribe-images] Failed to fetch: ${r.status}`);
      return null;
    }
    const buf = await r.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    const mimeType = r.headers.get('content-type') || 'image/jpeg';
    return { inline_data: { mime_type: mimeType, data: base64 } };
  } catch (e) {
    console.warn('[transcribe-images] fetch error:', e);
    return null;
  }
}

async function transcribeBatch(imageUrls: string[], startIndex: number, apiKey: string) {
  const parts: GeminiPart[] = [];
  const systemPrompt = `Você é um transcritor de texto preciso. Sua ÚNICA tarefa é extrair TODO o texto visível nas imagens.

REGRAS IMPORTANTES:
- NÃO descreva a imagem, NÃO mencione cores, layout, design, ou elementos visuais
- APENAS transcreva o texto que está escrito
- Transcreva CADA imagem separadamente
- Use o formato "## 📄 Página N" como header antes do texto de cada imagem
- Se uma imagem não tiver texto, escreva "(sem texto)"
- NÃO pule nenhuma imagem

Você receberá ${imageUrls.length} imagens (páginas ${startIndex + 1} a ${startIndex + imageUrls.length}).`;
  parts.push({ text: systemPrompt });
  let valid = 0;
  for (const url of imageUrls) {
    const ip = await urlToInlineData(url);
    if (ip) {
      parts.push(ip);
      valid++;
    }
  }
  if (valid === 0) return { transcription: '', inputTokens: 0, outputTokens: 0 };

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192 } }),
    }
  );
  if (!r.ok) {
    const t = await r.text();
    console.error('[transcribe-images] Gemini error:', t);
    throw new Error(`Gemini API error: ${r.status}`);
  }
  const data = await r.json();
  let transcription: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  for (let i = imageUrls.length; i >= 1; i--) {
    const oldP = `## 📄 Página ${i}`;
    const newP = `## 📄 Página ${startIndex + i}`;
    transcription = transcription.replace(new RegExp(oldP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newP);
  }
  const inputTokens = data?.usageMetadata?.promptTokenCount || valid * 258;
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || Math.ceil(transcription.length / 4);
  return { transcription, inputTokens, outputTokens };
}

export default anonPost(async ({ body }) => {
  const { imageUrls, userId, clientId } = body;
  const startIndex = Number(body?.startIndex ?? 0);
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) throw new Error('imageUrls array is required');
  if (!Number.isFinite(startIndex) || startIndex < 0) throw new Error('startIndex must be a non-negative number');
  if (imageUrls.length > MAX_IMAGES_PER_REQUEST) throw new Error(`Maximum ${MAX_IMAGES_PER_REQUEST} images allowed per request`);
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured');

  const startedAt = Date.now();
  const result = await transcribeBatch(imageUrls, startIndex, apiKey);
  const durationMs = Date.now() - startedAt;
  console.log(`[transcribe-images] Done: ${imageUrls.length} image(s), ${durationMs}ms, tokens=${result.inputTokens + result.outputTokens}`);

  if (userId) {
    try {
      await getPool().query(
        `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [userId, MODEL, 'transcribe-images', result.inputTokens, result.outputTokens, JSON.stringify({ imageCount: imageUrls.length, startIndex, clientId })]
      );
    } catch (e) {
      console.warn('[transcribe-images] usage log failed:', e);
    }
  }
  return { transcription: result.transcription, transcriptions: [result.transcription] };
});
