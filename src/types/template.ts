export interface TemplateRule {
  id: string;
  content: string;
  type?: 'text' | 'image_reference' | 'content_reference';
  file_url?: string; // For image references or content files
}

export interface ClientTemplate {
  id: string;
  client_id: string;
  name: string;
  type: 'chat' | 'image' | 'automation';
  rules: TemplateRule[];
  automation_config?: AutomationConfig;
  created_at: string;
  updated_at: string;
}

export interface AutomationConfig {
  schedule_type: string;
  schedule_time?: string;
  schedule_days?: string[];
  schedule_config?: any;
  model: string;
  prompt: string;
  data_sources?: any[];
  actions?: any[];
  email_recipients?: string[];
  webhook_url?: string;
}

export interface CreateTemplateData {
  client_id: string;
  name: string;
  type: 'chat' | 'image' | 'automation';
  rules?: TemplateRule[];
  automation_config?: AutomationConfig;
}

export const DEFAULT_CHAT_RULES: string[] = [
  "Sempre mantenha o tom de voz consistente com a marca",
  "Inclua call-to-action claro e direto",
  "Use linguagem acessível ao público-alvo",
  "Priorize clareza e objetividade",
];

export const DEFAULT_IMAGE_RULES: string[] = [
  "Estilo: Moderno e minimalista",
  "Proporção: 1024x1024 (quadrado)",
  "Paleta de cores: Vibrante com acentos neon e magenta",
  "Qualidade: Alta (high quality)",
  "Contexto: Sempre incluir elementos da marca quando possível",
];

// Regras globais de formato
export const GLOBAL_CONTENT_RULES = {
  emoji: "EVITE emojis a menos que seja extremamente necessário. NUNCA use emojis no meio de frases ou de forma desnecessária. Máximo 3-5 emojis por conteúdo quando realmente necessários.",
  clarity: "1 conteúdo = 1 mensagem = 1 objetivo. Seja claro e direto.",
  specificity: "Seja específico: Números > Adjetivos. Dados > Opiniões. '50% mais rápido' > 'Muito mais rápido'",
  hook: "Primeiros 3 segundos/primeira linha decidem tudo. O gancho é CRÍTICO.",
  cta: "SEMPRE tenha um CTA. 1 CTA por conteúdo. Não confunda o usuário.",
  value: "Se não é útil, educativo, inspirador ou divertido, não publique.",
};

// =====================================================
// REGRAS ESPECÍFICAS POR FORMATO DE CONTEÚDO
// =====================================================

// Regras para Posts Estáticos (Feed Instagram/Facebook)
export const STATIC_POST_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA POST ESTÁTICO

**Estrutura Visual:**
- Texto principal: 5-10 palavras (máximo)
- Texto secundário (opcional): 5-10 palavras
- Logo/marca: Sempre presente
- Hierarquia: Texto principal > Secundário > Elementos gráficos > Logo

**Tipos de Posts:**
1. **Frase Impactante**: Frase provocativa + contexto mínimo
2. **Dado/Estatística**: Número grande + contexto
3. **Pergunta**: Pergunta relevante + resposta na legenda
4. **Comparação**: Antes vs. Depois ou A vs. B
5. **Citação/Manifesto**: Frase inspiradora + atribuição

**Regras de Copy:**
1. Máximo 15 palavras (texto principal + secundário)
2. Seja específico com números e dados
3. Crie contraste (antes/depois, problema/solução)
4. Teste legibilidade em mobile (80%+ visualizam no celular)
5. Tamanho de fonte adequado, contraste de cores

