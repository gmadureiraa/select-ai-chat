// Migrated from supabase/functions/analyze-style/index.ts
// NOTE: token check (workspace tokens) deferred — implement after Neon schema is ported
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

const MODEL = 'gemini-2.5-flash';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

export default authedPost(async ({ user, body }) => {
  const { imageUrls, userId, clientId } = body;
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error('imageUrls array is required');
  }
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('API key not configured');

  console.log(`[analyze-style] Analyzing ${imageUrls.length} images`);
  const parts: any[] = [];
  let valid = 0;
  for (let i = 0; i < Math.min(imageUrls.length, 6); i++) {
    const url = imageUrls[i];
    try {
      if (url.startsWith('data:')) {
        const m = url.match(/^data:([^;]+);base64,(.+)$/);
        if (m) { parts.push({ inlineData: { mimeType: m[1], data: m[2] } }); valid++; }
      } else if (url.startsWith('http')) {
        const r = await fetch(url);
        if (r.ok) {
          const ab = await r.arrayBuffer();
          const ct = r.headers.get('content-type') || 'image/jpeg';
          parts.push({ inlineData: { mimeType: ct, data: arrayBufferToBase64(ab) } });
          valid++;
        }
      }
    } catch (e) {
      console.warn(`[analyze-style] Failed to process image ${i + 1}:`, e);
    }
  }
  if (parts.length === 0) throw new Error('No valid images could be processed');

  const analysisPrompt = `Analise estas ${parts.length} imagens de referência para geração de imagens e extraia um JSON estruturado com as características visuais.

RETORNE APENAS O JSON, sem markdown ou explicações:

{
  "style_summary": "Resumo geral do estilo visual em 2-3 frases",
  "visual_elements": {
    "photography_style": "tipo de fotografia (ex: lifestyle, product shot, editorial)",
    "lighting": "descrição da iluminação",
    "color_palette": ["cor1", "cor2", "cor3"],
    "dominant_mood": "atmosfera/mood geral",
    "composition": "tipo de composição comum"
  },
  "recurring_elements": ["elemento visual que aparece frequentemente"],
  "brand_elements": {
    "logo_style": "descrição se houver logo visível",
    "typography": "estilo tipográfico se visível",
    "product_presentation": "como produtos são apresentados"
  },
  "technical_specs": {
    "aspect_ratio": "proporção comum",
    "resolution_feel": "alta qualidade, lifestyle, etc",
    "post_processing": "estilo de edição/filtros"
  },
  "generation_prompt_template": "Um template de prompt detalhado para recriar este estilo"
}`;

  parts.push({ text: analysisPrompt });

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 2048 } }),
  });
  if (!r.ok) {
    const errorText = await r.text();
    console.error('[analyze-style] Gemini API error:', r.status, errorText);
    throw new Error('Failed to analyze images');
  }
  const data = await r.json();
  const textContent: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data?.usageMetadata?.promptTokenCount || (valid * 258) + Math.ceil(analysisPrompt.length / 4);
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || Math.ceil(textContent.length / 4);

  const resolvedUserId = userId || user.id;
  if (resolvedUserId) {
    try {
      await getPool().query(
        `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [resolvedUserId, MODEL, 'analyze-style', inputTokens, outputTokens, JSON.stringify({ imageCount: valid, clientId })]
      );
    } catch (e) {
      console.warn('[analyze-style] usage log failed:', e);
    }
  }

  let styleAnalysis: any;
  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) styleAnalysis = JSON.parse(jsonMatch[0]);
    else throw new Error('No JSON');
  } catch {
    styleAnalysis = {
      style_summary: textContent.substring(0, 500),
      generation_prompt_template: `Imagem no estilo das referências: ${textContent.substring(0, 300)}`,
    };
  }

  console.log(`[analyze-style] Complete - ${inputTokens + outputTokens} tokens`);
  return { styleAnalysis };
});
