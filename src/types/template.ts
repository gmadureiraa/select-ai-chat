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

### A REGRA DE OURO DO SLIDE 1
O primeiro slide tem **1 único objetivo**: fazer a pessoa deslizar para o próximo.
Não é para educar. Não é para explicar. É para **criar curiosidade irresistível**.
Se o Slide 1 não parar o scroll, o resto não importa. **Slide 1 é 80% do sucesso.**

### SLIDE 1: O GANCHO IRRESISTÍVEL (Máximo 20 palavras)

**O que NÃO fazer no Slide 1:**
❌ "Entenda como X afeta Y"
❌ "Neste carrossel você vai aprender sobre..."
❌ "Vamos falar sobre X hoje"
❌ "Descubra tudo sobre Y"
❌ "Guia completo de Z"
**Por quê?** Não cria urgência. Não cria curiosidade. Soa como aula chata.

**O que FAZER no Slide 1:**

✅ **Fórmula 1: Dor + Promessa de Solução**
Linha 1 (DOR): Problema específico com número
Linha 2 (PROMESSA): "Mas existe um segredo que..."
Exemplo: "Cada dia que seu dinheiro fica parado, você perde 0,5% dele. Mas existe um segredo que poucos conhecem..."

✅ **Fórmula 2: Pergunta Provocativa + Revelação**
Linha 1 (PERGUNTA): Pergunta que causa desconforto
Linha 2 (REVELAÇÃO): "A resposta vai te chocar..."
Exemplo: "Por que seu dinheiro vale menos hoje do que valia ontem? A resposta vai te chocar (e mostrar o que fazer agora)."

✅ **Fórmula 3: Contraste Chocante + Curiosidade**
Linha 1 (CONTRASTE): Comparação impactante com números
Linha 2 (CURIOSIDADE): "E tem gente fazendo o oposto..."
Exemplo: "R$10.000 em 2020 = R$6.000 hoje. E tem gente fazendo o oposto (aumentando patrimônio enquanto outros perdem)."

✅ **Fórmula 4: Erro Comum + Consequência**
Linha 1 (ERRO): "X% das pessoas cometem este erro..."
Linha 2 (CONSEQUÊNCIA): "E estão perdendo R$X por ano sem perceber."

✅ **Fórmula 5: Segredo Revelado + Urgência**
Linha 1 (SEGREDO): "O segredo que [grupo] usa para [benefício]"
Linha 2 (URGÊNCIA): "E você pode começar a usar hoje."

### SLIDE 2: A PONTE (Aprofunda a dor, NÃO entrega solução)

**Objetivo**: Validar a dor e criar mais curiosidade
**Regras**:
- Aprofunde a dor mencionada no Slide 1
- Mostre que você entende o problema
- NÃO entregue a solução ainda
- Termine com gancho: "Mas tem solução →", "E tem mais →", "Aqui está o problema →"

### SLIDES 3-6: O DESENVOLVIMENTO (Máximo 30 palavras por slide)

**Objetivo**: Entregar valor, educar, construir credibilidade

**Tipos de estrutura:**

**Tipo 1: Revelação de Segredo**
S3: "O segredo é [X]"
S4: "Como funciona: [explicação simples]"
S5: "Por que funciona: [dados/prova]"
S6: "Como você pode usar: [aplicação prática]"

**Tipo 2: Passo a Passo**
S3: "Passo 1: [ação específica]"
S4: "Passo 2: [ação específica]"
S5: "Passo 3: [ação específica]"
S6: "O resultado: [benefício concreto]"

**Tipo 3: Erros Comuns**
S3: "Erro 1: [erro] → Faça isso: [correção]"
S4: "Erro 2: [erro] → Faça isso: [correção]"
S5: "Erro 3: [erro] → Faça isso: [correção]"
S6: "Resultado de corrigir: [benefício]"

**Regras dos Slides 3-6:**
- 1 ideia por slide (NUNCA misture)
- Seja específico: números > adjetivos
- Use transições: "E tem mais →", "Mas não para por aí →", "Aqui está o melhor →"
- Crie progressão: cada slide leva naturalmente ao próximo

### SLIDE 7: O CTA (Recapitula + Direciona)

