// Migrated from supabase/functions/analyze-image-complete/index.ts
import { authedPost } from '../_lib/handler.js';
import { logAIUsage, estimateImageTokens, estimateTokens } from '../_lib/shared/ai-usage.js';
import { assertClientAccess } from '../_lib/access.js';

const MODEL = 'gemini-2.5-flash';

export default authedPost(async ({ user, body }) => {
  const { imageUrl, userId, clientId } = body;
  if (!imageUrl) throw new Error('imageUrl is required');
  if (clientId) await assertClientAccess(user.id, clientId);

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured');

  const parts: any[] = [];
  if (imageUrl.startsWith('data:')) {
    const m = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
  } else if (imageUrl.startsWith('http')) {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`Failed to fetch image: ${r.status}`);
    const buf = await r.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    const ct = r.headers.get('content-type') || 'image/jpeg';
    parts.push({ inlineData: { mimeType: ct, data: base64 } });
  } else {
    throw new Error('Invalid image URL format');
  }

  const analysisPrompt = `Analise esta imagem em detalhes extremos e retorne um JSON estruturado completo.

RETORNE APENAS O JSON, sem markdown, sem explicações:

{
  "image_description": "...",
  "style": { "photography_type": "...", "art_style": "...", "visual_treatment": "..." },
  "colors": {
    "dominant": ["#hex", "#hex"],
    "accent": ["#hex"],
    "palette_type": "...",
    "mood_from_colors": "...",
    "saturation_level": "...",
    "contrast_level": "..."
  },
  "composition": { "layout": "...", "focus_point": "...", "negative_space": "...", "depth": "...", "perspective": "..." },
  "lighting": { "type": "...", "direction": "...", "quality": "...", "color_temperature": "..." },
  "subjects": [{ "type": "...", "description": "...", "position": "...", "prominence": "..." }],
  "text_elements": { "has_text": false, "text_content": "...", "typography_style": "...", "text_placement": "...", "text_effects": "..." },
  "mood_atmosphere": { "primary_mood": "...", "emotional_impact": "...", "energy_level": "..." },
  "technical_details": { "estimated_resolution": "...", "aspect_ratio": "...", "image_quality": "...", "post_processing": "..." },
  "generation_prompt": "prompt em português para recriar essa imagem (mínimo 100 palavras)"
}`;
  parts.push({ text: analysisPrompt });

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } }),
    }
  );
  if (!r.ok) {
    const t = await r.text();
    console.error('[analyze-image-complete] Gemini error', r.status, t);
    throw new Error('Failed to analyze image');
  }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data?.usageMetadata?.promptTokenCount || (estimateImageTokens(1) + estimateTokens(analysisPrompt));
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || estimateTokens(text);

  await logAIUsage(userId || user.id, MODEL, 'analyze-image-complete', inputTokens, outputTokens, { client_id: clientId });

  let imageAnalysis: any;
  try {
    const jm = text.match(/\{[\s\S]*\}/);
    imageAnalysis = jm ? JSON.parse(jm[0]) : null;
  } catch (e) {
    console.error('[analyze-image-complete] parse failed:', e);
  }
  if (!imageAnalysis) {
    imageAnalysis = {
      image_description: text.substring(0, 500),
      style: { photography_type: 'unknown', art_style: 'unknown' },
      colors: { dominant: [], accent: [] },
      composition: { layout: 'unknown' },
      lighting: { type: 'unknown' },
      subjects: [],
      text_elements: { has_text: false },
      mood_atmosphere: { primary_mood: 'unknown' },
      generation_prompt: `Recrie esta imagem: ${text.substring(0, 300)}`,
    };
  }

  return { imageAnalysis, generationPrompt: imageAnalysis.generation_prompt };
});
