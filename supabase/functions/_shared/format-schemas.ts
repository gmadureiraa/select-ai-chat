// =====================================================
// FORMAT SCHEMAS - Output contracts for each content format
// Version 1.0 - Part of "Impeccable Content" architecture
// =====================================================

export interface FieldSchema {
  required: boolean;
  min_length?: number;
  max_length?: number;
  description: string;
}

export interface FormatSchema {
  format: string;
  format_label: string;
  fields: Record<string, FieldSchema>;
  output_template: string;
  prohibited_words: string[];
  techniques: string[];
}

// =====================================================
// FORMAT SCHEMAS BY TYPE
// =====================================================

export const FORMAT_SCHEMAS: Record<string, FormatSchema> = {
  newsletter: {
    format: "newsletter",
    format_label: "Newsletter",
    fields: {
      subject: { 
        required: true, 
        max_length: 50, 
        description: "Linha de assunto" 
      },
      preview: { 
        required: true, 
        max_length: 90, 
        description: "Preview text (complementa o assunto)" 
      },
      greeting: { 
        required: false, 
        max_length: 100, 
        description: "Saudação personalizada" 
      },
      body: { 
        required: true, 
        min_length: 300, 
        max_length: 2000, 
        description: "Corpo da newsletter" 
      },
      cta: { 
        required: true, 
        max_length: 150, 
        description: "Call to action claro" 
      },
      signature: { 
        required: false, 
        max_length: 100, 
        description: "Assinatura" 
      },
    },
    output_template: `**ASSUNTO:** [max 50 chars]
**PREVIEW:** [max 90 chars]

---

[Saudação]

[Parágrafo 1 - Gancho]

[Parágrafos 2-4 - Desenvolvimento]

[CTA Final]

[Assinatura]`,
    prohibited_words: [
      "grátis", "gratuito", "última chance", "urgente", "garantido",
      "clique aqui", "não perca", "oferta imperdível", "tempo limitado"
    ],
    techniques: [
      "Assunto com número ou pergunta",
      "Preview complementa (não repete) o assunto",
      "Storytelling no primeiro parágrafo",
      "Bullet points para listas",
      "CTA com verbo de ação específico"
    ]
  },

  email_marketing: {
    format: "email_marketing",
    format_label: "Email Marketing",
    fields: {
      subject: { 
        required: true, 
        max_length: 50, 
        description: "Linha de assunto com urgência ou curiosidade" 
      },
      preview: { 
        required: true, 
        max_length: 90, 
        description: "Preview text" 
      },
      body: { 
        required: true, 
        min_length: 100, 
        max_length: 500, 
        description: "Corpo do email focado em UMA oferta" 
      },
      cta: { 
        required: true, 
        max_length: 50, 
        description: "Texto do botão CTA" 
      },
      ps: { 
        required: false, 
        max_length: 150, 
        description: "P.S. com reforço da oferta" 
      },
    },
    output_template: `**ASSUNTO:** [max 50 chars]
**PREVIEW:** [max 90 chars]

---

[Saudação curta]

[Problema/Dor]

[Solução/Oferta]

**[BOTÃO CTA]**

[Urgência/Escassez se aplicável]

[Assinatura]

P.S. [Reforço da oferta]`,
    prohibited_words: [
      "GRÁTIS", "$$$", "!!!!", "CLIQUE AQUI", "GANHE DINHEIRO",
      "SEM COMPROMISSO", "OFERTA EXCLUSIVA"
    ],
    techniques: [
      "P.S. com urgência ou benefício extra",
      "Escassez real (prazo, vagas limitadas)",
      "Prova social quando disponível",
      "Benefícios acima de características",
      "Um único CTA claro"
    ]
  },

  carousel: {
    format: "carousel",
    format_label: "Carrossel",
    fields: {
      cover_headline: { 
        required: true, 
        max_length: 40, 
        description: "Headline da capa (máx 8 palavras)" 
      },
      cover_subtitle: { 
        required: false, 
        max_length: 50, 
        description: "Subtítulo da capa" 
      },
      slides: { 
        required: true, 
        description: "Slides de conteúdo (2-8 slides)" 
      },
      cta_slide: { 
        required: true, 
        max_length: 100, 
        description: "Slide final com CTA" 
      },
      caption: { 
        required: true, 
        min_length: 100, 
        max_length: 800, 
        description: "Legenda do post" 
      },
    },
    output_template: `Página 1:
[Headline impactante - máx 8 palavras]
[Subtítulo se necessário]

---

Página 2:
[Título do ponto]
[Texto - máx 30 palavras]

---

[...páginas intermediárias...]

---

Página Final:
SALVE ESTE POST
Para consultar depois

COMPARTILHE
Com quem precisa ver isso

---

LEGENDA:
[Gancho forte na primeira linha]
[Desenvolvimento]
[CTA]`,
    prohibited_words: [
      "Entenda", "Aprenda", "Vamos falar sobre", "Descubra como",
      "Você sabia que"
    ],
    techniques: [
      "Números específicos: '4,5%' em vez de 'vários'",
      "Contraste: Antes vs Depois",
      "Dor + Solução",
      "Perguntas provocativas na capa",
      "Listas numeradas (1., 2., 3.)",
      "Progressão lógica entre slides"
    ]
  },

  tweet: {
    format: "tweet",
    format_label: "Tweet",
    fields: {
      content: { 
        required: true, 
        max_length: 280, 
        description: "Texto do tweet" 
      },
    },
    output_template: `[Texto do tweet - máx 280 chars, sem hashtags]`,
    prohibited_words: [],
    techniques: [
      "Gancho forte na primeira frase",
      "Números específicos",
      "Opinião ou take polêmico",
      "Perguntas diretas que provocam reflexão",
      "Insight único baseado em experiência real"
    ]
  },

  thread: {
    format: "thread",
    format_label: "Thread",
    fields: {
      hook_tweet: { 
        required: true, 
        max_length: 280, 
        description: "Tweet inicial com gancho" 
      },
      content_tweets: { 
        required: true, 
        description: "Tweets de conteúdo (máx 280 chars cada)" 
      },
      cta_tweet: { 
        required: true, 
        max_length: 280, 
        description: "Tweet final com CTA" 
      },
    },
    output_template: `Tweet 1/X:
[Gancho prometendo o que a pessoa vai aprender/ganhar]

Tweet 2/X:
[Primeiro ponto - uma ideia]

[...]

Tweet X/X:
[CTA: Curta, salve, siga para mais]`,
    prohibited_words: [],
    techniques: [
      "Numerar os tweets (1/10, 2/10...)",
      "Conectores entre tweets ('Mas tem mais...')",
      "Listas dentro dos tweets",
      "Uma ideia por tweet"
    ]
  },

  linkedin: {
    format: "linkedin",
    format_label: "Post LinkedIn",
    fields: {
      hook: { 
        required: true, 
        max_length: 150, 
        description: "Primeira linha (aparece antes do 'ver mais')" 
      },
      body: { 
        required: true, 
        min_length: 200, 
        max_length: 1500, 
        description: "Corpo do post" 
      },
      cta: { 
        required: true, 
        max_length: 200, 
        description: "Pergunta ou ação no final" 
      },
    },
    output_template: `[Gancho de 1 linha - aparece antes do "ver mais"]

[Espaço]

[Parágrafo 1 - Contexto ou história]

[Espaço]

[Parágrafos 2-4 - Desenvolvimento com insights]

[Espaço]

[CTA: Pergunta que gera comentários ou ação]`,
    prohibited_words: [
      "Olá rede", "Bom dia, LinkedIn", "Queridos seguidores"
    ],
    techniques: [
      "Storytelling pessoal/profissional",
      "Contraste: erro passado vs aprendizado",
      "Listas numeradas ou com bullets",
      "Perguntas que geram debate"
    ]
  },

  post: {
    format: "post",
    format_label: "Post Estático",
    fields: {
      visual_text: { 
        required: true, 
        max_length: 60, 
        description: "Texto principal (5-10 palavras)" 
      },
      visual_secondary: { 
        required: false, 
        max_length: 60, 
        description: "Texto secundário opcional" 
      },
      caption: { 
        required: true, 
        min_length: 50, 
        max_length: 600, 
        description: "Legenda com gancho + CTA" 
      },
    },
    output_template: `**TEXTO PRINCIPAL:**
[Frase impactante - máx 10 palavras]

**TEXTO SECUNDÁRIO (opcional):**
[Complemento - máx 10 palavras]

---

**LEGENDA:**
[Primeira linha = gancho que para o scroll]

[Desenvolvimento em parágrafos curtos]

[CTA no final]`,
    prohibited_words: [],
    techniques: [
      "Contraste de ideias",
      "Números específicos",
      "Perguntas diretas",
      "Chamadas provocativas"
    ]
  },

  instagram_post: {
    format: "instagram_post",
    format_label: "Post Instagram",
    fields: {
      visual_text: { 
        required: true, 
        max_length: 60, 
        description: "Texto do visual (5-10 palavras)" 
      },
      caption: { 
        required: true, 
        min_length: 50, 
        max_length: 600, 
        description: "Legenda com gancho + valor + CTA" 
      },
    },
    output_template: `**TEXTO DO VISUAL:**
[5-10 palavras impactantes]

---

**LEGENDA:**
[Gancho - primeira linha que para o scroll]

[Desenvolvimento com valor real em parágrafos curtos]

[CTA claro no final]`,
    prohibited_words: [],
    techniques: [
      "Primeira linha polêmica ou provocativa",
      "Storytelling pessoal",
      "Números específicos",
      "Perguntas que geram comentários"
    ]
  },

  reels: {
    format: "reels",
    format_label: "Roteiro de Reels",
    fields: {
      hook: { 
        required: true, 
        max_length: 100, 
        description: "Gancho (0-3s) - frase que para o scroll" 
      },
      script: { 
        required: true, 
        description: "Roteiro com cenas/marcações" 
      },
      cta: { 
        required: true, 
        max_length: 100, 
        description: "CTA final" 
      },
    },
    output_template: `**GANCHO (0-3s):**
[Frase que para o scroll - visual ou falada]

**DESENVOLVIMENTO:**
Cena 1 (3-15s):
[Ação/fala]

Cena 2 (15-30s):
[Ação/fala]

[...]

**CTA FINAL:**
[Ação específica + texto na tela]`,
    prohibited_words: [
      "Você sabia que", "Olá pessoal", "Bom dia"
    ],
    techniques: [
      "Gancho com polêmica leve ou dado surpreendente",
      "Ritmo rápido com cortes",
      "Texto na tela reforçando pontos-chave",
      "CTA visual + falado"
    ]
  },

  short_video: {
    format: "short_video",
    format_label: "Vídeo Curto (TikTok/Shorts)",
    fields: {
      hook: { 
        required: true, 
        max_length: 50, 
        description: "Gancho (0-1s)" 
      },
      script: { 
        required: true, 
        description: "Roteiro ultra-conciso" 
      },
      cta: { 
        required: true, 
        max_length: 50, 
        description: "CTA rápido" 
      },
      caption: { 
        required: true, 
        max_length: 200, 
        description: "Legenda curta" 
      },
    },
    output_template: `**GANCHO (0-1s):**
[Texto na tela / Primeira fala]

**DESENVOLVIMENTO:**
Cena 1:
[Ação/Texto]

Cena 2:
[Ação/Texto]

**CTA:**
[Ação final - siga/comente]

**LEGENDA:**
[Legenda curta sem hashtags]`,
    prohibited_words: [],
    techniques: [
      "Texto grande na tela",
      "Cortes rápidos",
      "Trending sounds quando relevante",
      "Loop - final conecta com início"
    ]
  },

  long_video: {
    format: "long_video",
    format_label: "Roteiro YouTube",
    fields: {
      title: { 
        required: true, 
        max_length: 60, 
        description: "Título YouTube" 
      },
      thumbnail_text: { 
        required: true, 
        max_length: 30, 
        description: "Texto da thumbnail (2-4 palavras)" 
      },
      hook: { 
        required: true, 
        max_length: 300, 
        description: "Gancho (0-30s)" 
      },
      script: { 
        required: true, 
        description: "Roteiro com seções e timestamps" 
      },
      description: { 
        required: true, 
        max_length: 500, 
        description: "Descrição SEO" 
      },
    },
    output_template: `**TÍTULO:** [Título YouTube - máx 60 chars]
**THUMBNAIL TEXT:** [2-4 palavras impactantes]

---

**GANCHO (0-30s):**
[Fala que prende - promessa ou polêmica]

**CONTEXTO (30s-2min):**
[Por que o espectador deve continuar]

**SEÇÃO 1: [Título]**
[Roteiro com marcações de tempo]

**SEÇÃO 2: [Título]**
[Roteiro...]

**CONCLUSÃO:**
[Resumo + CTA para inscrição]

**DESCRIÇÃO:**
[Descrição otimizada para SEO]`,
    prohibited_words: [
      "Olá pessoal, tudo bem?", "E aí galera", "Fala pessoal"
    ],
    techniques: [
      "Pattern interrupt no início",
      "Promessa clara do que será entregue",
      "Timestamps para navegação",
      "Loops abertos entre seções"
    ]
  },

  stories: {
    format: "stories",
    format_label: "Stories",
    fields: {
      stories_content: { 
        required: true, 
        description: "Conteúdo dos stories (máx 20 palavras cada)" 
      },
      cta_story: { 
        required: true, 
        max_length: 50, 
        description: "Story final com sticker interativo" 
      },
    },
    output_template: `Story 1:
[Visual/Ação]
Texto: [Máx 20 palavras]

Story 2:
[Visual/Ação]
Texto: [Máx 20 palavras]

[...]

Story Final:
[CTA com sticker interativo]`,
    prohibited_words: [],
    techniques: [
      "Texto grande e legível",
      "Contraste fundo x texto",
      "Stickers de engajamento (enquete, pergunta, slider)"
    ]
  },

  blog_post: {
    format: "blog_post",
    format_label: "Blog Post",
    fields: {
      title: { 
        required: true, 
        max_length: 60, 
        description: "Título SEO-friendly" 
      },
      meta_description: { 
        required: true, 
        min_length: 120, 
        max_length: 160, 
        description: "Meta description" 
      },
      body: { 
        required: true, 
        min_length: 1000, 
        description: "Corpo com H2s e H3s" 
      },
      cta: { 
        required: true, 
        max_length: 200, 
        description: "CTA na conclusão" 
      },
    },
    output_template: `**TÍTULO:** [Título SEO - máx 60 chars]
**META DESCRIPTION:** [150-160 chars]

---

# [Título do artigo]

[Introdução - 2-3 parágrafos curtos com gancho]

## [Primeiro H2]
[Conteúdo com parágrafos curtos]

## [Segundo H2]
[Conteúdo...]

[...]

## Conclusão
[Resumo + CTA]`,
    prohibited_words: [],
    techniques: [
      "Listas e bullet points",
      "Dados e estatísticas específicas",
      "Exemplos práticos",
      "Perguntas retóricas para engajar"
    ]
  },

  x_article: {
    format: "x_article",
    format_label: "Artigo no X",
    fields: {
      title: { 
        required: true, 
        max_length: 100, 
        description: "Título" 
      },
      subtitle: { 
        required: false, 
        max_length: 150, 
        description: "Subtítulo" 
      },
      body: { 
        required: true, 
        min_length: 1000, 
        description: "Corpo com seções" 
      },
      promo_tweet: { 
        required: true, 
        max_length: 280, 
        description: "Tweet de divulgação" 
      },
    },
    output_template: `**TÍTULO:** [Máx 100 chars]
**SUBTÍTULO:** [Complemento]

---

[Introdução - 2-3 parágrafos curtos]

## [Seção 1]
[Conteúdo...]

## [Seção 2]
[Conteúdo...]

## Conclusão
[Resumo + CTA]

---

**TWEET DE DIVULGAÇÃO:**
[Tweet para promover o artigo - máx 280 chars, sem hashtags]`,
    prohibited_words: [],
    techniques: [
      "Storytelling pessoal",
      "Dados e exemplos concretos",
      "Imagens/screenshots entre seções",
      "Tweet de divulgação impactante"
    ]
  },

  case_study: {
    format: "case_study",
    format_label: "Estudo de Caso",
    fields: {
      title: { 
        required: true, 
        max_length: 100, 
        description: "Resultado específico alcançado" 
      },
      client_context: { 
        required: true, 
        max_length: 300, 
        description: "Quem é o cliente" 
      },
      challenge: { 
        required: true, 
        max_length: 500, 
        description: "Problema específico" 
      },
      solution: { 
        required: true, 
        description: "O que foi feito" 
      },
      results: { 
        required: true, 
        description: "Números e métricas" 
      },
      testimonial: { 
        required: false, 
        max_length: 300, 
        description: "Citação do cliente" 
      },
    },
    output_template: `**TÍTULO:** [Resultado específico - ex: "Como X aumentou vendas em 300%"]

---

## O Cliente
[Breve descrição]

## O Desafio
[Problema específico com números se possível]

## A Solução
[O que foi implementado, passo a passo]

## Os Resultados
- [Métrica 1: número específico]
- [Métrica 2: número específico]
- [Métrica 3: número específico]

## Depoimento
"[Citação do cliente]"

## CTA
[Próximo passo para o leitor]`,
    prohibited_words: [
      "melhorou muito", "aumentou significativamente", "ótimos resultados"
    ],
    techniques: [
      "Números específicos e verificáveis",
      "Antes x Depois",
      "Linha do tempo clara",
      "Depoimento real do cliente"
    ]
  },

  report: {
    format: "report",
    format_label: "Relatório de Performance",
    fields: {
      title: { 
        required: true, 
        max_length: 100, 
        description: "Título com período" 
      },
      executive_summary: { 
        required: true, 
        description: "3-5 bullets com principais insights" 
      },
      metrics: { 
        required: true, 
        description: "KPIs com comparativo" 
      },
      analysis: { 
        required: true, 
        description: "O que funcionou e o que não" 
      },
      recommendations: { 
        required: true, 
        description: "Próximos passos" 
      },
    },
    output_template: `# Relatório de Performance - [Período]

## Resumo Executivo
- [Insight 1]
- [Insight 2]
- [Insight 3]

## Métricas Principais
| Métrica | Período Atual | Período Anterior | Variação |
|---------|---------------|------------------|----------|
| [...]   | [...]         | [...]            | [+/-]%   |

## O Que Funcionou
- [Ação 1]: [Resultado]
- [Ação 2]: [Resultado]

## O Que Não Funcionou
- [Ação 1]: [Aprendizado]

## Recomendações
1. [Ação prioritária 1]
2. [Ação prioritária 2]
3. [Ação prioritária 3]`,
    prohibited_words: [],
    techniques: [
      "Comparativos período a período",
      "Insights acionáveis",
      "Priorização clara de ações",
      "Visualização de dados quando possível"
    ]
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get schema for a specific format
 */
export function getFormatSchema(format: string): FormatSchema | null {
  const normalizedFormat = format.toLowerCase().replace(/[_-]/g, '');
  
  // Direct match
  if (FORMAT_SCHEMAS[format]) {
    return FORMAT_SCHEMAS[format];
  }
  
  // Try normalized match
  for (const [key, schema] of Object.entries(FORMAT_SCHEMAS)) {
    if (key.replace(/[_-]/g, '') === normalizedFormat) {
      return schema;
    }
  }
  
  // Common aliases
  const aliases: Record<string, string> = {
    'carrossel': 'carousel',
    'emailmarketing': 'email_marketing',
    'blogpost': 'blog_post',
    'shortsvideo': 'short_video',
    'shortvideo': 'short_video',
    'tiktok': 'short_video',
    'shorts': 'short_video',
    'youtube': 'long_video',
    'longvideo': 'long_video',
    'instagrampost': 'instagram_post',
    'staticpost': 'post',
    'xarticle': 'x_article',
    'artigo': 'x_article',
    'casestudy': 'case_study',
    'relatorio': 'report',
    'reel': 'reels',
  };
  
  const aliasMatch = aliases[normalizedFormat];
  if (aliasMatch && FORMAT_SCHEMAS[aliasMatch]) {
    return FORMAT_SCHEMAS[aliasMatch];
  }
  
  return null;
}

/**
 * Get output template for a format
 */
export function getOutputTemplate(format: string): string {
  const schema = getFormatSchema(format);
  return schema?.output_template || '';
}

/**
 * Get prohibited words for a format
 */
export function getProhibitedWords(format: string): string[] {
  const schema = getFormatSchema(format);
  return schema?.prohibited_words || [];
}

/**
 * Get techniques that work for a format
 */
export function getTechniques(format: string): string[] {
  const schema = getFormatSchema(format);
  return schema?.techniques || [];
}

/**
 * Build contract prompt section for a format
 */
export function buildFormatContract(format: string): string {
  const schema = getFormatSchema(format);
  if (!schema) return '';
  
  let contract = `## 📋 CONTRATO DO FORMATO: ${schema.format_label.toUpperCase()}\n\n`;
  
  // Fields with requirements
  contract += `### Campos Obrigatórios\n`;
  for (const [fieldName, field] of Object.entries(schema.fields)) {
    if (field.required) {
      let req = `- **${fieldName}**: ${field.description}`;
      if (field.max_length) req += ` (máx ${field.max_length} chars)`;
      if (field.min_length) req += ` (mín ${field.min_length} chars)`;
      contract += req + '\n';
    }
  }
  
  // Optional fields
  const optionalFields = Object.entries(schema.fields).filter(([_, f]) => !f.required);
  if (optionalFields.length > 0) {
    contract += `\n### Campos Opcionais\n`;
    for (const [fieldName, field] of optionalFields) {
      let opt = `- **${fieldName}**: ${field.description}`;
      if (field.max_length) opt += ` (máx ${field.max_length} chars)`;
      contract += opt + '\n';
    }
  }
  
  // Output template
  contract += `\n### Formato de Entrega (OBRIGATÓRIO)\n`;
  contract += '```\n' + schema.output_template + '\n```\n';
  
  // Prohibited words
  if (schema.prohibited_words.length > 0) {
    contract += `\n### Palavras/Frases Proibidas\n`;
    contract += schema.prohibited_words.map(w => `❌ "${w}"`).join(', ') + '\n';
  }
  
  // Techniques
  if (schema.techniques.length > 0) {
    contract += `\n### Técnicas que Funcionam\n`;
    for (const tech of schema.techniques) {
      contract += `✅ ${tech}\n`;
    }
  }
  
  return contract;
}