**O que NÃO fazer:**
❌ "Gostou? Siga para mais"
❌ "Link na bio"
❌ "Comente o que achou"

**O que FAZER:**
✅ Recapitule o benefício + CTA específico

**Fórmula**:
Linha 1 (RECAPITULAÇÃO): "Agora você sabe como [benefício alcançado]."
Linha 2 (CTA): "Quer começar hoje? Link na bio para [ação específica]."

**Exemplos de CTA forte:**
- "Seu dinheiro parado está perdendo valor agora. Comece a proteger seu patrimônio hoje. Link na bio."
- "Você acabou de descobrir o que 90% das pessoas não sabe. Não deixe esse conhecimento parado. Salve este carrossel."
- "A diferença entre ficar mais pobre e ficar mais rico é uma escolha. Faça a escolha certa. Link na bio."

### REGRAS DE OURO (OBRIGATÓRIAS):

1. **Slide 1 é 80% do sucesso**: Se não parar o scroll, o resto não importa
2. **Crie loops de curiosidade**: Use setas (→), reticências (...), "E tem mais", "Mas calma"
3. **Não seja educativo demais**: Carrossel é conversa persuasiva, não aula
   - EVITE: "Entenda", "Aprenda", "Descubra", "Vamos falar sobre"
   - USE: "Você está perdendo", "O segredo é", "Aqui está como", "Faça isso"
4. **Use números específicos**: "R$150 por mês" > "dinheiro" 
5. **Crie urgência real**: "Cada dia que passa, você perde mais" (não "ÚLTIMA CHANCE!!!")
6. **Prometa e entregue**: Se prometeu segredo, revele. Se prometeu 3 passos, dê os 3.
7. **CTA claro no final**: Nunca deixe sem direção

### CHECKLIST OBRIGATÓRIO:
- [ ] Slide 1: Cria dor/urgência/curiosidade (máx 20 palavras)
- [ ] Slide 2: Aprofunda sem entregar solução, termina com gancho
- [ ] Slides 3-6: 1 ideia por slide, específico, máx 30 palavras
- [ ] Slide 7: Recapitula benefício + CTA específico (não genérico)
- [ ] Geral: Numeração (1/7, 2/7...), tom consistente, entrega o prometido
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
  | 'x_article'
  | 'short_video' 
  | 'long_video'
  | 'linkedin_post' 
  | 'newsletter'
  | 'blog_post'
  | 'other';

