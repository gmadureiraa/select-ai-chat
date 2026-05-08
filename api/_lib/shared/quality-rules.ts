// =====================================================
// QUALITY RULES - Global quality standards for content
// Version 1.0 - Part of "Impeccable Content" architecture
// =====================================================

/**
 * Global list of generic AI phrases that should NEVER appear in content.
 * These phrases make content sound robotic and impersonal.
 */
export const GLOBAL_FORBIDDEN_PHRASES = [
  // Portuguese AI-isms - Original
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
  
  // NEW: Expanded Portuguese AI-isms
  "você vai descobrir",
  "neste post",
  "hoje vamos falar",
  "sem dúvida",
  "incrível",
  "extraordinário",
  "simplesmente",
  "basicamente",
  "literalmente",
  "super importante",
  "muito importante",
  "extremamente",
  "impressionante",
  "maravilhoso",
  "fantástico",
  "sensacional",
  "imperdível",
  "confira",
  "não perca",
  "corre que",
  "bora lá",
  "vem comigo",
  "vem conferir",
  "fica ligado",
  "anota aí",
  "se liga",
  "top demais",
  "demais né",
  "né gente",
  "pessoal",
  "galera",
  "gente",
  "meu povo",
  "amigos",
  "queridos",
  "antes de mais nada",
  "primeiramente",
  "por fim",
  "finalmente",
  "em primeiro lugar",
  "em segundo lugar",
  "além disso",
  "ademais",
  "outrossim",
  "destarte",
  "portanto",
  "sendo assim",
  "dessa forma",
  "desta forma",
  "diante disso",
  "diante do exposto",
  "tendo em vista",
  "levando em consideração",
  "é válido ressaltar",
  "cabe destacar",
  "faz-se necessário",
  "torna-se evidente",
  
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
  
  // NEW: Expanded English AI-isms
  "delve into",
  "deep dive",
  "game-changer",
  "groundbreaking",
  "revolutionary",
  "cutting-edge",
  "state-of-the-art",
  "next-level",
  "must-read",
  "must-see",
  "hot take",
  "pro tip",
  "life hack",
  "mindblowing",
  "mind-blowing",
  "incredible",
  "amazing",
  "awesome",
  "fantastic",
  "wonderful",
];

/**
 * Common decorative emojis that should NOT appear in professional content body
 * These are allowed ONLY in CTA final when appropriate
 */
export const FORBIDDEN_DECORATIVE_EMOJIS = [
  "💡", // Lamp/idea - very common AI pattern
  "🔥", // Fire - overused
  "✨", // Sparkles - decorative
  "🚀", // Rocket - cliché
  "💰", // Money bag - salesy
  "📈", // Chart up - generic
  "💼", // Briefcase - corporate
  "🎯", // Target - overused
  "💪", // Muscle - motivational cliché
  "🏆", // Trophy - cliché
  "⭐", // Star - generic
  "🌟", // Glowing star - generic
  "💎", // Gem - salesy
  "🔑", // Key - cliché
  "📌", // Pin - decorative
  "⚡", // Lightning - decorative
  "🎉", // Party - out of place in professional content
  "👇", // Point down - overused
  "👆", // Point up - overused
  "👉", // Point right - overused
  "🤔", // Thinking - decorative
  "💭", // Thought bubble - decorative
  "📊", // Bar chart - generic
  "🧠", // Brain - cliché
  "❗", // Exclamation - unnecessary
  "‼️", // Double exclamation - spam-like
  "⁉️", // Exclamation question - spam-like
];

/**
 * Structural AI patterns - formulaic structures that make content sound robotic
 * These are regex patterns that detect STRUCTURE, not just phrases
 */
