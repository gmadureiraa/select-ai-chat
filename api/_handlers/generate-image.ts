// New handler — image generation via Gemini image models with optional reference images.
// Replaces the (never-existed) Supabase generate-image function. Uploads result to Vercel Blob.
import { authedPost } from '../_lib/handler.js';
import { put } from '@vercel/blob';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';

interface ReferenceImageInput {
  url?: string;
  base64?: string; // data:image/...;base64,...
  mimeType?: string;
}

interface GenerateImageBody {
  prompt: string;
  referenceImages?: ReferenceImageInput[];
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
  noText?: boolean;
  clientId?: string | null;
  model?: string; // override
}

const ASPECT_INSTRUCTIONS: Record<string, string> = {
  '1:1': 'Square format (1:1 ratio, 1024x1024px)',
  '4:5': 'Portrait format (4:5 ratio, 1024x1280px)',
  '9:16': 'Vertical/Stories format (9:16 ratio, 1080x1920px)',
  '16:9': 'Landscape format (16:9 ratio, 1920x1080px)',
};

async function fetchAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    return { data: buf.toString('base64'), mime };
  } catch (e) {
    console.warn('[generate-image] fetchAsBase64 failed:', url, e);
    return null;
  }
}

function parseDataUrl(input: string): { mime: string; data: string } | null {
  const m = input.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

export default authedPost(async ({ user, body }) => {
  const { prompt, referenceImages, aspectRatio, noText, clientId, model } = body as GenerateImageBody;
  if (!prompt || typeof prompt !== 'string') throw new Error('prompt é obrigatório');

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY não configurada');

  // Build full prompt
  let fullPrompt = '';
  if (noText !== false) {
    fullPrompt += `🚫 CRITICAL - ABSOLUTELY NO TEXT IN THIS IMAGE 🚫
This image MUST NOT contain ANY text, letters, numbers, or symbols (in ANY language).
NO words, typography, captions, titles, watermarks, or written content.
Generate ONLY visual elements.

`;
  }
  fullPrompt += `Create a professional, high-quality image.

QUALITY:
- Ultra high resolution, professional aesthetic
- Clean composition with great attention to detail
- Vibrant, eye-catching colors
- Modern, sophisticated style
${noText !== false ? '- PURE VISUAL CONTENT — NO TEXT, LETTERS, OR NUMBERS' : ''}

PROMPT:
${prompt}
`;
  if (aspectRatio && ASPECT_INSTRUCTIONS[aspectRatio]) {
    fullPrompt += `\nASPECT RATIO: ${ASPECT_INSTRUCTIONS[aspectRatio]}\n`;
  }

  // Build Gemini request parts (multimodal: text + reference images)
  const parts: any[] = [];
  if (referenceImages && referenceImages.length > 0) {
    for (const ref of referenceImages.slice(0, 4)) {
      let mime: string | null = null;
      let dataB64: string | null = null;
      if (ref.base64) {
        const parsed = parseDataUrl(ref.base64);
        if (parsed) {
          mime = parsed.mime;
          dataB64 = parsed.data;
        } else {
          mime = ref.mimeType || 'image/jpeg';
          dataB64 = ref.base64;
        }
      } else if (ref.url) {
        const fetched = await fetchAsBase64(ref.url);
        if (fetched) {
          mime = fetched.mime;
          dataB64 = fetched.data;
        }
      }
      if (mime && dataB64) parts.push({ inlineData: { mimeType: mime, data: dataB64 } });
    }
  }
  parts.push({ text: fullPrompt });

  // Use Gemini image-capable model
  const modelName = model
    || (referenceImages && referenceImages.length > 0
      ? 'gemini-2.5-flash-image-preview'
      : 'gemini-2.5-flash-image-preview');

  console.log(`[generate-image] Using model ${modelName}, refImages=${referenceImages?.length || 0}`);

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.9, responseModalities: ['IMAGE', 'TEXT'] },
      }),
    }
  );

  if (!r.ok) {
    const t = await r.text();
    console.error('[generate-image] Gemini error:', r.status, t);
    if (r.status === 429) throw new Error('Rate limit excedido. Tente novamente em alguns segundos.');
    throw new Error(`Falha ao gerar imagem (${r.status})`);
  }

  const result = await r.json();
  // Find first inline image part in response
  const candidateParts = result?.candidates?.[0]?.content?.parts || [];
  let mimeType = 'image/png';
  let imageBase64: string | null = null;
  for (const p of candidateParts) {
    if (p.inlineData?.data) {
      mimeType = p.inlineData.mimeType || 'image/png';
      imageBase64 = p.inlineData.data;
      break;
    }
  }

  if (!imageBase64) {
    console.error('[generate-image] no image in response:', JSON.stringify(result).slice(0, 500));
    throw new Error('Nenhuma imagem retornada pelo modelo');
  }

  // Upload to Vercel Blob (public)
  const buffer = Buffer.from(imageBase64, 'base64');
  const ext = mimeType.split('/')[1] || 'png';
  const path = `client-files/generated/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  let publicUrl = '';
  try {
    const blob = await put(path, buffer, { access: 'public', contentType: mimeType, addRandomSuffix: false });
    publicUrl = blob.url;
  } catch (e) {
    console.warn('[generate-image] Blob upload failed, returning base64 fallback:', e);
    publicUrl = `data:${mimeType};base64,${imageBase64}`;
  }

  // Best-effort usage log
  try {
    const inTok = result?.usageMetadata?.promptTokenCount ?? estimateTokens(fullPrompt);
    const outTok = result?.usageMetadata?.candidatesTokenCount ?? 1290;
    await logAIUsage(user.id, modelName, 'generate-image', inTok, outTok, {
      client_id: clientId || null,
      reference_images: referenceImages?.length || 0,
      aspect_ratio: aspectRatio || '1:1',
    });
  } catch (e) {
    console.warn('[generate-image] usage log failed:', e);
  }

  return { imageUrl: publicUrl, image_url: publicUrl };
});
