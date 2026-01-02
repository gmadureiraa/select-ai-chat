// =====================================================
// CARREGADOR DE DOCUMENTAÇÃO DE AGENTES E FORMATOS
// =====================================================

// Mapeamento de tipo de conteúdo para arquivo de formato
const FORMAT_DOCS_MAP: Record<string, string> = {
  "newsletter": "NEWSLETTER.md",
  "blog_post": "BLOG_POST.md",
  "carousel": "CARROSSEL.md",
  "carrossel": "CARROSSEL.md",
  "thread": "THREAD.md",
  "tweet": "TWEET.md",
  "linkedin_post": "LINKEDIN_POST.md",
  "linkedin": "LINKEDIN_POST.md",
  "stories": "STORIES.md",
  "short_video": "REELS_SHORT_VIDEO.md",
  "reels": "REELS_SHORT_VIDEO.md",
  "tiktok": "REELS_SHORT_VIDEO.md",
  "shorts": "REELS_SHORT_VIDEO.md",
  "long_video": "LONG_VIDEO_YOUTUBE.md",
  "youtube": "LONG_VIDEO_YOUTUBE.md",
  "x_article": "ARTIGO_X.md",
  "artigo_x": "ARTIGO_X.md",
  "instagram_post": "POST_INSTAGRAM.md",
  "post_instagram": "POST_INSTAGRAM.md",
  "email": "EMAIL_MARKETING.md",
  "email_marketing": "EMAIL_MARKETING.md",
};

// Mapeamento de ID de agente para arquivo de documentação
const AGENT_DOCS_MAP: Record<string, string> = {
  "researcher": "RESEARCHER.md",
  "pesquisador": "RESEARCHER.md",
  "writer": "CONTENT_WRITER.md",
  "escritor": "CONTENT_WRITER.md",
  "content_writer": "CONTENT_WRITER.md",
  "editor": "CONTENT_WRITER.md", // Editor usa o mesmo guia de escrita
  "reviewer": "CONTENT_WRITER.md", // Revisor usa o mesmo guia
  "strategist": "STRATEGIST.md",
  "estrategista": "STRATEGIST.md",
  "metrics_analyst": "METRICS_ANALYST.md",
  "analista": "METRICS_ANALYST.md",
  "design_agent": "DESIGN_AGENT.md",
  "designer": "DESIGN_AGENT.md",
  "email_developer": "EMAIL_DEVELOPER.md",
};

// Cache em memória para documentos já carregados
const docsCache: Map<string, string> = new Map();

// Documentação embeddada diretamente (seções mais importantes de cada doc)
// Isso evita leitura de arquivo e mantém tokens controlados
const EMBEDDED_AGENT_DOCS: Record<string, string> = {
  "researcher": `## AGENTE PESQUISADOR

### MISSÃO
Realizar pesquisas profundas, analisar informações complexas e fornecer dados contextuais relevantes.

### COMO AGIR
1. **Usar Dados Fornecidos** - Use APENAS dados e referências do contexto
2. **Ser Objetivo** - Apresente informações de forma neutra e factual
3. **Organizar Claramente** - Estruture em: Fatos principais → Detalhes → Fontes → Aplicação

### REGRAS ABSOLUTAS
- NUNCA invente dados
- SEMPRE use apenas informações fornecidas
- SEMPRE seja objetivo e factual
- NUNCA apresente opiniões como fatos`,

  "writer": `## AGENTE ESCRITOR DE CONTEÚDO

### MISSÃO
Criar conteúdo textual de alta qualidade seguindo estritamente as diretrizes do cliente.

### HIERARQUIA DE INFORMAÇÃO (ordem de prioridade)
1. Documentação do formato específico (estrutura, regras)
2. Guia de identidade do cliente (tom, voz, estilo)
3. Biblioteca de conteúdo do cliente (exemplos reais)

### COMO AGIR
1. **Consultar identity_guide** - Tom de voz, personalidade, valores
2. **Usar content_library** - Exemplos reais como referência de estilo
3. **Seguir documentação do formato** - Estrutura obrigatória

### REGRAS ABSOLUTAS
- SEMPRE consulte o guia de identidade do cliente
- SEMPRE use exemplos reais como referência de estilo
- NUNCA use linguagem genérica de IA
- NUNCA ignore a documentação do formato`,

  "editor": `## AGENTE EDITOR DE ESTILO

### MISSÃO
Refinar conteúdo para soar EXATAMENTE como o cliente escreve.

### PROCESSO
1. Compare rascunho com exemplos reais do cliente
2. Ajuste tom de voz, vocabulário, expressões
3. Aplique regras do guia de copywriting
4. Garanta que pareça escrito pelo cliente, não por IA

### REGRAS
- NUNCA use linguagem genérica de IA
- SEMPRE use o vocabulário específico do cliente
- MANTENHA a estrutura dos exemplos de referência`,

  "reviewer": `## AGENTE REVISOR FINAL

### MISSÃO
Fazer polish final e verificação de qualidade.

### REGRA ABSOLUTA DE OUTPUT
- Retorne EXCLUSIVAMENTE o conteúdo final
- NÃO inclua comentários, explicações ou introduções
- NÃO diga "Aqui está", "Versão final", etc.
- APENAS o conteúdo pronto para publicação

### CHECKLIST SILENCIOSO
- Gramática e ortografia corretas
- Emojis apenas início/fim de seções
- CTAs claros e persuasivos
- Hook forte e envolvente
- Sem linguagem genérica de IA`
};

