// Hook para detecção automática de formato de imagem baseado no contexto
// Sprint 4: Formato Visual Automático

export interface ImageFormatResult {
  format: string;
  aspectRatio: string;
  dimensions: { width: number; height: number };
  platform: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// Padrões para detectar plataforma/formato mencionados
const platformPatterns: { pattern: RegExp; platform: string; format: string; aspectRatio: string }[] = [
  // Stories (9:16 vertical)
  { pattern: /\b(stories?|story)\b/i, platform: 'instagram', format: 'stories', aspectRatio: '9:16' },
  { pattern: /\b(reels?)\b/i, platform: 'instagram', format: 'reels', aspectRatio: '9:16' },
  { pattern: /\b(shorts?)\b/i, platform: 'youtube', format: 'shorts', aspectRatio: '9:16' },
  { pattern: /\btiktok\b/i, platform: 'tiktok', format: 'vertical', aspectRatio: '9:16' },
  
  // Posts quadrados/feed (1:1 ou 4:5)
  { pattern: /\b(post|feed)\s*(do\s*)?(instagram|insta)\b/i, platform: 'instagram', format: 'post', aspectRatio: '1:1' },
  { pattern: /\binstagram\s*(post|feed)?\b/i, platform: 'instagram', format: 'post', aspectRatio: '1:1' },
  { pattern: /\bcarrossel\b/i, platform: 'instagram', format: 'carousel', aspectRatio: '1:1' },
  { pattern: /\bcarousel\b/i, platform: 'instagram', format: 'carousel', aspectRatio: '1:1' },
  
  // LinkedIn (1.91:1 horizontal ou 1:1)
  { pattern: /\blinkedin\b/i, platform: 'linkedin', format: 'linkedin', aspectRatio: '1.91:1' },
  
  // Twitter/X (16:9 horizontal)
  { pattern: /\b(twitter|tweet|x\s+post)\b/i, platform: 'twitter', format: 'twitter', aspectRatio: '16:9' },
  
  // YouTube (16:9 horizontal)
  { pattern: /\b(youtube|thumbnail|miniatura)\b/i, platform: 'youtube', format: 'thumbnail', aspectRatio: '16:9' },
  { pattern: /\bcapa\s*(de\s*)?(v[íi]deo|youtube)\b/i, platform: 'youtube', format: 'thumbnail', aspectRatio: '16:9' },
  
  // Pinterest (2:3 vertical)
  { pattern: /\bpinterest\b/i, platform: 'pinterest', format: 'pin', aspectRatio: '2:3' },
  
  // Blog/Website (16:9 ou 3:2)
  { pattern: /\b(blog|artigo|header|banner)\b/i, platform: 'web', format: 'banner', aspectRatio: '16:9' },
  { pattern: /\b(og\s*image|share|compartilhar)\b/i, platform: 'web', format: 'og', aspectRatio: '1.91:1' },
];

// Padrões para detectar tipo de conteúdo que implica formato
const contentTypePatterns: { pattern: RegExp; format: string; aspectRatio: string }[] = [
  // Vertical
  { pattern: /\b(vertical|retrato|portrait)\b/i, format: 'vertical', aspectRatio: '9:16' },
  { pattern: /\b(celular|mobile|smartphone)\b/i, format: 'mobile', aspectRatio: '9:16' },
  
  // Quadrado
  { pattern: /\b(quadrad[oa]|square)\b/i, format: 'square', aspectRatio: '1:1' },
  
  // Horizontal
  { pattern: /\b(horizontal|paisagem|landscape|widescreen)\b/i, format: 'horizontal', aspectRatio: '16:9' },
  { pattern: /\b(wide|largo)\b/i, format: 'wide', aspectRatio: '16:9' },
];

// Mapa de aspect ratio para dimensões
const aspectRatioDimensions: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 1024, height: 1280 },
  '9:16': { width: 1024, height: 1820 },
  '16:9': { width: 1792, height: 1024 },
  '2:3': { width: 1024, height: 1536 },
  '3:2': { width: 1536, height: 1024 },
  '1.91:1': { width: 1200, height: 628 },
};

// Detectar formato a partir do texto (prompt do usuário ou conteúdo anterior)
export function detectFormatFromText(text: string): ImageFormatResult | null {
  // Primeiro verificar padrões de plataforma específicos
  for (const { pattern, platform, format, aspectRatio } of platformPatterns) {
    if (pattern.test(text)) {
      return {
        format,
        aspectRatio,
        dimensions: aspectRatioDimensions[aspectRatio] || aspectRatioDimensions['1:1'],
        platform,
        confidence: 'high',
        reason: `Detectado formato para ${platform}`,
      };
    }
  }
  
  // Depois verificar tipo de conteúdo genérico
  for (const { pattern, format, aspectRatio } of contentTypePatterns) {
    if (pattern.test(text)) {
      return {
        format,
        aspectRatio,
        dimensions: aspectRatioDimensions[aspectRatio] || aspectRatioDimensions['1:1'],
        platform: null,
        confidence: 'medium',
        reason: `Detectado formato ${format}`,
      };
    }
  }
  
  return null;
}

