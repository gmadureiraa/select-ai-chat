/**
 * content-prompts — system prompts especializados POR plataforma.
 *
 * Por que NÃO usar só `buildWriterSystemPrompt` (do prompt-builder.ts)?
 *   - O builder antigo é genérico e foi ajustado pra gerar carrosséis SV.
 *     LinkedIn long-form pediu prompt diferente (hook 2-3 linhas pré-"ver mais",
 *     parágrafos curtos, sem hashtags) — embutiu como observação solta no fim.
 *   - Twitter pediu 280 chars + thread se passa. Sem branch.
 *   - O resultado: o gerador devolve "carrossel-like" mesmo quando o briefing é
 *     LinkedIn. Bug reportado por Gabriel 2026-05-16.
 *
 * Esses prompts SOBREPÕEM ao `buildWriterSystemPrompt` adicionando regras
 * platform-specific MUITO específicas no fim do prompt. Os prompts genéricos
 * (UNIVERSAL_OUTPUT_RULES, forbidden_phrases, format contract) continuam
 * sendo usados como base.
 *
 * Padrão: cada arquivo `<platform>.ts` exporta `build<Platform>PromptSuffix()`
 * que recebe `{ briefing, tone, clientName, fewShotBlock?, platformHint? }` e
 * devolve um bloco markdown pra concatenar no system prompt.
 */

export { buildLinkedInPromptSuffix } from './linkedin.js';
export { buildTwitterPromptSuffix } from './twitter.js';
export { buildInstagramPromptSuffix } from './instagram.js';
export { buildCarouselPromptSuffix } from './carousel.js';
export { buildBlogPromptSuffix } from './blog.js';

export interface PlatformPromptInput {
  briefing: string;
  tone?: string;
  clientName: string;
  /** Bloco de few-shot examples (usar `buildFewShotExamples`). */
  fewShotBlock?: string;
  /** Bloco com cadência histórica (usar `buildPlatformPreferenceHint`). */
  platformHint?: string;
}

export type PlatformPromptBuilder = (input: PlatformPromptInput) => string;

/**
 * Resolve o builder correto pra um par (platform, format). Retorna `null` se
 * não tem builder específico — caller faz fallback pro prompt genérico.
 */
export async function resolvePlatformPromptBuilder(
  platform: string,
  format: string,
): Promise<PlatformPromptBuilder | null> {
  const p = platform.toLowerCase();
  const f = format.toLowerCase();

  // Formato carrossel ganha prioridade qualquer que seja a plataforma — usa
  // template de carousel direto.
  if (
    f.includes('carousel') ||
    f.includes('carrossel') ||
    f.includes('carrosel')
  ) {
    const { buildCarouselPromptSuffix } = await import('./carousel.js');
    return buildCarouselPromptSuffix;
  }

  // Thread (twitter ou X) → builder twitter (suporta thread)
  if (f.includes('thread') || f.includes('fio')) {
    const { buildTwitterPromptSuffix } = await import('./twitter.js');
    return buildTwitterPromptSuffix;
  }

  // Blog / artigo / newsletter long-form
  if (
    f.includes('blog') ||
    f.includes('artigo') ||
    f.includes('newsletter') ||
    f.includes('long')
  ) {
    const { buildBlogPromptSuffix } = await import('./blog.js');
    return buildBlogPromptSuffix;
  }

  // Roteamento por plataforma
  if (p === 'linkedin') {
    const { buildLinkedInPromptSuffix } = await import('./linkedin.js');
    return buildLinkedInPromptSuffix;
  }
  if (p === 'twitter' || p === 'x') {
    const { buildTwitterPromptSuffix } = await import('./twitter.js');
    return buildTwitterPromptSuffix;
  }
  if (p === 'instagram') {
    const { buildInstagramPromptSuffix } = await import('./instagram.js');
    return buildInstagramPromptSuffix;
  }

  return null;
}
