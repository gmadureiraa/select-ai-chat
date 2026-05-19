// Migrated from supabase/functions/generate-content-v2/index.ts
// Handles BOTH text generation (with full client context) and image generation
// (with optional visual references). Returns:
//   text: { content, thread_tweets? }
//   image: { imageUrl }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { getPool, queryOne, query } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { put } from '@vercel/blob';

// =====================================================
// VALIDATION SCHEMA
// =====================================================
const AttachmentSchema = z.object({
  type: z.enum(['image', 'video', 'audio', 'text', 'url', 'instagram', 'youtube']),
  content: z.string(),
  imageBase64: z.string().optional(),
  analysis: z.record(z.unknown()).optional(),
  transcription: z.string().optional(),
  extractedImages: z.array(z.string()).optional(),
  caption: z.string().optional(),
  imageCount: z.number().optional(),
});

const GenerateBodySchema = z.object({
  type: z.enum(['text', 'image']),
  inputs: z.array(AttachmentSchema),
  config: z.object({
    format: z.string().optional(),
    platform: z.string().optional(),
    aspectRatio: z.string().optional(),
    noText: z.boolean().optional(),
    preserveFace: z.boolean().optional(),
    useVisualReferences: z.boolean().optional(),
  }),
  clientId: z.string().nullable().optional(),
  workspaceId: z.string().nullable().optional(),
});
import {
  getFormatDocs,
  getFormatChecklistFormatted,
  getSuccessPatterns,
  getStructuredVoice,
} from '../_lib/shared/knowledge-loader.js';
import { selectModelForFormat } from '../_lib/shared/prompt-builder.js';
import { buildForbiddenPhrasesSection, UNIVERSAL_OUTPUT_RULES } from '../_lib/shared/quality-rules.js';
import { getFormatRules } from '../_lib/shared/format-rules.js';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';
import { rateLimit, getRateLimitKey } from '../_lib/shared/rate-limit.js';

// =====================================================
// TYPES
// =====================================================
interface AttachmentInput {
  type: 'image' | 'video' | 'audio' | 'text' | 'url' | 'instagram' | 'youtube';
  content: string;
  imageBase64?: string;
  analysis?: Record<string, unknown>;
  transcription?: string;
  extractedImages?: string[];
  caption?: string;
  imageCount?: number;
}

interface GenerateRequest {
  type: 'text' | 'image';
  inputs: AttachmentInput[];
  config: {
    format?: string;
    platform?: string;
    aspectRatio?: string;
    noText?: boolean;
    preserveFace?: boolean;
    useVisualReferences?: boolean;
  };
  clientId?: string | null;
  workspaceId?: string | null;
}

interface BrandContext {
  name?: string;
  brandVoice?: string;
  values?: string;
  keywords?: string[];
  colorPalette?: { primary?: string; secondary?: string; accent?: string };
  photographyStyle?: string;
  preferredStyle?: string;
}

interface VisualReference {
  imageUrl: string;
  type: string;
  styleAnalysis?: {
    style_summary?: string;
    visual_elements?: { photography_style?: string; color_palette?: string[] };
  };
  isPrimary: boolean;
  description?: string;
}

// =====================================================
// HELPERS
// =====================================================
function extractFromGuide(guide: string | null, keyword: string): string | null {
  if (!guide) return null;
  for (const line of guide.split('\n')) {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) return line.substring(colonIndex + 1).trim();
    }
  }
  return null;
}