// Detectar formato baseado no template ativo
export function detectFormatFromTemplate(templateName?: string): ImageFormatResult | null {
  if (!templateName) return null;
  
  const templateLower = templateName.toLowerCase();
  
  // Mapeamento de templates para formatos
  const templateFormats: Record<string, { format: string; aspectRatio: string; platform: string }> = {
    'stories': { format: 'stories', aspectRatio: '9:16', platform: 'instagram' },
    'story': { format: 'stories', aspectRatio: '9:16', platform: 'instagram' },
    'reels': { format: 'reels', aspectRatio: '9:16', platform: 'instagram' },
    'carrossel': { format: 'carousel', aspectRatio: '1:1', platform: 'instagram' },
    'carousel': { format: 'carousel', aspectRatio: '1:1', platform: 'instagram' },
    'post': { format: 'post', aspectRatio: '1:1', platform: 'instagram' },
    'feed': { format: 'post', aspectRatio: '1:1', platform: 'instagram' },
    'linkedin': { format: 'linkedin', aspectRatio: '1.91:1', platform: 'linkedin' },
    'twitter': { format: 'twitter', aspectRatio: '16:9', platform: 'twitter' },
    'tweet': { format: 'twitter', aspectRatio: '16:9', platform: 'twitter' },
    'thread': { format: 'twitter', aspectRatio: '16:9', platform: 'twitter' },
    'youtube': { format: 'thumbnail', aspectRatio: '16:9', platform: 'youtube' },
    'thumbnail': { format: 'thumbnail', aspectRatio: '16:9', platform: 'youtube' },
    'blog': { format: 'banner', aspectRatio: '16:9', platform: 'web' },
    'newsletter': { format: 'banner', aspectRatio: '16:9', platform: 'email' },
  };
  
  for (const [key, value] of Object.entries(templateFormats)) {
    if (templateLower.includes(key)) {
      return {
        ...value,
        dimensions: aspectRatioDimensions[value.aspectRatio] || aspectRatioDimensions['1:1'],
        confidence: 'high',
        reason: `Template "${templateName}" implica formato ${value.format}`,
      };
    }
  }
  
  return null;
}

// Detectar formato do conteúdo do assistente (posts gerados, ideias, etc.)
export function detectFormatFromContent(assistantContent: string): ImageFormatResult | null {
  // Verificar se o conteúdo menciona plataforma específica
  const textResult = detectFormatFromText(assistantContent);
  if (textResult) return textResult;
  
  // Analisar estrutura do conteúdo para inferir formato
  const lines = assistantContent.split('\n').filter(l => l.trim());
  
  // Muitos slides/partes = carrossel
  const slidePatterns = /\b(slide|p[aá]gina|cart[aã]o|card)\s*\d+/gi;
  const slideMatches = assistantContent.match(slidePatterns);
  if (slideMatches && slideMatches.length >= 3) {
    return {
      format: 'carousel',
      aspectRatio: '1:1',
      dimensions: aspectRatioDimensions['1:1'],
      platform: 'instagram',
      confidence: 'medium',
      reason: 'Conteúdo com múltiplos slides detectado',
    };
  }
  
  // Thread = múltiplos tweets numerados
  const tweetPattern = /\b(tweet|post)\s*\d+|^\d+[.)\-]/gm;
  const tweetMatches = assistantContent.match(tweetPattern);
  if (tweetMatches && tweetMatches.length >= 3) {
    return {
      format: 'twitter',
      aspectRatio: '16:9',
      dimensions: aspectRatioDimensions['16:9'],
      platform: 'twitter',
      confidence: 'medium',
      reason: 'Thread com múltiplos posts detectada',
    };
  }
  
  return null;
}

// Função principal que combina todas as detecções
export function autoDetectImageFormat(
  userPrompt: string,
  assistantContent?: string,
  templateName?: string
): ImageFormatResult {
  // 1. Prioridade máxima: menção explícita no prompt do usuário
  const userResult = detectFormatFromText(userPrompt);
  if (userResult && userResult.confidence === 'high') {
    return userResult;
  }
  
  // 2. Template ativo
  const templateResult = detectFormatFromTemplate(templateName);
  if (templateResult) {
    return templateResult;
  }
  
  // 3. Conteúdo anterior do assistente
  if (assistantContent) {
    const contentResult = detectFormatFromContent(assistantContent);
    if (contentResult) {
      return contentResult;
    }
  }
  
  // 4. Prompt do usuário com confiança média
  if (userResult) {
    return userResult;
  }
  
  // 5. Fallback: formato padrão quadrado (mais versátil)
  return {
    format: 'default',
    aspectRatio: '1:1',
    dimensions: aspectRatioDimensions['1:1'],
    platform: null,
    confidence: 'low',
    reason: 'Formato padrão (nenhuma plataforma específica detectada)',
  };
}

// Hook React para usar a detecção automática
export function useAutoImageFormat() {
  return {
    autoDetectImageFormat,
    detectFormatFromText,
    detectFormatFromTemplate,
    detectFormatFromContent,
    aspectRatioDimensions,
  };
}