**Especificações Técnicas:**
- Resolução: 1080x1080px (1:1) ou 1080x1350px (4:5)
- Máximo 2 fontes diferentes
- Paleta consistente com a marca
`;

// Regras específicas para Carrossel
export const CAROUSEL_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA CARROSSEL

**Estrutura de Carrossel (ideal 7 slides):**

**Slide 1 (Capa/Gancho)** - 50% do engajamento depende dele!
- Objetivo: Parar o scroll, criar curiosidade
- Copy: 5-10 palavras, pergunta ou promessa
- Regra: NÃO entregue tudo de cara

**Slides 2-9 (Desenvolvimento)**
- Objetivo: Desenvolver o tema, educar, engajar
- Copy: 15-30 palavras por slide
- Regra: 1 IDEIA POR SLIDE

**Último Slide (CTA)**
- Objetivo: Direcionar para ação
- Copy: 5-10 palavras, ação específica
- Regra: SEMPRE tenha um CTA claro

**Templates de Carrossel:**
- **Guia/Tutorial**: Título → Por que importa → Passos → CTA
- **Lista/Ranking**: Título → Intro → Itens (1 por slide) → CTA
- **Comparação**: Título → Contexto → Categorias → Veredito → CTA
- **Storytelling**: Gancho → Situação → Problema → Solução → Resultado → Lição → CTA
- **Mitos vs Verdades**: Título → Intro → Mito+Verdade por slide → CTA

**Regras Obrigatórias:**
1. Ideal: 7 slides (nem muito curto, nem muito longo)
2. Consistência visual: Mesma paleta, fontes, layout
3. Progressão clara: Cada slide leva ao próximo
4. Numere os slides: "1/7", "2/7" (ajuda o usuário)
5. Varie os fundos: Alterne cores para criar ritmo visual
6. SEMPRE termine com CTA
`;

// Regras específicas para Stories
export const STORIES_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA STORIES

**Estrutura de Sequência de Stories (3-7 slides):**

**Story 1 (Gancho)**
- Objetivo: Capturar atenção
- Copy: Pergunta, afirmação provocativa ou promessa
- Visual: Imagem impactante ou vídeo dinâmico

**Stories 2-6 (Desenvolvimento)**
- Objetivo: Desenvolver o tema
- Copy: 10-20 palavras por story
- Visual: Alternância entre texto, imagem, vídeo

**Último Story (CTA)**
- Objetivo: Direcionar ação
- Copy: CTA claro ("Deslize para cima", "Link na bio")
- Visual: Destaque para o CTA

**Elementos Interativos:**
- **Enquete**: Máximo 2 opções, decisões binárias
- **Quiz**: 2-4 opções, 1 correta
- **Caixa de Perguntas**: Coletar dúvidas, responder depois
- **Slider**: Medir intensidade com emoji relevante
- **Contador Regressivo**: Para eventos, promoções, lançamentos

**Regras Obrigatórias:**
1. Texto grande e legível: Mínimo 28pt
2. Contraste adequado: Texto legível sobre qualquer fundo
3. Máximo 3 linhas de texto: Não sobrecarregue
4. Use stickers com moderação: 2-3 por story
5. Vídeos curtos: 5-15 segundos por clipe
6. Som opcional: 60% assistem sem som
7. CTA em todos: Sempre direcione para próxima ação

**Formato de Apresentação:**
Ideia do storie: [Descreva a ideia geral]

Sequência:

Story 1:
[Ideia de design - elementos visuais, cores, composição]
Texto: [texto que aparece no story]
[Ideia de imagem se existir]

Story 2:
[Ideia de design]
Texto: [texto do story 2]
[Ideia de imagem se existir]

