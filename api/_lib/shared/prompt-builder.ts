// =====================================================
// PROMPT BUILDER (Node port)
// Ported from supabase/functions/_shared/prompt-builder.ts
// =====================================================
import {
  getFullContentContext,
  getStructuredVoice,
  normalizeFormatKey,
} from './knowledge-loader.js';
import {
  buildForbiddenPhrasesSection,
  UNIVERSAL_OUTPUT_RULES,
} from './quality-rules.js';
import { buildFormatContract } from './format-schemas.js';
import { loadAndBuildFormatPrompt } from './format-standards.js';

export interface PromptBuilderParams {
  clientId: string;
  format: string;
  workspaceId?: string;
  includeVoice?: boolean;
  includeLibrary?: boolean;
  includePerformers?: boolean;
  includeGlobalKnowledge?: boolean;
  includeSuccessPatterns?: boolean;
  includeChecklist?: boolean;
  variationContext?: {
    category: string;
    instruction: string;
    recentPosts: string[];
  };
  researchBriefing?: string;
  additionalMaterial?: string;
  maxLibraryExamples?: number;
  maxTopPerformers?: number;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

const COMPLEX_FORMATS = [
  'carousel', 'newsletter', 'blog_post', 'long_video',
  'x_article', 'case_study', 'email_marketing',
];
const CREATIVE_FORMATS = ['tweet', 'thread', 'social_post', 'short_video', 'stories'];
const PROFESSIONAL_FORMATS = ['linkedin_post', 'linkedin'];
const FACTUAL_FORMATS = ['btc_price', 'crypto_update'];

export function getTemperatureForFormat(format: string): number {
  const normalized = normalizeFormatKey(format);
  if (FACTUAL_FORMATS.includes(normalized)) return 0.6;
  if (COMPLEX_FORMATS.includes(normalized)) return 0.8;
  if (PROFESSIONAL_FORMATS.includes(normalized)) return 0.8;
  if (CREATIVE_FORMATS.includes(normalized)) return 0.9;
  return 0.7;
}

export function selectModelForFormat(format: string): ModelConfig {
  const normalized = normalizeFormatKey(format);
  const isComplex = COMPLEX_FORMATS.includes(normalized);
  return {
    model: isComplex ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
    temperature: getTemperatureForFormat(normalized),
    maxTokens: isComplex ? 8192 : 4096,
  };
}

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

  parts.push(`# VOCÊ É UM COPYWRITER ESPECIALISTA\n`);
  parts.push(UNIVERSAL_OUTPUT_RULES);

  const formatContract = buildFormatContract(normalizedFormat);
  if (formatContract) parts.push(formatContract);

  parts.push(buildForbiddenPhrasesSection());

  if (includeVoice) {
    const voiceSection = await getStructuredVoice(clientId);
    if (voiceSection) parts.push(voiceSection);
  }

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
  if (fullContext) parts.push(fullContext);

  if (variationContext) {
    let variationBlock = `\n## 🎲 ESTILO EDITORIAL OBRIGATÓRIO\n`;
    variationBlock += `**Categoria:** ${variationContext.category}\n`;
    variationBlock += `**Instrução:** ${variationContext.instruction}\n`;
    if (variationContext.recentPosts.length > 0) {
      variationBlock += `\n### 🚫 ANTI-EXEMPLOS (NÃO repita estes padrões):\n`;
      variationContext.recentPosts.forEach((post, i) => {
        variationBlock += `${i + 1}. "${post.substring(0, 300)}"\n`;
      });
      variationBlock += `\n⚠️ Seu conteúdo DEVE ser fundamentalmente DIFERENTE dos exemplos acima.\n`;
    }
    parts.push(variationBlock);
  }

  if (researchBriefing) {
    parts.push(`\n## 🔬 PESQUISA E DADOS EM TEMPO REAL\n${researchBriefing}\n`);
  }

  if (additionalMaterial) {
    parts.push(`\n## 📎 MATERIAL DE REFERÊNCIA FORNECIDO\n${additionalMaterial.substring(0, 15000)}\n`);
  }

  // Camada 1+2 (format_specs × client_format_standards) — enriquecimento opcional.
  // Migration 0040. Se não houver spec pro par (client, format), retorna "" e nada
  // é adicionado. Posicionado no fim do bloco de contexto pra ficar próximo do
  // ## TAREFA — facilita o modelo a usar as regras na hora de gerar.
  const formatStandardBlock = await loadAndBuildFormatPrompt(clientId, normalizedFormat);
  if (formatStandardBlock) parts.push(formatStandardBlock);

  parts.push(`\n## TAREFA\nCrie conteúdo seguindo RIGOROSAMENTE o formato de entrega acima.\nSeu output deve conter APENAS o conteúdo final - nada de explicações.`);

  return parts.join('\n\n');
}

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
    imageStyle,
    visualIdentity,
    visualRefDescriptions,
  } = params;

  const parts: string[] = [];

  if (visualIdentity) parts.push(`IDENTIDADE VISUAL DO CLIENTE:\n${visualIdentity}`);
  if (visualRefDescriptions && visualRefDescriptions.length > 0) {
    parts.push(`REFERÊNCIAS DE ESTILO: ${visualRefDescriptions.join('; ')}`);
  }

  if (customPrompt) {
    parts.push(`CONTEÚDO DO POST: ${customPrompt}`);
  } else if (generatedContent) {
    const contentStart = generatedContent.substring(0, 500).replace(/\n/g, ' ');
    const contentEnd = generatedContent.length > 700
      ? generatedContent.substring(generatedContent.length - 200).replace(/\n/g, ' ')
      : '';
    parts.push(`ESSÊNCIA DO CONTEÚDO: "${contentStart}"${contentEnd ? `\n\nMENSAGEM FINAL: "${contentEnd}"` : ''}`);
  } else if (title) {
    parts.push(`TEMA: ${title}`);
  }

  const styleMap: Record<string, string> = {
    photographic: 'Professional photography, ultra realistic, natural lighting, high resolution, editorial quality',
    illustration: 'Digital illustration, artistic, clean vector aesthetic, modern design, bold shapes',
    minimalist: 'Minimalist design, clean composition, generous white space, elegant, refined',
    vibrant: 'Vibrant colors, high contrast, bold and energetic, eye-catching, dynamic composition',
  };
  parts.push(`ESTILO: ${styleMap[imageStyle || ''] || styleMap['photographic']}`);

  const formatMap: Record<string, string> = {
    twitter: '1:1 square format (1080x1080px)',
    linkedin: '1.91:1 landscape format (1200x628px)',
    instagram: '1:1 square format (1080x1080px)',
    threads: '1:1 square format (1080x1080px)',
    stories: '9:16 vertical format (1080x1920px)',
  };
  const platformFormat = formatMap[platform || ''] || formatMap['instagram'];
  parts.push(`FORMATO: ${platformFormat}`);

  parts.push(`REGRAS ABSOLUTAS DE IMAGEM:
- NÃO coloque NENHUM texto, palavra, letra ou número na imagem
- NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WATERMARKS
- Nem texto decorativo, nem logos com texto, nem caracteres de qualquer idioma
- A imagem deve ser PURAMENTE visual — zero elementos tipográficos
- Composição limpa, profissional, com ponto focal claro
- Transmita a emoção e conceito do conteúdo VISUALMENTE, sem palavras`);

  return parts.join('\n\n');
}