function extractKeywords(notes: string | null): string[] {
  if (!notes) return [];
  const words = notes.split(/\s+/).filter((w) => w.length > 3);
  const counts: Record<string, number> = {};
  for (const w of words) {
    const clean = w.replace(/[^a-zA-ZÀ-ÿ]/g, '').toLowerCase();
    if (clean) counts[clean] = (counts[clean] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .map(([w]) => w)
    .slice(0, 10);
}

async function fetchClientBrandContext(clientId: string | null): Promise<BrandContext | null> {
  if (!clientId) return null;
  try {
    const c = await queryOne<any>(
      `SELECT name, identity_guide, context_notes, brand_assets FROM clients WHERE id = $1`,
      [clientId]
    );
    if (!c) return null;
    const brandAssets = c.brand_assets || {};
    return {
      name: c.name,
      brandVoice:
        extractFromGuide(c.identity_guide, 'tom de voz')
        || extractFromGuide(c.identity_guide, 'voice')
        || undefined,
      values:
        extractFromGuide(c.identity_guide, 'valores')
        || extractFromGuide(c.identity_guide, 'values')
        || undefined,
      keywords: extractKeywords(c.context_notes),
      colorPalette: {
        primary: brandAssets.color_palette?.primary || brandAssets.colors?.primary,
        secondary: brandAssets.color_palette?.secondary || brandAssets.colors?.secondary,
        accent: brandAssets.color_palette?.accent || brandAssets.colors?.accent,
      },
      photographyStyle: brandAssets.visual_style?.photography_style || brandAssets.photographyStyle,
      preferredStyle: brandAssets.visual_style?.preferred_style,
    };
  } catch (err) {
    console.error('[generate-content-v2] brand context error:', err);
    return null;
  }
}

async function fetchClientVisualReferences(clientId: string | null): Promise<VisualReference[]> {
  if (!clientId) return [];
  try {
    const rows = await query<any>(
      `SELECT image_url, reference_type, is_primary, metadata, description
       FROM client_visual_references
       WHERE client_id = $1
       ORDER BY is_primary DESC NULLS LAST
       LIMIT 5`,
      [clientId]
    );
    return rows.map((r) => ({
      imageUrl: r.image_url,
      type: r.reference_type,
      styleAnalysis: r.metadata?.styleAnalysis,
      isPrimary: !!r.is_primary,
      description: r.description,
    }));
  } catch (err) {
    console.error('[generate-content-v2] visual refs error:', err);
    return [];
  }
}

async function fetchFavoriteContent(
  clientId: string | null
): Promise<Array<{ title: string; content: string; type: string }>> {
  if (!clientId) return [];
  try {
    const rows = await query<any>(
      `SELECT title, content, content_type FROM client_content_library
       WHERE client_id = $1 AND is_favorite = true
       ORDER BY created_at DESC LIMIT 3`,
      [clientId]
    );
    return rows.map((it: any) => ({
      title: it.title,
      content: (it.content || '').substring(0, 800),
      type: it.content_type,
    }));
  } catch (err) {
    console.error('[generate-content-v2] favorites error:', err);
    return [];
  }
}

async function fetchTopPerformers(
  clientId: string | null
): Promise<Array<{ title: string; content: string; type: string; metric: string }>> {
  if (!clientId) return [];
  const out: Array<{ title: string; content: string; type: string; metric: string }> = [];
  try {
    const insta = await query<any>(
      `SELECT caption, full_content, video_transcript, engagement_rate, post_type
       FROM instagram_posts WHERE client_id = $1 AND content_synced_at IS NOT NULL
       ORDER BY engagement_rate DESC NULLS LAST LIMIT 3`,
      [clientId]
    );
    for (const post of insta) {
      const content = post.full_content || post.video_transcript || post.caption;
      if (content) {
        out.push({
          title: (post.caption || '').substring(0, 80) + '...',
          content: String(content).substring(0, 600),
          type: post.post_type === 'VIDEO' || post.post_type === 'reel' ? 'Reels' : 'Post',
          metric: `${((post.engagement_rate || 0) * 100).toFixed(1)}% engagement`,
        });
      }
    }
    const yt = await query<any>(
      `SELECT title, transcript, total_views FROM youtube_videos
       WHERE client_id = $1 AND transcript IS NOT NULL
       ORDER BY total_views DESC NULLS LAST LIMIT 2`,
      [clientId]
    );
    for (const v of yt) {
      if (v.transcript) {
        out.push({
          title: v.title,
          content: String(v.transcript).substring(0, 600),
          type: 'YouTube',
          metric: `${(v.total_views || 0).toLocaleString()} views`,
        });
      }
    }
  } catch (err) {
    console.error('[generate-content-v2] top performers error:', err);
  }
  return out;
}

async function fetchAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    return { data: buf.toString('base64'), mime };
  } catch {
    return null;
  }
}