[Continue para todos os stories...]
`;

// Regras específicas para Tweets
export const TWEET_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA TWEET

**Tipos de Tweets:**
1. **Tweet Simples**: 1-3 frases curtas, 100-150 caracteres ideal
2. **Tweet com Imagem**: Texto + imagem que complementa (não repete)
3. **Tweet com Vídeo**: Texto + vídeo curto (15-60s), funciona sem som
4. **Quote Tweet**: Adicionar contexto agregando valor

**Estruturas de Tweet:**
- **Afirmação + Contexto**: [Afirmação direta] + [Por que importa]
- **Pergunta + Resposta**: [Pergunta provocativa] + [Insight]
- **Dado + Insight**: [Estatística impactante] + [Conclusão]
- **Lista Rápida**: [Título] + [3-5 itens numerados]
- **Contraste**: [Antes] vs [Depois] + [A diferença]

**Regras Obrigatórias:**
1. Seja conciso: Menos é mais. Ideal: 100-150 caracteres
2. Primeira linha é crítica: 80% decidem se vão ler com base nela
3. Use quebras de linha: Facilita a leitura
4. Evite hashtags em excesso: Máximo 2-3
5. Emojis com moderação: 1-2 por tweet máximo
6. Seja específico: Números > Adjetivos
7. Crie conversação: Faça perguntas, incentive replies

**Exemplo de Tweet:**
[Afirmação] O futuro do trabalho é remoto.

[Contexto] 70% das empresas já adotaram modelo híbrido. A questão não é mais "se", mas "como".
`;

// Regras específicas para Threads
export const THREAD_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA THREAD

**Estrutura de Thread (5-10 tweets):**

**Tweet 1 (Gancho)**
- Objetivo: Parar o scroll
- Copy: Promessa, pergunta ou dado impactante
- Regra: Termine com "🧵" ou "Thread:"

**Tweets 2-9 (Desenvolvimento)**
- Objetivo: Desenvolver o tema
- Copy: 1 ideia por tweet
- Regra: Numere os tweets (1/10, 2/10...)

**Último Tweet (CTA)**
- Objetivo: Direcionar ação
- Copy: CTA claro
- Regra: Peça RT do primeiro tweet

**Regras Obrigatórias:**
1. Gancho forte no primeiro tweet
2. 1 ideia por tweet, não misture assuntos
3. Numere TODOS os tweets
4. Mantenha consistência de tom
5. Use quebras de linha em cada tweet
6. Termine pedindo RT do primeiro

**Exemplo de Formato:**
Tweet 1: "Como cresci de 0 a 10k seguidores em 6 meses (sem comprar seguidores) 🧵"

Tweet 2: "1/ Primeiro, entendi uma coisa: consistência > viralização."

Tweet 3: "2/ Postei todo dia. Sem exceção. Mesmo quando não tinha vontade."

...

Tweet 10: "9/ Se este thread te ajudou, dá um RT no primeiro tweet. Vamos espalhar conhecimento."
`;

// Regras específicas para Reels/TikTok
export const REELS_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA REELS/TIKTOK

**Estrutura de Vídeo Curto:**

**0-3 segundos (Gancho)** - CRÍTICO!
- Objetivo: Parar o scroll
- Elementos: Frase impactante, visual chamativo, movimento
- Regra: Se não prender em 3s, perdeu o viewer

**3-60 segundos (Desenvolvimento)**
- Objetivo: Entregar valor
- Elementos: Conteúdo educativo, entretenimento, storytelling
- Regra: Ritmo rápido, cortes dinâmicos a cada 3-5s

**Últimos 3-5 segundos (CTA)**
- Objetivo: Direcionar ação
- Elementos: CTA verbal + texto na tela
- Opções: "Siga para mais", "Salve este vídeo", "Comente X"

**Tipos de Vídeos:**
1. **Tutorial/How-to**: Problema → Solução em X passos → Resultado (30-60s)
2. **Antes e Depois**: Situação inicial → Transformação → Resultado (15-30s)
3. **Lista Rápida**: Introdução → Itens → CTA (30-45s)
4. **Storytelling**: Gancho → História → Lição → CTA (45-90s)
5. **Tendência/Meme**: Áudio trending + adaptação para nicho (15-30s)

**Regras Obrigatórias:**
1. Gancho nos primeiros 3 segundos: CRÍTICO
2. Texto na tela: 60% assistem sem som
3. Cortes rápidos: Mude o ângulo a cada 3-5s
4. Formato vertical: 9:16
5. Boa iluminação essencial
6. Áudio trending aumenta alcance
7. CTA claro sempre no final

**Texto na Tela:**
- Tamanho grande e legível
- Posição: Centro ou terço inferior (não cubra o rosto)
- Duração: 1s por 3 palavras
- Animação sutil

**Formato de Roteiro:**
[GANCHO - 0:00-0:03]
Texto na tela: [texto]
Narração/Ação: [descrição]

[DESENVOLVIMENTO - 0:03-0:XX]
Ponto 1: [texto na tela + narração]
Ponto 2: [texto na tela + narração]
...

[CTA - Últimos 3-5s]
Texto na tela: [CTA]
Narração: [call to action verbal]
`;