export const getContentFormatRules = (contentType: ContentFormatType): string => {
  const globalRules = Object.values(GLOBAL_CONTENT_RULES).join('\n- ');
  
  const formatRules: Record<ContentFormatType, string> = {
    static_image: STATIC_POST_FORMAT_RULES,
    carousel: CAROUSEL_FORMAT_RULES,
    stories: STORIES_FORMAT_RULES,
    tweet: TWEET_FORMAT_RULES,
    thread: THREAD_FORMAT_RULES,
    x_article: THREAD_FORMAT_RULES, // Similar to thread structure
    short_video: REELS_FORMAT_RULES,
    long_video: REELS_FORMAT_RULES,
    linkedin_post: LINKEDIN_FORMAT_RULES,
    newsletter: CAPTION_FORMAT_RULES,
    blog_post: CAPTION_FORMAT_RULES,
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
  if (lowerText.includes('artigo no x') || lowerText.includes('artigo x') || lowerText.includes('artigo twitter')) return 'x_article';
  if (lowerText.includes('tweet') || lowerText.includes('twitter') || lowerText.includes(' x ')) return 'tweet';
  if (lowerText.includes('reel') || lowerText.includes('tiktok') || lowerText.includes('vídeo curto') || lowerText.includes('video curto') || lowerText.includes('short')) return 'short_video';
  if (lowerText.includes('vídeo longo') || lowerText.includes('video longo') || lowerText.includes('youtube') || lowerText.includes('roteiro')) return 'long_video';
  if (lowerText.includes('linkedin')) return 'linkedin_post';
  if (lowerText.includes('newsletter')) return 'newsletter';
  if (lowerText.includes('post estático') || lowerText.includes('imagem estática') || lowerText.includes('post único') || lowerText.includes('estático')) return 'static_image';
  if (lowerText.includes('blog') || lowerText.includes('artigo')) return 'blog_post';
  
  return null;
};

// Detecção de pedido de ideias
export const IDEA_REQUEST_KEYWORDS = [
  "ideias", "ideia", "sugestões", "sugestão", "me dá", "me de",
  "quero ideias", "preciso de ideias", "pode sugerir", "sugira",
  "brainstorm", "inspiração", "inspirar"
];

export const isIdeaRequest = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return IDEA_REQUEST_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

// Interface para parsing inteligente de pedidos de ideias
export interface IdeaRequest {
  isIdea: boolean;
  quantity: number | null;
  contentType: ContentFormatType | null;
}

// Parser inteligente que extrai quantidade e tipo de conteúdo
export const parseIdeaRequest = (text: string): IdeaRequest => {
  const lowerText = text.toLowerCase();
  
  // Detectar quantidade de ideias pedidas
  const quantityPatterns = [
    /(\d+)\s*(ideias?|sugestões?)/i,
    /(uma|duas|três|quatro|cinco|seis|sete|oito|nove|dez)\s*(ideias?|sugestões?)/i,
  ];
  
  let quantity: number | null = null;
  for (const pattern of quantityPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1];
      const numberMap: Record<string, number> = {
        'uma': 1, 'duas': 2, 'três': 3, 'quatro': 4, 'cinco': 5,
        'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10
      };
      quantity = numberMap[numStr.toLowerCase()] || parseInt(numStr);
      break;
    }
  }
  
  // Detectar tipo de conteúdo
  const contentType = detectContentType(text);
  
  // Verificar se é pedido de ideias
  const isIdea = isIdeaRequest(text) || quantity !== null;
  
  return { isIdea, quantity, contentType };
};

// Regras específicas para modo de ideias
export const IDEA_MODE_RULES = `
## 🎯 MODO IDEIAS - REGRAS OBRIGATÓRIAS

**O usuário está pedindo IDEIAS, não conteúdo final.**

### Formato de Apresentação:
Para cada ideia, use EXATAMENTE este formato:

**Ideia [N]: [Título curto e atrativo - máx 8 palavras]**
[Descrição concisa em 1-2 frases explicando o conceito]

### Regras Críticas:
1. **SEJA CONCISO**: Cada ideia deve ter no máximo 2-3 linhas TOTAL
2. **SEJA ESPECÍFICO**: Títulos claros que explicam a ideia de forma direta
3. **NUNCA COPIE**: As ideias da biblioteca são INSPIRAÇÃO - crie variações NOVAS e ORIGINAIS
4. **QUANTIDADE EXATA**: Entregue EXATAMENTE a quantidade pedida (ou 5 se não especificado)
5. **DIVERSIDADE**: Cada ideia deve ser claramente diferente das outras
6. **NÃO DESENVOLVA**: NÃO escreva o conteúdo completo, apenas a ideia resumida

### O que NÃO fazer:
- NÃO escreva o conteúdo completo de nenhuma ideia
- NÃO copie ou repita ideias que já existem na biblioteca do cliente
- NÃO inclua CTAs, estruturas completas, textos longos ou formatação final
- NÃO repita ideias similares com palavras diferentes
- NÃO inclua emojis no título das ideias
- NÃO numere dentro do título (o número vem antes)

### Exemplo de Resposta CORRETA:

**Ideia 1: O mito do trabalho duro**
Desmistificar que trabalhar mais horas = mais sucesso. Mostrar dados sobre produtividade real.

**Ideia 2: Antes e depois do método X**
Comparação visual entre a rotina antiga vs. nova abordagem otimizada com resultados.

**Ideia 3: 5 sinais de que você está no caminho certo**
Lista de indicadores positivos de progresso que passam despercebidos no dia a dia.

### Exemplo de Resposta INCORRETA (evite):
❌ Ideia muito longa com explicação detalhada que desenvolve todo o conteúdo e já entrega a estrutura final com CTA e formatação...
❌ "Ideia 1: 🚀 Uma ideia incrível que vai mudar sua vida!" (emojis e título vago)
❌ Repetir uma ideia que já está na biblioteca do cliente
`;
