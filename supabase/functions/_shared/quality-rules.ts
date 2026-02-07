// =====================================================
// QUALITY RULES - Global quality standards for content
// Version 1.0 - Part of "Impeccable Content" architecture
// =====================================================

/**
 * Global list of generic AI phrases that should NEVER appear in content.
 * These phrases make content sound robotic and impersonal.
 */
export const GLOBAL_FORBIDDEN_PHRASES = [
  // Portuguese AI-isms
  "certamente",
  "com certeza",
  "absolutamente",
  "de fato",
  "é importante notar",
  "é importante ressaltar",
  "vale ressaltar",
  "vale destacar",
  "vale a pena mencionar",
  "vamos falar sobre",
  "vamos explorar",
  "vamos descobrir",
  "aqui está",
  "aqui estão",
  "segue abaixo",
  "segue o conteúdo",
  "criei para você",
  "preparei para você",
  "espero que goste",
  "espero que ajude",
  "fique à vontade",
  "não hesite em",
  "sinta-se livre",
  "como podemos ver",
  "como mencionado",
  "conforme discutido",
  "é fundamental",
  "é crucial",
  "é essencial destacar",
  "em resumo",
  "em conclusão",
  "para concluir",
  "neste contexto",
  "nesse sentido",
  "dito isso",
  "tendo dito isso",
  "pronto!",
  "perfeito!",
  "aqui está a versão final",
  "versão final:",
  "resultado:",
  "olá rede",
  "queridos seguidores",
  "bom dia, linkedin",
  "você sabia que",
  "entenda por que",
  "descubra como",
  "aprenda a",
  
  // English AI-isms (for bilingual content)
  "certainly",
  "absolutely",
  "it's important to note",
  "it's worth mentioning",
  "let's explore",
  "let's dive into",
  "here's",
  "i hope this helps",
  "feel free to",
  "don't hesitate to",
  "as we can see",
  "as mentioned",
  "in conclusion",
  "to summarize",
  "having said that",
];

/**
 * Patterns that indicate meta-text (AI talking about the content instead of delivering it)
 */
export const META_TEXT_PATTERNS = [
  /^aqui está/i,
  /^segue/i,
  /^criei para você/i,
  /^preparei/i,
  /^segue abaixo/i,
  /^a seguir/i,
  /^esse é o conteúdo/i,
  /^essa é a newsletter/i,
  /^esse é o tweet/i,
  /^esse é o carrossel/i,
  /espero que (você )?(goste|aproveite|ajude)/i,
  /fique à vontade/i,
  /qualquer dúvida/i,
  /^olá,? rede/i,
  /^bom dia,? linkedin/i,
];

/**
 * Patterns for hashtag detection
 */
export const HASHTAG_PATTERN = /#[a-zA-Z0-9_]+/g;

/**
 * Reviewer checklist - these are the items the AI reviewer should check
 */
export const REVIEWER_CHECKLIST = [
  {
    id: "hook",
    label: "Gancho forte",
    description: "Primeira linha/segundos prendem atenção imediatamente",
    severity: "high",
  },
  {
    id: "no_ai_phrases",
    label: "Sem frases genéricas de IA",
    description: "Conteúdo não contém frases robóticas ou genéricas",
    severity: "high",
  },
  {
    id: "no_meta_text",
    label: "Sem meta-texto",
    description: "Não começa com 'Aqui está...', 'Segue...' etc",
    severity: "high",
  },
  {
    id: "no_hashtags",
    label: "Zero hashtags",
    description: "Nenhuma hashtag no conteúdo",
    severity: "high",
  },
  {
    id: "clear_cta",
    label: "CTA claro e específico",
    description: "Chamada para ação no final com verbo de ação",
    severity: "medium",
  },
  {
    id: "client_voice",
    label: "Tom do cliente",
    description: "Linguagem consistente com a voz do cliente",
    severity: "high",
  },
  {
    id: "field_limits",
    label: "Limites respeitados",
    description: "Todos os campos dentro dos limites de caracteres",
    severity: "medium",
  },
  {
    id: "required_fields",
    label: "Campos obrigatórios",
    description: "Todos os campos obrigatórios presentes",
    severity: "high",
  },
  {
    id: "format_structure",
    label: "Estrutura correta",
    description: "Segue o formato de entrega especificado",
    severity: "medium",
  },
  {
    id: "value_per_sentence",
    label: "Valor por frase",
    description: "Cada frase agrega valor real (sem preenchimento)",
    severity: "medium",
  },
];