// Regras específicas para LinkedIn
export const LINKEDIN_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA LINKEDIN

**Tipos de Posts:**
1. **Post de Texto Longo**: 150-300 palavras, thought leadership
2. **Post com Imagem**: Texto + imagem que agrega valor
3. **Post com Documento (PDF)**: 5-15 páginas, conteúdo educativo
4. **Post com Vídeo**: 1-3 minutos, funciona sem som

**Estrutura de Post LinkedIn:**

**Linha 1 (Gancho)** - Aparece antes do "ver mais"!
- Objetivo: Parar o scroll
- Copy: 10-15 palavras
- Tipos: Frase impactante, pergunta ou promessa

**Desenvolvimento (Corpo)**
- Objetivo: Desenvolver o tema
- Copy: 100-250 palavras
- Estrutura: Parágrafos curtos (2-3 linhas)
- Regra: Use quebras de linha generosamente

**CTA (Final)**
- Objetivo: Direcionar ação
- Copy: Pergunta para comentários ou link
- Regra: Incentive conversação

**Regras Obrigatórias:**
1. Primeira linha é crítica: Aparece antes do "ver mais"
2. Parágrafos curtos: Máximo 2-3 linhas
3. Use quebras de linha: Facilita a leitura
4. Seja autêntico: LinkedIn valoriza vulnerabilidade
5. Conte histórias: Storytelling > Teoria
6. Incentive conversação: Faça perguntas
7. Evite vendas diretas: Eduque, não venda

**Exemplo de Formato:**
[Gancho] Demiti meu melhor funcionário ontem.

[Desenvolvimento]
Não por performance. Não por atitude. Não por resultados.

Mas porque ele não estava feliz.

E eu aprendi uma lição valiosa: reter talentos infelizes é pior do que perdê-los.

[História de 3-4 parágrafos curtos]

[Lição]
Às vezes, a melhor decisão para a empresa é deixar ir.

[CTA]
Você já passou por isso? Como lidou?
`;

// Regras para Legendas Universais
export const CAPTION_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA LEGENDAS

**Estrutura de Legenda:**

**1. Gancho (1ª linha)** - 10-15 palavras
- Objetivo: Fazer o usuário clicar em "ver mais"
- Tipos: Pergunta, afirmação, dado, promessa
- Regra: NUNCA desperdice com "Hoje vamos falar sobre..."

**2. Contexto (2-3 linhas)** - 30-50 palavras
- Objetivo: Criar relevância
- Conteúdo: Por que isso importa agora?
- Regra: Conecte com a dor ou desejo do leitor

**3. Desenvolvimento (3-5 linhas)** - 60-100 palavras
- Objetivo: Entregar valor
- Conteúdo: Dados, exemplos, passos, insights
- Regra: Quebre em parágrafos curtos

**4. CTA (1-2 linhas)** - 10-20 palavras
- Objetivo: Direcionar ação
- Tipos: Comentar, salvar, clicar, compartilhar
- Regra: Seja específico

**5. Hashtags** - 5-10 relevantes
- Tipos: Marca, nicho, genéricas
- Regra: Relevantes ao conteúdo

**Tamanhos Ideais:**
- Instagram: 150-250 palavras
- Facebook: 100-150 palavras
- LinkedIn: 200-300 palavras

**Fórmulas de Legenda:**
1. Pergunta + Contexto + Resposta + CTA
2. Dado + Explicação + Solução + CTA
3. História + Lição + CTA

**Regras Obrigatórias:**
1. Primeira linha é crítica: 80% decidem se vão ler
2. Parágrafos curtos: Máximo 3 linhas
3. Use quebras de linha: Deixe espaços em branco
4. Emojis com moderação: 3-5 no máximo
5. Faça perguntas: Incentiva comentários
6. Seja específico: Números > Adjetivos
7. SEMPRE tenha CTA: Não deixe sem direção
`;