export const STRUCTURAL_AI_PATTERNS: Array<{ pattern: RegExp; name: string; description: string }> = [
  // "Hot take:" opener
  { pattern: /^hot take[:\s]/im, name: 'hot_take_opener', description: 'Abertura "Hot take:" é clichê de IA' },
  // "O que X não falam/dizem" pattern
  { pattern: /o que (?:a maioria|poucos|ninguém|founders?|marketers?|pessoas) (?:não )?(?:falam?|dizem?|contam?|sabem?)/i, name: 'what_people_dont_say', description: 'Padrão "O que X não falam" é genérico' },
  // "Aqui está o que funciona/aprendi" 
  { pattern: /aqui está o que (?:funciona|eu aprendi|descobri|importa)/i, name: 'here_is_what', description: 'Padrão "Aqui está o que..." é robótico' },
  // Suspicious round numbers without source
  { pattern: /(?:mais de |over |\+)\d{2,3}(?:\.000|\+| mil| empresas| clientes| projetos| agências| marketers| founders| builders)/i, name: 'suspicious_round_numbers', description: 'Números redondos suspeitamente inventados' },
  // Percentage claims without source
  { pattern: /\b(?:9[0-9]|8[5-9])%\s*(?:dos?|das?|de|of)\s*(?:founders?|empresas|marketers?|builders?|projetos|pessoas)/i, name: 'suspicious_percentages', description: 'Percentuais altos sem fonte são provavelmente inventados' },
  // "X vs Y" contrast list pattern (bullet-based)
  { pattern: /(?:fazem|faz)\s+X[\s\S]*?(?:não fazem|não faz)\s+Y/i, name: 'contrast_list', description: 'Padrão de lista de contrastes "fazem X / não fazem Y"' },
  // Opening with "[Person] fez/criou/construiu [impressive thing]"
  { pattern: /^(?:um |uma |o |a )?(?:founder|ceo|empreendedor|criador|desenvolvedor)\s+(?:que |de \d+)\s/im, name: 'person_achievement_opener', description: 'Abertura "Um founder que fez X" é genérica' },
  // "A verdade é que..." / "A realidade é que..."
  { pattern: /^(?:a verdade|a realidade|o fato)\s+é\s+que/im, name: 'truth_is_opener', description: 'Abertura "A verdade é que..." é clichê' },
  // "Unpopular opinion:" opener
  { pattern: /^unpopular opinion[:\s]/im, name: 'unpopular_opinion', description: 'Abertura "Unpopular opinion:" é clichê de IA' },
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
/**
 * Check if content contains structural AI patterns
 */
export function checkStructuralPatterns(content: string): Array<{ name: string; description: string }> {
  const found: Array<{ name: string; description: string }> = [];
  
  for (const { pattern, name, description } of STRUCTURAL_AI_PATTERNS) {
    if (pattern.test(content)) {
      found.push({ name, description });
    }
  }
  
  return found;
}

/**
 * Analyze content structure to detect repetitive patterns
 * Returns detected structural patterns for anti-example injection
 */
export function detectContentStructure(content: string): string[] {
  const patterns: string[] = [];
  
  // Check for opening with question
  if (/^[^\n]{0,5}[?¿]/.test(content.trim()) || /^.{5,80}\?/m.test(content.split('\n')[0])) {
    patterns.push('Abertura com pergunta');
  }
  
  // Check for bullet/list-heavy structure
  const bulletCount = (content.match(/^[\s]*[-•●▸]\s/gm) || []).length;
  if (bulletCount >= 3) {
    patterns.push(`Lista com bullets (${bulletCount}x)`);
  }
  
  // Check for contrast pattern (X vs Y, fazem/não fazem)
  if (/(?:fazem|faz|usam?|têm)[\s\S]{5,50}(?:não fazem|não faz|não usam?|não têm)/i.test(content)) {
    patterns.push('Lista de contrastes "fazem X / não fazem Y"');
  }
  
  // Check for rhetorical question at end
  const lines = content.trim().split('\n').filter(l => l.trim());
  const lastLine = lines[lines.length - 1] || '';
  if (lastLine.includes('?')) {
    patterns.push('Pergunta retórica no final');
  }
  
  // Check for name + achievement opener
  if (/^(?:um |uma |o |a )?(?:\w+)\s+(?:criou|fez|construiu|lançou|vendeu|gerou|faturou)/i.test(content.trim())) {
    patterns.push('Abertura com nome de pessoa + feito impressionante');
  }
  
  // Check for numbered list structure
  const numberedCount = (content.match(/^\d+[\.\)]\s/gm) || []).length;
  if (numberedCount >= 3) {
    patterns.push(`Lista numerada (${numberedCount} itens)`);
  }
  
  // Check for "bold statement → explanation" pattern
  if (/^[^\n]{10,60}\.\n\n[^\n]{20,}/m.test(content)) {
    patterns.push('Afirmação bold + parágrafo de explicação');
  }
  
  return patterns;
}

