// =====================================================
// PROMPT BUILDER - Centralized prompt construction
// Single source of truth for ALL content generation
// Used by: kai-content-agent, generate-content-v2,
//          process-automations, unified-content-api
// =====================================================

import {
  getFullContentContext,
  getStructuredVoice,
  getClientAvoidList,
  normalizeFormatKey,
} from "./knowledge-loader.ts";

import {
  buildForbiddenPhrasesSection,
  UNIVERSAL_OUTPUT_RULES,
} from "./quality-rules.ts";

import { buildFormatContract, getFormatSchema } from "./format-schemas.ts";

// =====================================================
// TYPES
// =====================================================

export interface PromptBuilderParams {
  clientId: string;
  format: string;
  workspaceId?: string;
  /** Include Voice Profile (Use/Avoid). Default: true */
  includeVoice?: boolean;
  /** Include library examples. Default: true */
  includeLibrary?: boolean;
  /** Include top performers. Default: true */
  includePerformers?: boolean;
  /** Include global knowledge. Default: true */
  includeGlobalKnowledge?: boolean;
  /** Include success patterns. Default: true */
  includeSuccessPatterns?: boolean;
  /** Include format checklist. Default: false (use external validation) */
  includeChecklist?: boolean;
  /** Editorial variation context (for anti-repetition) */
  variationContext?: {
    category: string;
    instruction: string;
    recentPosts: string[];
  };
  /** Deep research briefing (for newsletters, etc) */
  researchBriefing?: string;
  /** Additional material from user/frontend */
  additionalMaterial?: string;
  /** Max library examples. Default: 3 */
  maxLibraryExamples?: number;
  /** Max top performers. Default: 3 */
  maxTopPerformers?: number;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

// =====================================================
// MODEL SELECTION
// =====================================================

const COMPLEX_FORMATS = [
  'carousel', 'newsletter', 'blog_post', 'long_video',
  'x_article', 'case_study', 'email_marketing',
];

/**
 * Select the best model + config based on format complexity
 */
export function selectModelForFormat(format: string): ModelConfig {
  const normalized = normalizeFormatKey(format);
  const isComplex = COMPLEX_FORMATS.includes(normalized);

  return {
    model: isComplex ? 'gemini-2.5-pro-preview-06-05' : 'gemini-2.5-flash',
    temperature: isComplex ? 0.8 : 0.7,
    maxTokens: isComplex ? 8192 : 4096,
  };
}

// =====================================================
// MAIN BUILDER
// =====================================================

/**
 * Build a complete, consistent system prompt for ANY content generation context.
 * This is the SINGLE SOURCE OF TRUTH — all agents should use this.
 *
 * Layers (in order):
 * 1. Universal Output Rules (no meta-text, no hashtags, authentic tone)
 * 2. Format Contract (field specs + output template)
 * 3. Forbidden Phrases (expanded list)
 * 4. Voice Profile (Use/Avoid per client)
 * 5. Full Content Context (identity, library, performers, knowledge)
 * 6. Variation Context (optional, for anti-repetition)
 * 7. Research Briefing (optional, for data-driven formats)
 * 8. Additional Material (optional, user-provided)
 */
export async function buildWriterSystemPrompt(params: PromptBuilderParams): Promise<string> {
  const {
    clientId,
    format,
    workspaceId,
    includeVoice = true,
    includeLibrary = true,
    includePerformers = true,
    includeGlobalKnowledge = true,
    includeSuccessPatterns = true,
    includeChecklist = false,
    variationContext,
    researchBriefing,
    additionalMaterial,
    maxLibraryExamples = 3,
    maxTopPerformers = 3,
  } = params;

  const normalizedFormat = normalizeFormatKey(format);
  const parts: string[] = [];

  // ---- Layer 1: Universal Rules ----
  parts.push(`# VOCÊ É UM COPYWRITER ESPECIALISTA\n`);
  parts.push(UNIVERSAL_OUTPUT_RULES);

  // ---- Layer 2: Format Contract ----
  const formatContract = buildFormatContract(normalizedFormat);
  if (formatContract) {
    parts.push(formatContract);
  }

  // ---- Layer 3: Forbidden Phrases ----
  parts.push(buildForbiddenPhrasesSection());

  // ---- Layer 4: Voice Profile ----
  if (includeVoice) {
    const voiceSection = await getStructuredVoice(clientId);
    if (voiceSection) {
      parts.push(voiceSection);
    }
  }

  // ---- Layer 5: Full Content Context ----
  const fullContext = await getFullContentContext({
    clientId,
    format: normalizedFormat,
    workspaceId,
    includeLibrary,
    includeTopPerformers: includePerformers,
    includeGlobalKnowledge,
    includeSuccessPatterns,
    includeChecklist,
    maxLibraryExamples,
    maxTopPerformers,
  });
  if (fullContext) {
    parts.push(fullContext);
  }

  // ---- Layer 6: Variation Context (anti-repetition) ----
  if (variationContext) {
    let variationBlock = `\n## 🎲 ESTILO EDITORIAL OBRIGATÓRIO\n`;
    variationBlock += `**Categoria:** ${variationContext.category}\n`;
    variationBlock += `**Instrução:** ${variationContext.instruction}\n`;

    if (variationContext.recentPosts.length > 0) {
      variationBlock += `\n### 🚫 ANTI-EXEMPLOS (NÃO repita estes padrões):\n`;
      variationContext.recentPosts.forEach((post, i) => {
        variationBlock += `${i + 1}. "${post.substring(0, 200)}"\n`;
      });
      variationBlock += `\n⚠️ Seu conteúdo DEVE ser fundamentalmente DIFERENTE dos exemplos acima.\n`;
    }
    parts.push(variationBlock);
  }

  // ---- Layer 7: Research Briefing ----
  if (researchBriefing) {
    parts.push(`\n## 🔬 PESQUISA E DADOS EM TEMPO REAL\n${researchBriefing}\n`);
  }

  // ---- Layer 8: Additional Material ----
  if (additionalMaterial) {
    parts.push(`\n## 📎 MATERIAL DE REFERÊNCIA FORNECIDO\n${additionalMaterial.substring(0, 15000)}\n`);
  }

  // ---- Final instruction ----
  parts.push(`\n## TAREFA\nCrie conteúdo seguindo RIGOROSAMENTE o formato de entrega acima.\nSeu output deve conter APENAS o conteúdo final - nada de explicações.`);

  return parts.join('\n\n');
}

// =====================================================
// IMAGE BRIEFING BUILDER
// =====================================================

/**
 * Build a contextual image generation briefing based on:
 * - Generated content themes
 * - Visual identity
 * - Platform format requirements
 * - Visual references
 */
export function buildImageBriefing(params: {
  generatedContent?: string;
  title?: string;
  customPrompt?: string;
  platform?: string;
  contentType?: string;
  imageStyle?: string;
  visualIdentity?: string;
  visualRefDescriptions?: string[];
}): string {
  const {
    generatedContent,
    title,
    customPrompt,
    platform,
    contentType,
    imageStyle,
    visualIdentity,
    visualRefDescriptions,
  } = params;

  const parts: string[] = [];

  // Visual identity from client
  if (visualIdentity) {
    parts.push(`IDENTIDADE VISUAL DO CLIENTE:\n${visualIdentity}`);
  }

  // Visual reference descriptions
  if (visualRefDescriptions && visualRefDescriptions.length > 0) {
    parts.push(`REFERÊNCIAS DE ESTILO: ${visualRefDescriptions.join('; ')}`);
  }

  // Content theme extraction - use more than just 200 chars
  if (customPrompt) {
    parts.push(`CONTEÚDO DO POST: ${customPrompt}`);
  } else if (generatedContent) {
    // Extract key themes from generated content (first 500 chars + last 200 chars for CTA context)
    const contentStart = generatedContent.substring(0, 500).replace(/\n/g, ' ');
    const contentEnd = generatedContent.length > 700
      ? generatedContent.substring(generatedContent.length - 200).replace(/\n/g, ' ')
      : '';
    parts.push(`ESSÊNCIA DO CONTEÚDO: "${contentStart}"${contentEnd ? `\n\nMENSAGEM FINAL: "${contentEnd}"` : ''}`);
  } else if (title) {
    parts.push(`TEMA: ${title}`);
  }

  // Style modifier
  const styleMap: Record<string, string> = {
    'photographic': 'Professional photography, ultra realistic, natural lighting, high resolution, editorial quality',
    'illustration': 'Digital illustration, artistic, clean vector aesthetic, modern design, bold shapes',
    'minimalist': 'Minimalist design, clean composition, generous white space, elegant, refined',
    'vibrant': 'Vibrant colors, high contrast, bold and energetic, eye-catching, dynamic composition',
  };
  parts.push(`ESTILO: ${styleMap[imageStyle || ''] || styleMap['photographic']}`);

  // Platform-specific format
  const formatMap: Record<string, string> = {
    'twitter': '1:1 square format (1080x1080px)',
    'linkedin': '1.91:1 landscape format (1200x628px)',
    'instagram': '1:1 square format (1080x1080px)',
    'threads': '1:1 square format (1080x1080px)',
    'stories': '9:16 vertical format (1080x1920px)',
  };
  const platformFormat = formatMap[platform || ''] || formatMap['instagram'];
  parts.push(`FORMATO: ${platformFormat}`);

  // Enhanced no-text instruction
  parts.push(`REGRAS ABSOLUTAS DE IMAGEM:
- NÃO coloque NENHUM texto, palavra, letra ou número na imagem
- NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WATERMARKS
- Nem texto decorativo, nem logos com texto, nem caracteres de qualquer idioma
- A imagem deve ser PURAMENTE visual — zero elementos tipográficos
- Composição limpa, profissional, com ponto focal claro
- Transmita a emoção e conceito do conteúdo VISUALMENTE, sem palavras`);

  return parts.join('\n\n');
}