/**
 * Build the reviewer prompt checklist section
 */
export function buildReviewerChecklist(): string {
  let checklist = `## ✅ CHECKLIST DE REVISÃO\n\n`;
  checklist += `*Verifique cada item. Se algum falhar, corrija o conteúdo.*\n\n`;
  
  for (const item of REVIEWER_CHECKLIST) {
    const icon = item.severity === "high" ? "🔴" : "🟡";
    checklist += `${icon} **${item.label}**: ${item.description}\n`;
  }
  
  return checklist;
}

/**
 * Build the forbidden phrases section for the writer prompt
 */
export function buildForbiddenPhrasesSection(): string {
  let section = `## ⛔ FRASES PROIBIDAS (NUNCA USE)\n\n`;
  
  // Group by category
  const categories = {
    "Introduções genéricas": [
      "aqui está", "segue", "criei para você", "preparei para você"
    ],
    "Comentários de IA": [
      "espero que goste", "fique à vontade", "não hesite em"
    ],
    "Fórmulas clichê": [
      "você sabia que", "descubra como", "aprenda a", "entenda por que"
    ],
    "Conectivos robóticos": [
      "certamente", "absolutamente", "é importante notar", "vale ressaltar"
    ],
    "Saudações genéricas": [
      "olá rede", "bom dia linkedin", "queridos seguidores"
    ],
  };
  
  for (const [category, phrases] of Object.entries(categories)) {
    section += `**${category}:**\n`;
    section += phrases.map(p => `❌ "${p}"`).join(" • ") + "\n\n";
  }
  
  return section;
}

/**
 * Check if content contains forbidden phrases
 */
export function checkForbiddenPhrases(content: string): string[] {
  const found: string[] = [];
  const lowerContent = content.toLowerCase();
  
  for (const phrase of GLOBAL_FORBIDDEN_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  
  return found;
}

/**
 * Check if content starts with meta-text
 */
export function checkMetaText(content: string): boolean {
  const trimmed = content.trim();
  
  for (const pattern of META_TEXT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if content contains hashtags
 */
export function checkHashtags(content: string): string[] {
  const matches = content.match(HASHTAG_PATTERN);
  return matches || [];
}

/**
 * Universal output rules that apply to ALL content
 */
export const UNIVERSAL_OUTPUT_RULES = `
## ⚠️ REGRAS CRÍTICAS DE OUTPUT

### REGRA #1: APENAS CONTEÚDO FINAL
- ❌ NUNCA escreva "Aqui está...", "Segue...", "Criei para você..."
- ❌ NUNCA explique o que você fez ou por que fez
- ❌ NUNCA inclua notas, observações ou comentários
- ✅ Comece DIRETAMENTE com o conteúdo pronto para publicar

### REGRA #2: ZERO HASHTAGS
- ❌ Hashtags são spam e datadas - NUNCA use
- ❌ Nem hashtags temáticas (#marketing) nem de marca (#nomedocliente)

### REGRA #3: TOM AUTÊNTICO
- ❌ NUNCA use frases robóticas de IA
- ❌ PROIBIDO: "certamente", "é importante notar", "vamos explorar"
- ✅ Use linguagem natural e direta
- ✅ Soe como uma pessoa real, não como ChatGPT

### REGRA #4: VALOR REAL
- ❌ Sem preenchimento ou floreios
- ✅ Cada frase deve agregar valor
- ✅ Números específicos > adjetivos vagos
`;