// Documentação de formatos embeddada (seções essenciais)
const EMBEDDED_FORMAT_DOCS: Record<string, string> = {
  "newsletter": `## FORMATO: NEWSLETTER

### ESTRUTURA OBRIGATÓRIA
1. **Assunto** (45-60 chars) - Curto, intrigante, cria urgência
2. **Preview Text** (85-100 chars) - Complementa o assunto
3. **Abertura** - Gancho forte, conecta com leitor
4. **Corpo** - 2-4 seções com valor real
5. **CTA Principal** - Claro e específico
6. **Assinatura** - Pessoal e memorável

### REGRAS DE OURO
- Taxa de abertura meta: >25%
- Taxa de clique meta: >3%
- Máximo 500-800 palavras
- Parágrafos curtos (máx 3 linhas)
- 1 CTA principal por newsletter`,

  "carousel": `## FORMATO: CARROSSEL

### REGRA DE OURO
O Slide 1 é 80% do sucesso. Se não parar o scroll, o resto não importa.

### ESTRUTURA OBRIGATÓRIA
**SLIDE 1 (GANCHO)**: Máx 20 palavras - dor/urgência/curiosidade
**SLIDE 2 (PONTE)**: Aprofunde a dor, NÃO entregue solução
**SLIDES 3-6**: 1 ideia por slide, máx 30 palavras
**SLIDE FINAL (CTA)**: Recapitule benefício + CTA específico

### SEPARADORES
Use "---PÁGINA N---" entre cada slide

### O QUE EVITAR
- Slide 1 com mais de 20 palavras
- CTA genérico ("siga para mais")
- Muitas ideias por slide`,

  "thread": `## FORMATO: THREAD

### ESTRUTURA OBRIGATÓRIA
**TWEET 1 (GANCHO)**: 100-150 chars, promessa/pergunta/dado impactante, termine com 🧵
**TWEETS 2-9**: 1 ideia por tweet, numere (1/, 2/), cada tweet funciona sozinho
**ÚLTIMO TWEET**: Peça RT do primeiro, resumo + CTA

### REGRAS
- Limite 280 caracteres por tweet
- Separador "---TWEET N---" entre tweets
- Tweet 1 deve viralizar sozinho`,

  "tweet": `## FORMATO: TWEET

### REGRAS
- Limite OBRIGATÓRIO: 280 caracteres
- Primeira linha é crítica
- Menos é mais
- Máx 2-3 hashtags
- 1-2 emojis máximo

### ESTRUTURAS EFICAZES
- Afirmação + Contexto
- Pergunta + Resposta
- Dado + Insight
- Lista rápida (3-5 itens)`,

  "linkedin_post": `## FORMATO: LINKEDIN POST

### ESTRUTURA
**LINHA 1 (GANCHO)**: 10-15 palavras máx - aparece ANTES do "ver mais"!
**DESENVOLVIMENTO**: 100-250 palavras, parágrafos curtos
**CTA**: Pergunta para comentários ou link

### REGRAS
- LinkedIn valoriza autenticidade
- Storytelling > Teoria
- Eduque, não venda
- Parágrafos curtos são essenciais`,

  "stories": `## FORMATO: STORIES

### ESTRUTURA
**STORY 1 (GANCHO)**: Máx 10 palavras, captura atenção
**STORIES 2-6**: 10-20 palavras, texto legível
**ÚLTIMO STORY**: CTA claro

### REGRAS
- Máx 3 linhas por story
- Texto grande e legível
- Separador "---STORIE N---"`,

  "short_video": `## FORMATO: VÍDEO CURTO (Reels/TikTok/Shorts)

### REGRA DE OURO
Os primeiros 3 segundos são 80% do sucesso.

### ESTRUTURA OBRIGATÓRIA
**GANCHO [0:00-0:03]**: Pattern interrupt ou curiosity gap
**PONTO 1-3 [0:03-0:28]**: 1 ideia por ponto, escada de valor
**CTA [0:28-0:30]**: Específico, não genérico

### CADA SEÇÃO TEM
[Texto na tela]: Palavras-chave legíveis (60% assistem no mudo!)
[Ação]: Descrição visual
[Narração]: O que é falado

### SEPARADORES
---GANCHO---, ---PONTO N---, ---CTA---`,

  "long_video": `## FORMATO: VÍDEO LONGO (YouTube)

### FILOSOFIA
YouTube é jogo de RETENÇÃO. Cada segundo deve justificar sua existência.

### ESTRUTURA OBRIGATÓRIA
1. **METADADOS**: Duração, público, objetivo, keywords
2. **TÍTULO + THUMBNAIL**: 3 opções cada
3. **GANCHO [0:00-0:30]**: Hook + Context + Promise
4. **INTRODUÇÃO [0:30-2:00]**: Contexto + Credibilidade + Roadmap
5. **CAPÍTULOS**: Conceito + Importância + Aplicação + Exemplo
6. **CONCLUSÃO**: Recap + Takeaway + CTA + Teaser
7. **DESCRIÇÃO**: Resumo + Timestamps + Links`,

  "instagram_post": `## FORMATO: POST INSTAGRAM

### ESTRUTURA
**PRIMEIRA LINHA**: Máx 125 chars (aparece antes do "mais...")
**CORPO**: 150-300 palavras, quebras de linha
**CTA + HASHTAGS**: 5-10 hashtags no final

### REGRAS
- Emojis apenas início/fim de linhas
- Parágrafos curtos (1-2 linhas)
- Hashtags NUNCA no meio do texto`,

  "x_article": `## FORMATO: ARTIGO NO X

### ESTRUTURA
**TÍTULO**: Máx 100 chars, impactante
**SUBTÍTULO**: Complementa o título
**INTRODUÇÃO**: 100-150 palavras, gancho forte
**CORPO**: 800-2000 palavras, 3-5 seções com H2
**CONCLUSÃO**: 100-150 palavras, recap + CTA

### REGRAS
- Tom conversacional mas profissional
- Parágrafos máx 4 linhas
- NÃO use emojis no meio de frases`,

  "email_marketing": `## FORMATO: EMAIL MARKETING

### ESTRUTURA
1. **Assunto**: Curto, urgência ou curiosidade
2. **Preview**: Complementa assunto
3. **Saudação**: Pessoal quando possível
4. **Corpo**: Benefício claro, escaneável
5. **CTA**: Único, destacado
6. **Assinatura**: Profissional

### REGRAS
- Foco em 1 objetivo por email
- CTAs visuais e claros
- Mobile-first design`
};