/**
 * Detect opening patterns from recent posts to prevent hook repetition.
 * Groups openings by type: "Eu + verbo", "Pergunta", "Número", "Nome próprio", "Imperativo", etc.
 */
export function detectOpeningPatterns(recentPosts: string[]): { pattern: string; count: number; examples: string[] }[] {
  const patternMap: Record<string, string[]> = {};
  
  for (const post of recentPosts) {
    const firstLine = post.trim().split('\n')[0]?.trim() || '';
    if (!firstLine) continue;
    
    const firstWords = firstLine.substring(0, 60);
    let patternName = 'Outro';
    
    // Classify the opening pattern
    if (/^(eu |eu,|meu |minha |me )/i.test(firstLine)) {
      patternName = 'Eu + verbo (primeira pessoa)';
    } else if (/^(você |sua |seu |te )/i.test(firstLine)) {
      patternName = 'Você (segunda pessoa)';
    } else if (/^[^\n]{0,80}\?/.test(firstLine)) {
      patternName = 'Abertura com pergunta';
    } else if (/^\d/.test(firstLine)) {
      patternName = 'Abertura com número';
    } else if (/^(a maioria|todo mundo|ninguém|poucos|muitos)/i.test(firstLine)) {
      patternName = 'Generalização (A maioria, Todo mundo...)';
    } else if (/^(se |quando |enquanto |antes de)/i.test(firstLine)) {
      patternName = 'Condicional/temporal (Se, Quando...)';
    } else if (/^(não |nunca |pare |esqueça|evite|cuidado)/i.test(firstLine)) {
      patternName = 'Negação/Imperativo negativo';
    } else if (/^(ontem|hoje|essa semana|semana passada|na última|em \d{4})/i.test(firstLine)) {
      patternName = 'Temporal (Ontem, Hoje, Essa semana...)';
    } else if (/^[A-Z][a-záéíóú]+ [a-záéíóú]+ (é|são|foi|era|será|tem|não)/i.test(firstLine)) {
      patternName = 'Afirmação declarativa';
    }
    
    if (!patternMap[patternName]) patternMap[patternName] = [];
    patternMap[patternName].push(firstWords);
  }
  
  return Object.entries(patternMap)
    .map(([pattern, examples]) => ({ pattern, count: examples.length, examples }))
    .filter(p => p.count >= 2)
    .sort((a, b) => b.count - a.count);
}

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
- ❌ PROIBIDO aberturas: "Hot take:", "Unpopular opinion:", "A verdade é que..."
- ❌ PROIBIDO: "O que founders/marketers não falam/sabem"
- ❌ PROIBIDO: "Aqui está o que funciona/aprendi/importa"
- ✅ Use linguagem natural e direta
- ✅ Soe como uma pessoa real, não como ChatGPT
- ✅ VARIE a estrutura: NÃO use sempre o mesmo padrão (afirmação → bullets → pergunta)

### REGRA #4: VALOR REAL
- ❌ Sem preenchimento ou floreios
- ✅ Cada frase deve agregar valor
- ✅ Números específicos > adjetivos vagos

### REGRA #5: DADOS REAIS OU NENHUM
- ❌ NUNCA invente números, métricas ou estatísticas
- ❌ NUNCA cite "300+ empresas", "92% dos founders" ou similares sem fonte REAL
- ❌ NUNCA cite empresas/pessoas fazendo algo específico sem fonte verificável
- ✅ Se não tem dado real, use experiência pessoal: "na minha experiência", "o que vi na prática"
- ✅ Se usar número, seja específico E realista (não arredonde para impressionar)
- ✅ Prefira insights qualitativos a dados quantitativos inventados

### REGRA #6: VARIEDADE ESTRUTURAL
- ❌ NUNCA use a mesma estrutura em posts consecutivos
- ❌ Evite o padrão repetitivo: afirmação bold → lista → insight → pergunta retórica
- ✅ Alterne entre: narrativa, provocação, dado concreto, metáfora, confissão, análise
- ✅ Varie as aberturas: uma vez comece pelo meio da história, outra pelo resultado, outra pela dúvida

### REGRA #7: ZERO LINKS
- ❌ NUNCA inclua links ou URLs no conteúdo do post
- ❌ Nem link da fonte, nem link para "saiba mais"
- ✅ O conteúdo deve ser autossuficiente
`;
