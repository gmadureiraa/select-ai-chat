// Consolidated content type detection utility
// Used by useContextualReference and QuickActionsSuggestions

export type ContentType = "idea" | "content" | "analysis" | "list" | "general";

/**
 * Detects the type of content based on text analysis
 * @param content - The text content to analyze
 * @returns The detected content type
 */
export function detectContentType(content: string): ContentType {
  const lowerContent = content.toLowerCase();
  
  // Check for analysis patterns first (high priority)
  const analysisPatterns = [
    /\b(análise|análises|analisando|analisar)\b/i,
    /\b(insight|insights)\b/i,
    /\b(métrica|métricas|kpi|kpis)\b/i,
    /\b(performance|desempenho)\b/i,
    /\b(resultado|resultados)\b/i,
    /\b(taxa de|engajamento|alcance|impressões)\b/i,
    /\b(crescimento|comparação|tendência)\b/i,
  ];
  
  if (analysisPatterns.some(pattern => pattern.test(content))) {
    return "analysis";
  }
  
  // Check for content patterns (posts, captions, scripts)
  const contentPatterns = [
    /\b(legenda|caption|post|publicação)\b/i,
    /\b(roteiro|script|texto)\b/i,
    /\b(copy|copywriting)\b/i,
    /\b(headline|título|chamada)\b/i,
    /\b(cta|call.to.action)\b/i,
  ];
  
  if (contentPatterns.some(pattern => pattern.test(content)) || content.length > 500) {
    return "content";
  }
  
  // Check for idea patterns
  const ideaPatterns = [
    /\b(ideia|ideias|sugestão|sugestões)\b/i,
    /\b(opção|opções|alternativa|alternativas)\b/i,
    /\b(proposta|propostas)\b/i,
    /\b(conceito|conceitos)\b/i,
  ];
  
  if (ideaPatterns.some(pattern => pattern.test(content))) {
    return "idea";
  }
  
  // Check for list patterns (numbered or bulleted lists)
  const listPatterns = [
    /^\s*\d+\.\s+/m,  // Numbered list
    /^\s*[-•]\s+/m,   // Bulleted list
    /\n\s*\d+\.\s+/,  // Numbered list in content
    /\n\s*[-•]\s+/,   // Bulleted list in content
  ];
  
  if (listPatterns.some(pattern => pattern.test(content))) {
    return "list";
  }
  
  return "general";
}

/**
 * Simplified content type detection for contextual reference
 * Maps to the 4 types used by useContextualReference
 */
export function detectContentTypeSimple(content: string): "idea" | "content" | "analysis" | "general" {
  const fullType = detectContentType(content);
  // Map "list" to "idea" for contextual reference purposes
  if (fullType === "list") {
    return "idea";
  }
  return fullType;
}