/**
 * Carrega documentação de um agente específico
 */
export function getAgentDocs(agentId: string): string {
  const normalizedId = agentId.toLowerCase();
  
  // Primeiro tenta o cache
  if (docsCache.has(`agent_${normalizedId}`)) {
    return docsCache.get(`agent_${normalizedId}`)!;
  }
  
  // Retorna documentação embeddada
  const docs = EMBEDDED_AGENT_DOCS[normalizedId] || EMBEDDED_AGENT_DOCS["writer"] || "";
  
  // Cacheia para próximas chamadas
  if (docs) {
    docsCache.set(`agent_${normalizedId}`, docs);
  }
  
  return docs;
}

/**
 * Carrega documentação de um formato específico
 */
export function getFormatDocs(contentType: string): string {
  const normalizedType = contentType.toLowerCase().replace(/-/g, "_");
  
  // Primeiro tenta o cache
  if (docsCache.has(`format_${normalizedType}`)) {
    return docsCache.get(`format_${normalizedType}`)!;
  }
  
  // Mapeia para o nome do formato
  const formatKey = FORMAT_DOCS_MAP[normalizedType] 
    ? normalizedType 
    : Object.keys(FORMAT_DOCS_MAP).find(k => normalizedType.includes(k)) || normalizedType;
  
  // Retorna documentação embeddada
  const docs = EMBEDDED_FORMAT_DOCS[formatKey] || "";
  
  // Cacheia para próximas chamadas
  if (docs) {
    docsCache.set(`format_${normalizedType}`, docs);
  }
  
  return docs;
}

/**
 * Monta o contexto completo de documentação para um agente
 * baseado no tipo de conteúdo sendo criado
 */
export function buildAgentContext(agentId: string, contentType: string): string {
  const agentDocs = getAgentDocs(agentId);
  const formatDocs = getFormatDocs(contentType);
  
  let context = "";
  
  if (agentDocs) {
    context += `# DIRETRIZES DO AGENTE\n\n${agentDocs}\n\n`;
  }
  
  // Só adiciona docs de formato para agentes que criam conteúdo
  if (formatDocs && ["writer", "escritor", "content_writer", "editor", "reviewer"].includes(agentId.toLowerCase())) {
    context += `# REGRAS DO FORMATO\n\n${formatDocs}\n\n`;
  }
  
  return context;
}

/**
 * Limpa o cache de documentos
 */
export function clearDocsCache(): void {
  docsCache.clear();
}

/**
 * Retorna lista de formatos disponíveis
 */
export function getAvailableFormats(): string[] {
  return Object.keys(EMBEDDED_FORMAT_DOCS);
}

/**
 * Retorna lista de agentes disponíveis
 */
export function getAvailableAgents(): string[] {
  return Object.keys(EMBEDDED_AGENT_DOCS);
}