// =====================================================
// FUNÇÃO PARA OBTER REGRAS POR TIPO DE CONTEÚDO
// =====================================================

export type ContentFormatType = 
  | 'static_image' 
  | 'carousel' 
  | 'stories' 
  | 'tweet' 
  | 'thread' 
  | 'short_video' 
  | 'reel_script'
  | 'long_video'
  | 'video_script'
  | 'linkedin' 
  | 'newsletter'
  | 'blog_post'
  | 'social_post'
  | 'other';

export const getContentFormatRules = (contentType: ContentFormatType): string => {
  const globalRules = Object.values(GLOBAL_CONTENT_RULES).join('\n- ');
  
  const formatRules: Record<ContentFormatType, string> = {
    static_image: STATIC_POST_FORMAT_RULES,
    carousel: CAROUSEL_FORMAT_RULES,
    stories: STORIES_FORMAT_RULES,
    tweet: TWEET_FORMAT_RULES,
    thread: THREAD_FORMAT_RULES,
    short_video: REELS_FORMAT_RULES,
    reel_script: REELS_FORMAT_RULES,
    long_video: REELS_FORMAT_RULES, // Use same base, but longer
    video_script: REELS_FORMAT_RULES,
    linkedin: LINKEDIN_FORMAT_RULES,
    newsletter: CAPTION_FORMAT_RULES, // Base for text content
    blog_post: CAPTION_FORMAT_RULES,
    social_post: CAPTION_FORMAT_RULES,
    other: '',
  };

  const specificRules = formatRules[contentType] || '';
  
  return `
## REGRAS GLOBAIS DE CONTEÚDO
- ${globalRules}

${specificRules}
`;
};

// Detecção de tipo de conteúdo a partir do texto
export const detectContentType = (text: string): ContentFormatType | null => {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('carrossel') || lowerText.includes('carousel')) return 'carousel';
  if (lowerText.includes('storie') || lowerText.includes('story')) return 'stories';
  if (lowerText.includes('thread')) return 'thread';
  if (lowerText.includes('tweet') || lowerText.includes('twitter') || lowerText.includes(' x ')) return 'tweet';
  if (lowerText.includes('reel') || lowerText.includes('tiktok') || lowerText.includes('vídeo curto') || lowerText.includes('video curto')) return 'short_video';
  if (lowerText.includes('linkedin')) return 'linkedin';
  if (lowerText.includes('newsletter')) return 'newsletter';
  if (lowerText.includes('post estático') || lowerText.includes('imagem estática') || lowerText.includes('post único')) return 'static_image';
  if (lowerText.includes('roteiro') || lowerText.includes('script')) return 'video_script';
  if (lowerText.includes('blog') || lowerText.includes('artigo')) return 'blog_post';
  
  return null;
};

// Detecção de pedido de ideias
export const IDEA_REQUEST_KEYWORDS = [
  "ideias", "ideia", "sugestões", "sugestão", "me dá", "me de",
  "quero ideias", "preciso de ideias", "pode sugerir", "sugira"
];

export const isIdeaRequest = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return IDEA_REQUEST_KEYWORDS.some(keyword => lowerText.includes(keyword));
};