function parseDataUrl(input: string): { mime: string; data: string } | null {
  const m = input.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

// =====================================================
// MAIN HANDLER
// =====================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
    const parsed = GenerateBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        res,
        400,
        `Invalid input: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    const reqBody = parsed.data as GenerateRequest;
    const { type, inputs, config, clientId } = reqBody;

    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!apiKey) return jsonError(res, 500, 'API key not configured');

    // Resolve user (may be missing on internal/cron calls — try clientId fallback)
    const user = await tryAuth(req);
    let userId: string | null = user?.id ?? null;
    // Se user logado, validar acesso ao client (defesa contra IDOR).
    // Se não logado, mantemos o fluxo legado (cron + internal).
    if (user && clientId) await assertClientAccess(user.id, clientId);
    if (!userId && clientId) {
      const c = await queryOne<any>(
        `SELECT user_id, created_by, workspace_id FROM clients WHERE id = $1`,
        [clientId]
      );
      userId = c?.user_id || c?.created_by || null;
      if (!userId && c?.workspace_id) {
        const ws = await queryOne<any>(
          `SELECT owner_id FROM workspaces WHERE id = $1`,
          [c.workspace_id]
        );
        userId = ws?.owner_id || null;
      }
    }

    // Rate limit per user (30/min) — defesa contra abuso de geração IA.
    // Cron e calls sem user passam livre (sem userId resolvido = sem cap).
    if (userId) {
      const rlKey = getRateLimitKey(req, 'gen-content-v2', userId);
      const rl = await rateLimit({ key: rlKey, limit: 30, windowMs: 60_000 });
      if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return jsonError(res, 429, `Rate limit excedido (30/min). Tente em ${rl.retryAfterSec}s.`);
      }
    }

    const brandContext = await fetchClientBrandContext(clientId || null);
    console.log('[generate-content-v2] brand:', brandContext?.name || 'none', 'client:', clientId);

    // ============ TEXT GENERATION ============
    if (type === 'text') {
      const [favorites, topPerformers, voiceSection] = await Promise.all([
        fetchFavoriteContent(clientId || null),
        fetchTopPerformers(clientId || null),
        clientId ? getStructuredVoice(clientId) : Promise.resolve(''),
      ]);

      // Build input context
      let context = '';
      let hasInstagramReference = false;
      for (const input of inputs) {
        if (input.type === 'instagram') {
          hasInstagramReference = true;
          context += `\n\n### REFERÊNCIA INSTAGRAM (USE COMO BASE PRINCIPAL):`;
          if (input.caption) context += `\n**Legenda original do post:**\n${input.caption}`;
          if (input.imageCount) context += `\n**Número de slides/imagens:** ${input.imageCount}`;
          if (input.transcription) context += `\n**Transcrição do vídeo/áudio:**\n${input.transcription}`;
          context += `\n---`;
        } else if (input.type === 'youtube') {
          context += `\n\n### REFERÊNCIA YOUTUBE:`;
          context += `\n**Transcrição:**\n${input.transcription || input.content}`;
          context += `\n---`;
        } else if (input.type === 'text') {
          context += `\n\n### Texto/Briefing do usuário:\n${input.content}`;
        } else if (input.type === 'url') {
          context += `\n\n### Conteúdo de URL:\n${input.transcription || input.content}`;
        } else if (input.type === 'image' && input.analysis) {
          context += `\n\n### Análise de Imagem:\n${JSON.stringify(input.analysis, null, 2)}`;
        } else if ((input.type === 'video' || input.type === 'audio') && input.transcription) {
          context += `\n\n### Transcrição de ${input.type === 'video' ? 'Vídeo' : 'Áudio'}:\n${input.transcription}`;
        }
      }

      // Format rules — DB first, hardcoded fallback
      const requestedFormat = config.format || 'post';
      let formatRules = '';
      try {
        const dbDocs = await getFormatDocs(requestedFormat);
        if (dbDocs && dbDocs.trim().length > 50) {
          formatRules = `## 📋 REGRAS DO FORMATO: ${requestedFormat.toUpperCase()}\n\n${dbDocs}`;
        } else {
          formatRules = getFormatRules(requestedFormat);
        }
      } catch {
        formatRules = getFormatRules(requestedFormat);
      }

      let brandSection = '';
      if (brandContext) {
        brandSection = `
## IDENTIDADE DA MARCA:
- Nome: ${brandContext.name || 'Não especificado'}
${brandContext.brandVoice ? `- Tom de voz: ${brandContext.brandVoice}` : ''}
${brandContext.values ? `- Valores: ${brandContext.values}` : ''}
${brandContext.keywords?.length ? `- Palavras-chave: ${brandContext.keywords.join(', ')}` : ''}
`;
      }

      const voiceProfileSection = voiceSection ? `\n${voiceSection}\n` : '';

      let favoritesSection = '';
      if (favorites.length > 0) {
        favoritesSection = `\n## 🎯 EXEMPLOS FAVORITOS DO CLIENTE (USE COMO REFERÊNCIA DE TOM E ESTILO)\n*Replique o tom, estrutura e linguagem:*\n\n`;
        favorites.forEach((fav, i) => {
          favoritesSection += `**Exemplo ${i + 1}: "${fav.title}"** (${fav.type})\n\`\`\`\n${fav.content}\n\`\`\`\n\n`;
        });
      }

      let performersSection = '';
      if (topPerformers.length > 0) {
        performersSection = `\n## 🏆 CONTEÚDOS DE MAIOR PERFORMANCE (USE COMO INSPIRAÇÃO)\n*Analise o que funcionou:*\n\n`;
        topPerformers.forEach((perf, i) => {
          performersSection += `**Top ${i + 1} [${perf.type}]** - ${perf.metric}\n*"${perf.title}"*\n\`\`\`\n${perf.content}\n\`\`\`\n\n`;
        });
      }

      const strictReferenceRules = hasInstagramReference
        ? `
## REGRAS ABSOLUTAS PARA REFERÊNCIA INSTAGRAM:
1. Use EXCLUSIVAMENTE o conteúdo da referência Instagram fornecida
2. NÃO invente dados, estatísticas, exemplos ou informações que não estejam nas referências
3. Mantenha o TEMA e ASSUNTO exato da referência original
4. Se for carrossel, use número similar de slides
5. Adapte a linguagem para a plataforma, mas mantenha o conteúdo fiel
6. Se a referência fala de um tema específico, NÃO mude para outro tema
`
        : '';

      let enrichmentContext = '';
      if (clientId) {
        const sp = await getSuccessPatterns(clientId);
        if (sp) enrichmentContext += sp;
      }
      const checklist = await getFormatChecklistFormatted(requestedFormat);
      if (checklist) enrichmentContext += checklist;

      const forbiddenPhrases = buildForbiddenPhrasesSection();

      const prompt = `${UNIVERSAL_OUTPUT_RULES}

${forbiddenPhrases}

Você é um copywriter especialista em criação de conteúdo para redes sociais e marketing digital.

${brandSection}${voiceProfileSection}${favoritesSection}${performersSection}${strictReferenceRules}

## CONTEXTO E REFERÊNCIAS DO USUÁRIO:
${context}

${formatRules}

${enrichmentContext}

## Formato Solicitado: ${config.format || 'post'}
## Plataforma: ${config.platform || 'instagram'}

Siga EXATAMENTE o formato de entrega especificado nas regras acima.
Gere o conteúdo agora:`;

      const modelConfig = selectModelForFormat(requestedFormat);
      const modelName = modelConfig.model;
      console.log(`[generate-content-v2] text — model=${modelName} format=${requestedFormat}`);

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: modelConfig.temperature,
              maxOutputTokens: modelConfig.maxTokens,
            },
          }),
        }
      );
      if (!r.ok) {
        const t = await r.text();
        console.error('[generate-content-v2] Gemini error:', t);
        if (r.status === 429) return jsonError(res, 429, 'Rate limit excedido. Tente novamente.');
        return jsonError(res, 500, 'Erro ao gerar conteúdo');
      }
      const aiData = await r.json();
      const generatedText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Usage logging
      if (userId) {
        const inTok = aiData?.usageMetadata?.promptTokenCount ?? estimateTokens(prompt);
        const outTok = aiData?.usageMetadata?.candidatesTokenCount ?? estimateTokens(generatedText);
        await logAIUsage(userId, modelName, 'generate-content-v2', inTok, outTok, {
          client_id: clientId, format: requestedFormat, platform: config.platform,
        });
      }

      // Thread parsing
      if (config.format === 'thread') {
        try {
          const parsedTweets: Array<{ id: string; text: string; media_urls: string[] }> = [];
          if (generatedText.includes('---')) {
            const parts = generatedText.split(/\n*---\n*/g).filter((p: string) => p.trim());
            parts.forEach((part: string, i: number) => {
              const cleanText = part
                .replace(/^Tweet\s*\d+:?\s*/i, '')
                .replace(/^\[\w+[^\]]*\]:?\s*/i, '')
                .trim();
              if (cleanText && cleanText.length > 5) {
                parsedTweets.push({ id: `tweet-${i + 1}`, text: cleanText.substring(0, 280), media_urls: [] });
              }
            });
          }
          if (parsedTweets.length < 2) {
            const numberedPattern = /(?:^|\n\n?)(\d+)[\/\.\)]\s*([^]*?)(?=\n\n?\d+[\/\.\)]|$)/g;
            let m;
            const tmp: typeof parsedTweets = [];
            while ((m = numberedPattern.exec(generatedText)) !== null) {
              const text = m[2].trim();
              if (text && text.length > 5) {
                tmp.push({ id: `tweet-${tmp.length + 1}`, text: text.substring(0, 280), media_urls: [] });
              }
            }
            if (tmp.length >= 2) { parsedTweets.length = 0; parsedTweets.push(...tmp); }
          }
          if (parsedTweets.length < 2) {
            const tweetPattern = /Tweet\s*\d+:?\s*([^]*?)(?=Tweet\s*\d+:|$)/gi;
            let m;
            const tmp: typeof parsedTweets = [];
            while ((m = tweetPattern.exec(generatedText)) !== null) {
              const text = m[1].trim();
              if (text && text.length > 5) {
                tmp.push({ id: `tweet-${tmp.length + 1}`, text: text.substring(0, 280), media_urls: [] });
              }
            }
            if (tmp.length >= 2) { parsedTweets.length = 0; parsedTweets.push(...tmp); }
          }
          if (parsedTweets.length < 2) {
            const jsonMatch = generatedText.match(/\{[\s\S]*"thread_tweets"[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const td = JSON.parse(jsonMatch[0]);
                if (Array.isArray(td.thread_tweets)) {
                  td.thread_tweets.forEach((t: any, i: number) => {
                    const text = (t.text || t.content || '').trim();
                    if (text) parsedTweets.push({ id: `tweet-${i + 1}`, text: text.substring(0, 280), media_urls: [] });
                  });
                }
              } catch { /* ignore */ }
            }
          }

          if (parsedTweets.length >= 2) {
            const cleanContent = parsedTweets
              .map((t, i) => `Tweet ${i + 1}:\n${t.text}`)
              .join('\n\n---\n\n');
            return res.status(200).json({ content: cleanContent, thread_tweets: parsedTweets });
          }
        } catch (e) {
          console.warn('[generate-content-v2] thread parsing failed:', e);
        }
      }

      return res.status(200).json({ content: generatedText });
    }

    // ============ IMAGE GENERATION ============
    // Build image prompt
    const noText = config.noText !== false;
    let prompt = '';
    if (noText) {
      prompt += `🚫 CRITICAL - ABSOLUTELY NO TEXT IN THIS IMAGE 🚫
This image MUST NOT contain ANY text, letters, numbers, or symbols (in ANY language).
Generate ONLY visual elements - no text whatsoever.

`;
    }
    prompt += `Create a professional, high-quality social media image.

QUALITY REQUIREMENTS:
- Ultra high resolution, professional photography or illustration
- Clean, polished composition with great attention to detail
- Vibrant, eye-catching colors
- Modern, sophisticated aesthetic
${noText ? '- PURE VISUAL CONTENT ONLY - NO TEXT, LETTERS, OR NUMBERS' : ''}

`;

    // Build briefing from inputs
    let briefingText = '';
    let referenceImageBase64: string | null = null;
    let styleDescription = '';
    for (const input of inputs) {
      if (input.type === 'image' && input.imageBase64) {
        referenceImageBase64 = input.imageBase64;
        if (input.analysis) {
          const a = input.analysis as any;
          if (a.generation_prompt) styleDescription += `\nREFERENCE STYLE: ${a.generation_prompt}`;
          if (a.color_palette?.dominant_colors?.length) {
            styleDescription += `\nCOLOR PALETTE: ${a.color_palette.dominant_colors.join(', ')}`;
          }
          if (a.mood_atmosphere) styleDescription += `\nMOOD: ${a.mood_atmosphere.overall_mood || ''}`;
        }
      } else if (input.type === 'text') {
        briefingText += input.content + ' ';
      } else if (input.transcription) {
        briefingText += input.transcription + ' ';
      }
    }
    if (briefingText.trim()) {
      const themeSummary = briefingText.trim().substring(0, 500);
      prompt += `VISUAL CONCEPT/THEME:
Based on this content, create a compelling visual representation:
"${themeSummary}"

`;
    }

    // Visual references from client
    const visualRefs = await fetchClientVisualReferences(clientId || null);
    const referenceImageUrls: string[] = [];
    if (visualRefs.length > 0) {
      prompt += `CLIENT VISUAL REFERENCES (match this style EXACTLY):\n`;
      for (const ref of visualRefs) {
        if (ref.imageUrl) {
          const fullUrl = ref.imageUrl.startsWith('http')
            ? ref.imageUrl
            : ref.imageUrl; // assume already-public; legacy storage paths won't resolve
          referenceImageUrls.push(fullUrl);
        }
        if (ref.styleAnalysis?.style_summary) {
          prompt += `- ${ref.type.toUpperCase()} STYLE: ${ref.styleAnalysis.style_summary}\n`;
        }
        if (ref.styleAnalysis?.visual_elements?.photography_style) {
          prompt += `  Photography: ${ref.styleAnalysis.visual_elements.photography_style}\n`;
        }
        if (ref.styleAnalysis?.visual_elements?.color_palette?.length) {
          prompt += `  Colors: ${ref.styleAnalysis.visual_elements.color_palette.join(', ')}\n`;
        }
      }
      prompt += '\n⚡ Reference images are provided as visual input. Replicate the EXACT art style, color palette, and linework.\n\n';
    }

    // Allow URL-based reference images coming from automations
    for (const input of inputs) {
      if (input.type === 'image' && input.content && !input.imageBase64) {
        if (input.content.startsWith('http') && !referenceImageUrls.includes(input.content)) {
          referenceImageUrls.push(input.content);
        }
      }
    }

    if (brandContext?.preferredStyle) prompt += `PREFERRED VISUAL STYLE: ${brandContext.preferredStyle}\n\n`;
    if (brandContext) {
      prompt += `BRAND VISUAL IDENTITY:\n`;
      if (brandContext.colorPalette?.primary) prompt += `- Primary color: ${brandContext.colorPalette.primary}\n`;
      if (brandContext.colorPalette?.secondary) prompt += `- Secondary color: ${brandContext.colorPalette.secondary}\n`;
      if (brandContext.photographyStyle) prompt += `- Photography style: ${brandContext.photographyStyle}\n`;
      if (brandContext.name) prompt += `- Brand: ${brandContext.name}\n`;
      prompt += '\n';
    }
    if (styleDescription) prompt += `STYLE MATCHING (replicate this exactly):\n${styleDescription}\n\n`;

    if (config.aspectRatio) {
      const aspectMap: Record<string, string> = {
        '1:1': 'Square format (1:1 ratio, 1024x1024px)',
        '4:5': 'Portrait format (4:5 ratio, 1024x1280px)',
        '9:16': 'Vertical/Stories format (9:16 ratio, 1080x1920px)',
        '16:9': 'Landscape format (16:9 ratio, 1920x1080px)',
      };
      prompt += `ASPECT RATIO: ${aspectMap[config.aspectRatio] || config.aspectRatio}\n\n`;
    }

    prompt += `AVOID (STRICTLY FORBIDDEN):
- Blurry or low resolution images
- Artificial-looking elements
- Overly saturated or garish colors
- Distorted proportions
${noText ? `\n⛔ CRITICAL - WILL CAUSE IMMEDIATE REJECTION:
- ANY text, letters, numbers, or symbols in any language
- Typography, fonts, or written words
- Watermarks with text
- Logos that contain text
- Decorative text, titles, captions
- ANY readable content` : ''}
`;
    if (config.preserveFace && referenceImageBase64) {
      prompt += `\nIMPORTANT: Preserve the exact facial features and characteristics of the person in the reference image.\n`;
    }

    // Build Gemini parts (multimodal)
    const parts: any[] = [];
    // user-uploaded reference (data URL)
    if (referenceImageBase64) {
      const parsed = parseDataUrl(referenceImageBase64);
      if (parsed) parts.push({ inlineData: { mimeType: parsed.mime, data: parsed.data } });
    }
    // client visual ref URLs (max 3)
    for (const url of referenceImageUrls.slice(0, 3)) {
      const f = await fetchAsBase64(url);
      if (f) parts.push({ inlineData: { mimeType: f.mime, data: f.data } });
    }
    parts.push({ text: prompt });

    // Use image-capable model
    const imageModel = visualRefs.length > 0 || config.useVisualReferences
      ? 'gemini-2.5-flash-image-preview'
      : 'gemini-2.5-flash-image-preview';

    const MAX_RETRIES = noText ? 2 : 1;
    let imageBase64: string | null = null;
    let mimeType = 'image/png';
    let lastUsageMeta: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[generate-content-v2] image attempt ${attempt}/${MAX_RETRIES} model=${imageModel}`);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`,
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
        console.error('[generate-content-v2] image API error:', r.status, t);
        if (r.status === 429) return jsonError(res, 429, 'Rate limit excedido.');
        if (attempt >= MAX_RETRIES) return jsonError(res, 500, 'Erro ao gerar imagem');
        continue;
      }
      const data = await r.json();
      lastUsageMeta = data?.usageMetadata;
      const candidateParts = data?.candidates?.[0]?.content?.parts || [];
      for (const p of candidateParts) {
        if (p.inlineData?.data) {
          mimeType = p.inlineData.mimeType || 'image/png';
          imageBase64 = p.inlineData.data;
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) return jsonError(res, 500, 'Nenhuma imagem gerada após tentativas');

    // Upload to Vercel Blob
    const buffer = Buffer.from(imageBase64, 'base64');
    const ext = mimeType.split('/')[1] || 'png';
    const path = `client-files/generated/${userId || clientId || 'automation'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    let publicUrl: string;
    try {
      const blob = await put(path, buffer, { access: 'public', contentType: mimeType, addRandomSuffix: false });
      publicUrl = blob.url;
    } catch (e) {
      console.warn('[generate-content-v2] Blob upload failed, returning base64:', e);
      publicUrl = `data:${mimeType};base64,${imageBase64}`;
    }

    if (userId) {
      const inTok = lastUsageMeta?.promptTokenCount ?? estimateTokens(prompt);
      const outTok = lastUsageMeta?.candidatesTokenCount ?? 1290;
      await logAIUsage(userId, imageModel, 'generate-content-v2', inTok, outTok, {
        client_id: clientId, type: 'image', aspectRatio: config.aspectRatio,
      });
    }

    return res.status(200).json({ imageUrl: publicUrl });
  } catch (e: any) {
    console.error('[generate-content-v2] error:', e);
    if (!res.writableEnded) jsonError(res, 500, e?.message || 'Internal error');
  }
}
