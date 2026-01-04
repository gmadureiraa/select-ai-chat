export interface StyleAnalysis {
  style_summary?: string;
  visual_elements?: {
    photography_style?: string;
    lighting?: string;
    color_palette?: string[];
    dominant_mood?: string;
    composition?: string;
  };
  recurring_elements?: string[];
  brand_elements?: {
    logo_style?: string;
    typography?: string;
    product_presentation?: string;
  };
  technical_specs?: {
    aspect_ratio?: string;
    resolution_feel?: string;
    post_processing?: string;
  };
  generation_prompt_template?: string;
}

// =====================================================
// INSTRUÇÕES TÉCNICAS POR FORMATO DE IMAGEM
// =====================================================

export interface ImageFormatSpec {
  aspectRatio: string;
  resolution: "1K" | "2K" | "4K";
  width: number;
  height: number;
  instructions: string;
}

export const IMAGE_FORMAT_INSTRUCTIONS: Record<string, ImageFormatSpec> = {
  "post_instagram": {
    aspectRatio: "1:1",
    resolution: "1K",
    width: 1080,
    height: 1080,
    instructions: `POST INSTAGRAM (1080x1080 - Feed Quadrado):

COMPOSIÇÃO:
- Foco visual no CENTRO da imagem (80% dos usuários veem no mobile)
- Hierarquia: Elemento principal → Texto de apoio → Logo discreto (canto)
- Deixe margem segura de 5% nas bordas para não cortar em previews

TEXTO NA IMAGEM:
- Máximo 15 palavras no total (ideal: 5-10)
- Fonte grande, bold, legível em thumbnail pequeno
- Contraste ALTO: texto claro em fundo escuro ou vice-versa
- Evite texto nas bordas (pode ser cortado em diferentes displays)

ELEMENTOS VISUAIS:
- Cores vibrantes e saturadas (se destacam no feed)
- Um elemento focal forte (não disperse atenção)
- Espaço para legenda abaixo - não coloque info crítica no rodapé

QUALIDADE:
- Resolução mínima 1080x1080px
- Evite muitos detalhes pequenos (perdem-se no mobile)
- Priorize clareza sobre complexidade`
  },

  "story_reels": {
    aspectRatio: "9:16",
    resolution: "1K",
    width: 1080,
    height: 1920,
    instructions: `STORY/REELS INSTAGRAM (1080x1920 - Vertical):

ZONAS SEGURAS (CRÍTICO!):
- TOPO 15%: Evite texto/elementos (UI do Instagram cobre)
- RODAPÉ 20%: Evite texto/elementos (área do CTA/username)
- CENTRO 65%: Zona segura para conteúdo principal

COMPOSIÇÃO VERTICAL:
- Pense em "escaneamento vertical" (olho vai de cima pra baixo)
- Elemento principal no centro vertical
- Texto em blocos curtos, não parágrafos

TEXTO:
- Fonte mínima equivalente a 28pt (legível em mobile)
- Máximo 3 linhas por bloco de texto
- Contraste extremo (branco com sombra em qualquer fundo)

ELEMENTOS:
- Movimento visual (linhas diagonais, elementos dinâmicos)
- Rostos/pessoas quando relevante (aumenta retenção)
- Áreas clicáveis claras para CTAs interativos

RITMO:
- Cada story deve ter 1 mensagem clara
- Sequência conta uma história progressiva`
  },

  "thumbnail_youtube": {
    aspectRatio: "16:9",
    resolution: "2K",
    width: 1920,
    height: 1080,
    instructions: `THUMBNAIL YOUTUBE (1920x1080 - Máxima Qualidade):

REGRA #1 - TEXTO GIGANTE:
- Deve ser legível em tamanho de SELO (120x68px no browse)
- Máximo 5-7 palavras, fonte ULTRA BOLD
- Contorno/sombra obrigatório para contraste
- Posição: 1/3 esquerdo ou direito (nunca centro exato)

ROSTO HUMANO (se aplicável):
- Expressão FORTE e exagerada: surpresa, dúvida, empolgação, choque
- Olhos bem visíveis, olhando para câmera ou para o texto
- Ocupa 30-50% do frame

CORES E CONTRASTE:
- Saturação ALTA (YouTube comprime cores)
- Cores que contrastam: amarelo/azul, vermelho/branco, laranja/preto
- Fundo simples: gradiente, blur, ou sólido
- Evite fundos detalhados (competem com texto)

ELEMENTOS DE CURIOSIDADE:
- Setas apontando para algo
- Círculos destacando elementos
- "?" ou "!" grandes
- Números impactantes

O TESTE FINAL:
- Reduza para 120x68px - ainda é legível e intrigante?
- Conta uma HISTÓRIA em 1 segundo?
- Gera curiosidade de clicar?`
  },

  "carousel_slide": {
    aspectRatio: "1:1",
    resolution: "1K",
    width: 1080,
    height: 1080,
    instructions: `SLIDE DE CARROSSEL (1080x1080):

CONSISTÊNCIA VISUAL:
- TODOS os slides devem parecer parte do mesmo conjunto
- Mesma paleta de cores, tipografia, estilo gráfico
- Elementos de navegação consistentes (numeração, setas)

POR SLIDE:
- 1 ideia = 1 slide (nunca misture conceitos)
- Máximo 30 palavras por slide
- Hierarquia clara: título → corpo → detalhe

SLIDE 1 (CAPA):
- Gancho forte, curiosidade máxima
- Texto grande e impactante
- Indica que é carrossel (→ ou "Deslize")

SLIDES INTERMEDIÁRIOS:
- Desenvolvimento progressivo
- Numeração visível (2/7, 3/7...)
- Transições visuais suaves

SLIDE FINAL:
- CTA claro e específico
- Recapitulação visual do valor entregue
- "Salve", "Compartilhe", "Siga para mais"`
  },

  "banner_linkedin": {
    aspectRatio: "4:1",
    resolution: "1K",
    width: 1584,
    height: 396,
    instructions: `BANNER LINKEDIN (1584x396 - Profissional):

DESIGN CORPORATIVO:
- Limpo, profissional, sofisticado
- Cores da marca predominantes
- Evite elementos "divertidos" demais

COMPOSIÇÃO HORIZONTAL:
- Foto de perfil sobrepõe lado ESQUERDO (deixe espaço)
- Elementos principais no centro-direita
- Gradientes sutis ou fundos sólidos

TEXTO (se houver):
- Nome/cargo OU tagline curta
- Máximo 10 palavras
- Fonte profissional (sans-serif)

ELEMENTOS:
- Padrões geométricos sutis
- Ícones de expertise/serviços
- Elementos que comuniquem posicionamento`
  },

  "capa_newsletter": {
    aspectRatio: "2:1",
    resolution: "1K",
    width: 1200,
    height: 600,
    instructions: `CAPA DE NEWSLETTER (1200x600 - Email Header):

CONTEXTO DE VISUALIZAÇÃO:
- Aparece em preview pequeno no inbox
- Deve funcionar em 300px de largura também
- Evite detalhes que se perdem em tamanho reduzido

ELEMENTOS ESSENCIAIS:
- Título/tema da edição em destaque
- Identidade visual consistente com edições anteriores
- Número da edição (se aplicável)

DESIGN EDITORIAL:
- Limpo e legível
- Paleta de cores consistente com a marca
- Elementos gráficos que não competem com texto

EVITAR:
- Fotos com muitos detalhes
- Texto pequeno
- Mais de 3 elementos visuais competindo`
  },

  "twitter_post": {
    aspectRatio: "16:9",
    resolution: "1K",
    width: 1200,
    height: 675,
    instructions: `IMAGEM PARA X/TWITTER (1200x675):

FORMATO LANDSCAPE:
- Preview corta para ~2:1 no feed - centralizar elementos
- Texto deve ser legível mesmo cortado

SIMPLICIDADE:
- 1 mensagem visual clara
- Fundo limpo (não compete com texto do tweet)
- Cores que se destacam do fundo branco/preto do X

TEXTO NA IMAGEM:
- Complementa o tweet, não repete
- Máximo 10 palavras
- Fonte bold, contraste alto

MEMES/CHARTS:
- Dados visualizados de forma clara
- Gráficos simples e legíveis
- Referências visuais que agregam ao texto`
  },

  "arte_generica": {
    aspectRatio: "1:1",
    resolution: "1K",
    width: 1080,
    height: 1080,
    instructions: `ARTE GENÉRICA (1080x1080 - Versátil):

COMPOSIÇÃO FLEXÍVEL:
- Centro forte (pode ser cortado para outros formatos)
- Margem segura de 10% nas bordas
- Hierarquia visual clara

ADAPTABILIDADE:
- Funciona em quadrado (1:1)
- Pode ser cortado para 4:5 ou 16:9 se necessário
- Elementos importantes no centro

PADRÃO DE QUALIDADE:
- Logo/marca presente de forma sutil
- Paleta consistente com identidade visual
- Profissional e polido`
  }
};

// Detectar formato de imagem baseado no nome do template
export function detectImageFormat(templateName?: string): string {
  if (!templateName) return "arte_generica";
  
  const nameLower = templateName.toLowerCase();
  
  // Thumbnail YouTube
  if (nameLower.includes("thumbnail") || 
      (nameLower.includes("youtube") && !nameLower.includes("script"))) {
    return "thumbnail_youtube";
  }
  
  // Stories/Reels (vertical)
  if (nameLower.includes("story") || 
      nameLower.includes("stories") || 
      nameLower.includes("reels") ||
      nameLower.includes("tiktok")) {
    return "story_reels";
  }
  
  // Carrossel
  if (nameLower.includes("carrossel") || 
      nameLower.includes("carousel") ||
      nameLower.includes("slide")) {
    return "carousel_slide";
  }
  
  // Post Instagram (feed)
  if ((nameLower.includes("post") || nameLower.includes("feed")) && 
      (nameLower.includes("instagram") || nameLower.includes("insta"))) {
    return "post_instagram";
  }
  
  // LinkedIn
  if (nameLower.includes("linkedin") || 
      nameLower.includes("banner")) {
    return "banner_linkedin";
  }
  
  // Newsletter
  if (nameLower.includes("newsletter") || 
      nameLower.includes("capa") ||
      nameLower.includes("email")) {
    return "capa_newsletter";
  }
  
  // Twitter/X
  if (nameLower.includes("twitter") || 
      nameLower.includes("tweet") ||
      nameLower.includes(" x ")) {
    return "twitter_post";
  }
  
  return "arte_generica";
}

// Obter especificações de formato
export function getImageFormatSpec(formatOrTemplateName: string): ImageFormatSpec {
  // Se já é um formato conhecido, retorna diretamente
  if (IMAGE_FORMAT_INSTRUCTIONS[formatOrTemplateName]) {
    return IMAGE_FORMAT_INSTRUCTIONS[formatOrTemplateName];
  }
  
  // Senão, tenta detectar pelo nome do template
  const detectedFormat = detectImageFormat(formatOrTemplateName);
  return IMAGE_FORMAT_INSTRUCTIONS[detectedFormat] || IMAGE_FORMAT_INSTRUCTIONS["arte_generica"];
}

export interface TemplateRule {
  id: string;
  content: string;
  type?: 'text' | 'image_reference' | 'content_reference';
  file_url?: string; // For image references or content files
  styleAnalysis?: StyleAnalysis; // For style analysis rules
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

// Mapeamento de nome do template para tipo de conteúdo
// Nota: Os valores são strings que correspondem a ContentFormatType definido mais abaixo
export const TEMPLATE_NAME_TO_CONTENT_TYPE: Record<string, string> = {
  "Newsletter": "newsletter",
  "Carrossel Instagram": "carousel",
  "Carrossel": "carousel",
  "Stories": "stories",
  "Story": "stories",
  "Tweet": "tweet",
  "Thread": "thread",
  "Artigo no X": "x_article",
  "Artigo X": "x_article",
  "Post LinkedIn": "linkedin_post",
  "LinkedIn": "linkedin_post",
  "Vídeo Curto": "short_video",
  "Reels": "short_video",
  "TikTok": "short_video",
  "Vídeo Longo": "long_video",
  "YouTube": "long_video",
  "Blog Post": "blog_post",
  "Artigo Blog": "blog_post",
  "Estático": "static_image",
  "Post Estático": "static_image",
  "Post Instagram": "instagram_post",
  "Instagram Post": "instagram_post",
  "Legenda Instagram": "instagram_post",
};

export const DEFAULT_IMAGE_RULES: string[] = [
  "SEMPRE use o logo do cliente de forma sutil e elegante",
  "Mantenha consistência absoluta com a paleta de cores da marca",
  "Qualidade: Ultra-alta resolução, digna de publicação profissional em redes sociais",
  "Composição: Equilibrada, com espaço para texto se necessário",
  "Estilo: Respeitar referências visuais cadastradas do cliente",
  "Formato: Otimizado para a plataforma de destino (Instagram 1080x1080, Stories 1080x1920, etc.)",
  "Tipografia: Usar fontes consistentes com a identidade visual da marca",
  "Profundidade: Criar interesse visual com camadas, sombras sutis e hierarquia clara",
];

// Regras globais de formato
export const GLOBAL_CONTENT_RULES = {
  emoji: "EVITE emojis a menos que seja extremamente necessário. NUNCA use emojis no meio de frases ou de forma desnecessária. Máximo 3-5 emojis por conteúdo quando realmente necessários.",
  clarity: "1 conteúdo = 1 mensagem = 1 objetivo. Seja claro e direto.",
  specificity: "Seja específico: Números > Adjetivos. Dados > Opiniões. '50% mais rápido' > 'Muito mais rápido'",
  hook: "Primeiros 3 segundos/primeira linha decidem tudo. O gancho é CRÍTICO.",
  cta: "SEMPRE tenha um CTA. 1 CTA por conteúdo. Não confunda o usuário.",
  value: "Se não é útil, educativo, inspirador ou divertido, não publique.",
  slideFormatting: "SEMPRE pule uma linha em branco após o fim de cada slide/página em conteúdos multi-página (carrossel, stories, threads). Use '---PÁGINA N---' ou '---SLIDE N---' como separador, seguido de linha em branco antes do próximo conteúdo.",
  antiRepetition: "PROIBIDO repetir estruturas de frase, palavras-chave emocionais ou transições entre slides/páginas. Cada parte do conteúdo deve ter linguagem única e variada.",
  storytelling: "PRIORIZE storytelling e fatos concretos sobre frases de impacto genéricas. Conte histórias reais, use dados específicos, mostre ao invés de afirmar.",
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

### 🚫 REGRAS ANTI-REPETIÇÃO (CRÍTICAS!)

**PROIBIÇÕES ABSOLUTAS:**
- ❌ Usar mais de 1 frase de impacto por carrossel inteiro
- ❌ Repetir estruturas de frase entre slides ("Você está perdendo X", "Você não sabe Y", "O segredo é Z")
- ❌ Usar as mesmas transições ("E tem mais", "Mas calma", "Agora vem o melhor") mais de uma vez
- ❌ Repetir palavras-chave emocionais (perder, segredo, chocante, transformar) em slides consecutivos
- ❌ Começar slides com a mesma estrutura ("Passo 1:", "Passo 2:" pode, mas variando a estrutura da frase)

**PALAVRAS/FRASES COM LIMITE (máximo 1 ocorrência por carrossel):**
- "segredo", "revelação", "chocante", "ninguém te conta"
- "você está perdendo", "a maioria não sabe", "poucos conhecem"
- "transformar/transformação", "mudar sua vida"
- "urgente", "última chance", "antes que seja tarde"

### 📖 STORYTELLING > FRASES DE IMPACTO

**PRINCÍPIO FUNDAMENTAL:** Conte uma história, não faça declarações vazias.

**O que FAZER:**
✅ Use casos reais: "João tinha R$10.000 parados. Em 12 meses, esse dinheiro rendeu R$800."
✅ Dê fatos específicos: "Em 2024, a inflação acumulada foi 4,62%"
✅ Mostre, não diga: "Gastei 2h por dia por 6 meses = 360 horas investidas" (ao invés de "dediquei muito tempo")
✅ Conte jornadas: "Comecei com R$500. Errei, ajustei, aprendi. Hoje tenho X."
✅ Use comparações concretas: "R$1.000 em 2020 = R$740 de poder de compra hoje"

**O que NÃO fazer:**
❌ "Você está perdendo dinheiro!" (vago, sem contexto)
❌ "O segredo que vai mudar sua vida" (promessa vazia)
❌ "A maioria das pessoas não sabe disso" (genérico)
❌ Acumular palavras de impacto sem substância

### 🎭 TOM DE VOZ POR SLIDE (Variedade Obrigatória)

**Slide 1 - TOM: CURIOSIDADE**
- Objetivo: Despertar interesse genuíno, não urgência artificial
- Use: Pergunta intrigante, dado surpreendente, história iniciada
- Evite: "URGENTE!", "VOCÊ PRECISA SABER!", exclamações excessivas
- Exemplo: "Meu avô guardava dinheiro no colchão. Descobri quanto ele perdeu em 40 anos."

**Slide 2 - TOM: EMPATIA/VALIDAÇÃO**
- Objetivo: Conectar-se com a dor/situação do leitor
- Use: "Eu também passei por isso", "É frustrante quando...", dados que validam
- Evite: Julgamento, superioridade, mais urgência
- Exemplo: "Quando vi minha primeira fatura de cartão, entendi a sensação de perder o controle."

**Slides 3-5 - TOM: EDUCATIVO/INFORMATIVO**
- Objetivo: Entregar valor real com dados e exemplos
- Use: Números específicos, passos práticos, exemplos reais
- Evite: Frases motivacionais vazias, repetir o gancho
- Exemplo: "Passo 1: Anote TODOS os gastos por 30 dias. Use planilha ou app - o método importa menos que a consistência."

**Slide 6 - TOM: PRÁTICO/APLICAÇÃO**
- Objetivo: Dar o próximo passo concreto
- Use: "Faça isso agora:", "Comece por:", ação específica
- Evite: Teoria, mais dados, filosofia
- Exemplo: "Hoje: Abra seu extrato e some seus gastos fixos. Esse número é seu ponto de partida."

**Slide 7 - TOM: INSPIRAÇÃO SUTIL + CTA**
- Objetivo: Fechar com esperança realista e direção clara
- Use: Resultado alcançável, CTA específico
- Evite: Promessas irreais, urgência falsa, "ÚLTIMA CHANCE"
- Exemplo: "Daqui 6 meses, você pode olhar pra trás e ver a diferença. O primeiro passo é hoje."

### 📐 ESTRUTURA DE SLIDES

**SLIDE 1: O GANCHO (Máximo 20 palavras)**
Use UMA destas fórmulas (escolha a mais adequada):

**Fórmula 1: História Iniciada**
"[Situação pessoal ou de alguém]. [O que descobri/aconteceu]."
Ex: "Meu pai nunca investiu. Calculei quanto ele perdeu em 30 anos."

**Fórmula 2: Dado + Consequência**
"[Estatística específica]. [O que isso significa para você]."
Ex: "R$1.000 em 2015 = R$620 de poder de compra hoje. Sua poupança fez isso com você."

**Fórmula 3: Pergunta Genuína**
"[Pergunta sobre situação comum]?"
Ex: "Quanto do seu salário sobra no dia 30? Se a resposta te incomoda, leia até o fim."

**Fórmula 4: Contraste Real**
"[Situação A] vs [Situação B]. [Observação]."
Ex: "Dois amigos, mesmo salário. Um tem R$50k guardados, outro deve R$20k. A diferença não é sorte."

**SLIDE 2: A PONTE (Máximo 30 palavras)**
- Aprofunde o contexto do Slide 1
- Mostre que você entende a situação
- Termine com transição natural (não forçada)
- Ex: "Eu era o segundo amigo. Vivia no vermelho achando que o problema era ganhar pouco. Não era."

**SLIDES 3-6: O DESENVOLVIMENTO (Máximo 30 palavras cada)**

**Estrutura Recomendada - Jornada/Caso Real:**
S3: "O primeiro passo foi [ação específica]. Resultado: [o que mudou]"
S4: "Depois, [próxima ação]. Isso revelou que [insight]"
S5: "O ponto de virada: [momento específico com dados]"
S6: "Hoje: [situação atual com números concretos]"

**Estrutura Alternativa - Passos Práticos:**
S3: "Passo 1: [ação] - [por que funciona em 1 frase]"
S4: "Passo 2: [ação] - [exemplo prático]"
S5: "Passo 3: [ação] - [resultado esperado com prazo]"
S6: "O que esperar: [timeline realista]"

**SLIDE 7: O FECHAMENTO (Máximo 25 palavras)**
- Recapitule o benefício de forma sutil
- CTA específico (não genérico)
- Ex: "6 meses de consistência mudaram minha relação com dinheiro. O primeiro passo? Anotar hoje."

### ✅ CHECKLIST OBRIGATÓRIO:

**Anti-Repetição:**
- [ ] Máximo 1 frase de impacto em TODO o carrossel
- [ ] Nenhuma palavra/expressão proibida repetida
- [ ] Cada slide tem estrutura de frase diferente
- [ ] Transições variadas (não repete "E tem mais", "Mas calma")

**Storytelling:**
- [ ] Pelo menos 1 caso real ou história pessoal
- [ ] Mínimo 2 dados/números específicos no carrossel
- [ ] Mais fatos do que afirmações de impacto
- [ ] "Mostrar" > "Dizer" (exemplos concretos)

**Tom de Voz:**
- [ ] Slide 1: Tom de curiosidade (não urgência)
- [ ] Slide 2: Tom empático/conectivo
- [ ] Slides 3-5: Tom educativo com dados
- [ ] Slide 6: Tom prático/ação
- [ ] Slide 7: Tom inspirador sutil + CTA claro

**Estrutura:**
- [ ] Slide 1: Máx 20 palavras, cria curiosidade
- [ ] Slide 2: Aprofunda sem entregar solução
- [ ] Slides 3-6: 1 ideia por slide, máx 30 palavras
- [ ] Slide 7: Recapitula + CTA específico
- [ ] Numeração (1/7, 2/7...) presente
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
// NOVAS REGRAS ESPECÍFICAS POR FORMATO
// =====================================================

// Regras específicas para Newsletter (NOVO - baseado em pesquisa)
export const NEWSLETTER_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA NEWSLETTER

### 📊 MÉTRICAS DE SUCESSO
- Taxa de abertura ideal: 20-40%
- Taxa de clique ideal: 2-5%
- Comprimento ideal: 500-1500 palavras (depende do formato)

### 📧 ESTRUTURA COMPLETA

**1. LINHA DE ASSUNTO (Subject Line)** - CRÍTICO!
- Máximo 50 caracteres (40-50 ideal para mobile)
- Objetivos: Curiosidade, Urgência, Benefício ou Personalização
- Fórmulas que funcionam:
  - "Como [resultado] em [tempo]" → "Como dobramos faturamento em 90 dias"
  - "O que [grupo] está fazendo [ação]" → "O que investidores estão comprando agora"
  - "[Número] [coisas] para [benefício]" → "5 ferramentas para automatizar seu marketing"
  - Pergunta direta → "Você está perdendo dinheiro sem saber?"
- EVITE: ALL CAPS, excesso de emojis, palavras spam (grátis, urgente, última chance)

**2. PREVIEW TEXT (Preheader)**
- Máximo 90 caracteres
- Complementa o assunto, não repete
- Funciona como segundo gancho

**3. ABERTURA (Primeiros 100 palavras)**
- Gancho forte: História, dado surpreendente ou pergunta
- Conecte com a dor/desejo do leitor imediatamente
- Estabeleça relevância: "Por que isso importa AGORA"
- Tom pessoal: Use "você" e fale diretamente com o leitor

**4. CORPO PRINCIPAL**
Estruturas recomendadas:

**Formato Curadoria:**
- 3-5 itens selecionados com valor
- Cada item: Título + Resumo (2-3 frases) + Link/Recurso
- Seu comentário/insight sobre cada item

**Formato Educativo:**
- 1 tema profundo, bem desenvolvido
- Estrutura: Problema → Contexto → Solução → Aplicação
- Subseções com headings claros
- Bullet points para facilitar leitura

**Formato Storytelling:**
- História pessoal ou case real
- Arco narrativo: Situação → Conflito → Resolução → Lição
- Conexão emocional antes de ensinar

**5. CALL-TO-ACTION (CTA)**
- 1 CTA principal (não confunda o leitor)
- Botão ou link destacado visualmente
- Texto de ação específico: "Leia o artigo completo" > "Clique aqui"
- Posição: Após cada seção importante + final

**6. FECHAMENTO**
- Assinatura pessoal (humaniza)
- PS/P.S. opcional (alta taxa de leitura!)
- Preview do próximo envio (cria expectativa)

### ✅ CHECKLIST OBRIGATÓRIO:
- [ ] Assunto com menos de 50 caracteres
- [ ] Preview text complementar (não repetitivo)
- [ ] Gancho nos primeiros 100 palavras
- [ ] Parágrafos curtos (máx 3-4 linhas)
- [ ] Headings para dividir seções
- [ ] 1 CTA principal claramente destacado
- [ ] Formatação escaneável (bullet points, negrito)
- [ ] Tom pessoal e conversacional
- [ ] Valor real entregue (não apenas promoção)
- [ ] Links funcionais e relevantes

### 📝 FORMATO DE ENTREGA:
**ASSUNTO:** [Linha de assunto]
**PREVIEW:** [Preview text]

---

[Corpo da newsletter completo]

---

**CTA:** [Call-to-action principal]
`;

// Regras específicas para Vídeo Longo/YouTube (NOVO - baseado em pesquisa)
export const LONG_VIDEO_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA VÍDEO LONGO (YOUTUBE)

### 📊 MÉTRICAS DE SUCESSO
- Retenção ideal: >50% até metade do vídeo
- CTR de thumbnail: >4%
- Duração ideal: 8-20 minutos (nicho-dependente)
- Watch time: Métrica mais importante para algoritmo

### 🎬 ESTRUTURA DE ROTEIRO COMPLETO

**1. GANCHO (0:00-0:30)** - CRÍTICO!
- Primeiros 5 segundos decidem se continua
- Objetivo: Prender atenção e criar expectativa
- Técnicas:
  - Open loop: "Ao final, você vai entender por que..."
  - Promessa clara: "Vou te mostrar exatamente como..."
  - Dado/história impactante que gera curiosidade
  - Mostrar resultado antes do processo
- NUNCA: "Oi, tudo bem? Hoje vamos falar sobre..."

**2. INTRODUÇÃO (0:30-2:00)**
- Apresente o problema/tema claramente
- Estabeleça credibilidade rapidamente
- Mencione o que será coberto (roadmap do vídeo)
- Peça inscrição com motivo: "Inscreva-se para não perder [benefício]"

**3. DESENVOLVIMENTO (2:00 até -2:00)**
Estruture em capítulos claros (5-7 minutos cada):

**Cada capítulo deve ter:**
- Título claro (aparece na timeline do YouTube)
- Mini-gancho de abertura
- Conteúdo principal
- Transição para próximo ponto
- Pattern interrupt a cada 3-5 min (mudança de cena, gráfico, B-roll)

**Técnicas de Retenção:**
- Storytelling: Conte histórias para ilustrar pontos
- Dados visuais: Gráficos, animações, exemplos na tela
- Perguntas retóricas: Engaja o espectador
- Antecipação: "Mas tem algo mais importante..."
- Humor/surpresa pontuais para quebrar monotonia

**4. CONCLUSÃO (Últimos 2:00)**
- Recapitule os pontos principais
- Call-to-action principal (1 CTA forte)
- Preview do próximo vídeo (retenção de canal)
- Sugestão de vídeo relacionado (aumenta watch time)

### 📋 ELEMENTOS ADICIONAIS

**TÍTULO DO VÍDEO:**
- Máximo 60 caracteres (60-70 visível)
- Keyword principal no início
- Gatilho emocional ou numérico
- Fórmulas: "Como [resultado]", "[Número] [coisas] para [benefício]", "Por que [afirmação contraintuitiva]"

**THUMBNAIL (Descrição):**
- Rosto com expressão forte (se aplicável)
- Texto curto (3-4 palavras máximo)
- Cores contrastantes e vibrantes
- Não repita o título exatamente

**DESCRIÇÃO:**
- Primeiras 2 linhas: Resumo + hook (aparecem antes do "mostrar mais")
- Timestamps/capítulos (OBRIGATÓRIO)
- Links relevantes
- Hashtags (3-5 relevantes)

### ✅ CHECKLIST OBRIGATÓRIO:
- [ ] Gancho nos primeiros 5 segundos
- [ ] Promessa clara do que será entregue
- [ ] Divisão em capítulos com títulos
- [ ] Pattern interrupts a cada 3-5 minutos
- [ ] CTA de inscrição na introdução
- [ ] Recapitulação no final
- [ ] 1 CTA principal claro
- [ ] Timestamps na descrição

### 📝 FORMATO DE ENTREGA:

**TÍTULO:** [Título do vídeo]
**THUMBNAIL:** [Descrição visual da thumbnail ideal]

**ROTEIRO:**

[0:00-0:30] GANCHO
[Texto do gancho com ação/visual]

[0:30-2:00] INTRODUÇÃO
[Texto da introdução]

[CAPÍTULO 1: Título] (2:00-X:XX)
[Conteúdo do capítulo]

[CAPÍTULO 2: Título] (X:XX-X:XX)
[Conteúdo do capítulo]

[Continue para todos os capítulos...]

[CONCLUSÃO] (X:XX até fim)
[Recapitulação e CTAs]

**DESCRIÇÃO:**
[Texto da descrição com timestamps]
`;

// Regras específicas para Blog Post (NOVO - baseado em pesquisa)
export const BLOG_POST_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA BLOG POST/ARTIGO

### 📊 MÉTRICAS DE SUCESSO
- Tempo na página: >3 minutos
- Taxa de scroll: >70%
- Compartilhamentos e backlinks
- Conversão do CTA

### 📝 ESTRUTURA COMPLETA

**1. TÍTULO (H1)** - SEO + Curiosidade
- Máximo 60 caracteres (SEO)
- Keyword principal no início
- Número ou promessa clara
- Fórmulas:
  - "Guia Completo: [Tema]"
  - "[Número] [Coisas] para [Resultado]"
  - "Como [Resultado] em [Tempo/Passos]"
  - "[Tema]: Tudo que Você Precisa Saber"

**2. META DESCRIPTION**
- 150-160 caracteres
- Keyword natural
- Proposta de valor clara
- CTA implícito ("Descubra", "Aprenda", "Entenda")

**3. INTRODUÇÃO (150-200 palavras)**
- Gancho: Dado, história ou pergunta
- Estabeleça o problema/necessidade
- Prometa a solução (o que o artigo vai entregar)
- Mencione brevemente o que será coberto
- Bucket brigades: "E é exatamente isso que você vai aprender."

**4. CORPO (1500-3000 palavras)**
Estruture com hierarquia clara:

**H2: Seção Principal 1**
- 2-3 parágrafos de contexto
- Bullet points ou lista numerada
- Exemplo prático ou dado
- Transição para próxima seção

**H3: Subseção 1.1** (se necessário)
- Aprofundamento do tópico
- Mantenha parágrafos curtos (3-4 linhas)

**Elementos de Formatação:**
- Negrito para termos importantes
- Listas para facilitar escaneamento
- Citações/blockquotes para destaque
- Imagens/gráficos a cada 300-500 palavras

**5. CONCLUSÃO (100-150 palavras)**
- Recapitule os pontos principais (3-5 bullets)
- Reforce o benefício de aplicar o conteúdo
- CTA claro e específico
- Pergunta para gerar comentários

### 🔍 OTIMIZAÇÃO SEO:
- Keyword principal no H1, primeiro parágrafo, 1 H2
- Keywords secundárias distribuídas naturalmente
- Links internos (2-5 para outros artigos)
- Links externos (1-3 para fontes autoritativas)
- Alt text em todas as imagens
- URL amigável (keyword-no-titulo)

### ✅ CHECKLIST OBRIGATÓRIO:
- [ ] Título com keyword e <60 caracteres
- [ ] Meta description com 150-160 caracteres
- [ ] Introdução com gancho e promessa
- [ ] Hierarquia H2/H3 clara
- [ ] Parágrafos curtos (máx 4 linhas)
- [ ] Listas e bullet points
- [ ] Pelo menos 1 imagem/gráfico
- [ ] Links internos e externos
- [ ] Conclusão com recapitulação
- [ ] CTA claro no final

### 📝 FORMATO DE ENTREGA:

**TÍTULO:** [Título H1]
**META DESCRIPTION:** [Meta description]
**URL SUGERIDA:** /[url-amigavel]

---

## [Título H1]

[Introdução - 150-200 palavras]

## [H2: Primeira Seção Principal]

[Conteúdo da seção]

### [H3: Subseção se necessário]

[Conteúdo da subseção]

[Continue para todas as seções...]

## Conclusão

[Recapitulação + CTA]
`;

// Regras específicas para Artigo no X (NOVO - baseado em pesquisa)
export const X_ARTICLE_FORMAT_RULES = `
## FORMATO OBRIGATÓRIO PARA ARTIGO NO X (TWITTER)

### 📊 CARACTERÍSTICAS DO FORMATO
- Máximo: 25.000 caracteres (~4.000 palavras)
- Formato longo nativo do X
- Permite imagens inline, formatação rica
- Diferente de threads: é um artigo único, não tweets conectados

### 📝 ESTRUTURA COMPLETA

**1. TÍTULO**
- Máximo 100 caracteres
- Impactante e claro
- Evite clickbait exagerado
- Pode usar emoji no início (1 máximo)

**2. IMAGEM DE CAPA** (Obrigatória)
- Aspecto 16:9 recomendado
- Visual que represente o tema
- Texto mínimo (o título já aparece)

**3. ABERTURA (Primeiros 2 parágrafos)**
- Gancho forte imediato
- Estabeleça por que o leitor deve continuar
- Tom pessoal funciona bem no X
- Pode começar com uma afirmação provocativa

**4. CORPO DO ARTIGO**

**Estrutura recomendada:**
- Parágrafos curtos (2-3 linhas)
- Quebras frequentes (escaneabilidade)
- Use headings para dividir seções
- Imagens inline para ilustrar pontos

**Formatação disponível:**
- **Negrito** para ênfase
- *Itálico* para nuances
- Listas numeradas e com bullets
- Citações em bloco
- Links (use com moderação)

**5. IMAGENS INLINE**
- Use 2-5 imagens ao longo do artigo
- Cada imagem deve agregar valor
- Gráficos, screenshots, exemplos visuais
- Posicione após o parágrafo que referencia

**6. CONCLUSÃO**
- Recapitulação breve (não extensa)
- Opinião ou posicionamento final
- CTA para engajamento (perguntar opinião)

### 🎯 BOAS PRÁTICAS DO X:
- Tom conversacional funciona melhor
- Opiniões fortes geram mais engajamento
- Dados e exemplos específicos > generalidades
- Histórias pessoais conectam
- Controvérsia controlada aumenta alcance

### ✅ CHECKLIST OBRIGATÓRIO:
- [ ] Título impactante <100 caracteres
- [ ] Imagem de capa de qualidade
- [ ] Gancho forte na abertura
- [ ] Parágrafos curtos e escaneáveis
- [ ] Pelo menos 3 imagens inline
- [ ] Seções divididas com headings
- [ ] Tom pessoal/opinativo
- [ ] CTA de engajamento no final
- [ ] Comprimento: 1500-4000 palavras

### 📝 FORMATO DE ENTREGA:

**TÍTULO:** [Título do artigo]
**CAPA:** [Descrição da imagem de capa]

---

[Corpo completo do artigo com marcações para imagens]

[IMAGEM: descrição da imagem a inserir]

[Continuação do texto...]

---

**CTA FINAL:** [Pergunta ou chamada para engajamento]
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
  | 'instagram_post'
  | 'other';

export const getContentFormatRules = (contentType: ContentFormatType): string => {
  const globalRules = Object.values(GLOBAL_CONTENT_RULES).join('\n- ');
  
  const formatRules: Record<ContentFormatType, string> = {
    static_image: STATIC_POST_FORMAT_RULES,
    carousel: CAROUSEL_FORMAT_RULES,
    stories: STORIES_FORMAT_RULES,
    tweet: TWEET_FORMAT_RULES,
    thread: THREAD_FORMAT_RULES,
    x_article: X_ARTICLE_FORMAT_RULES,
    short_video: REELS_FORMAT_RULES,
    long_video: LONG_VIDEO_FORMAT_RULES,
    linkedin_post: LINKEDIN_FORMAT_RULES,
    newsletter: NEWSLETTER_FORMAT_RULES,
    blog_post: BLOG_POST_FORMAT_RULES,
    instagram_post: CAPTION_FORMAT_RULES,
    other: '',
  };

  const specificRules = formatRules[contentType] || '';
  
  return `
## REGRAS GLOBAIS DE CONTEÚDO
- ${globalRules}

${specificRules}
`;
};

// Função para obter regras padrão de template baseado no nome
export const getDefaultRulesForTemplateName = (templateName: string): string[] => {
  const contentType = detectContentTypeFromTemplateName(templateName);
  
  if (!contentType) {
    return DEFAULT_CHAT_RULES;
  }
  
  const formatRules = getContentFormatRules(contentType);
  
  // Divide as regras em partes menores e mais legíveis
  const globalRules = Object.values(GLOBAL_CONTENT_RULES);
  
  return [
    ...globalRules,
    `FORMATO: ${templateName.toUpperCase()}`,
    formatRules,
  ];
};

// Detecta tipo de conteúdo a partir do nome do template
export const detectContentTypeFromTemplateName = (name: string): ContentFormatType | null => {
  const normalizedName = name.trim();
  
  // Check exact match first
  if (TEMPLATE_NAME_TO_CONTENT_TYPE[normalizedName]) {
    return TEMPLATE_NAME_TO_CONTENT_TYPE[normalizedName] as ContentFormatType;
  }
  
  // Then try detection from text
  return detectContentType(normalizedName);
};

// Detecção de tipo de conteúdo a partir do texto
// IMPORTANTE: A ordem é crítica! Formatos mais específicos devem vir primeiro
// Referência: docs/assistente-kai/FLUXO-FORMATOS.md
export const detectContentType = (text: string): ContentFormatType | null => {
  const lowerText = text.toLowerCase();
  
  // MÉTODO 1: Detecção por @FORMATO (prioridade máxima conforme docs)
  // Ex: "@THREAD sobre produtividade" → thread
  if (lowerText.includes('@thread')) return 'thread';
  if (lowerText.includes('@newsletter')) return 'newsletter';
  if (lowerText.includes('@tweet')) return 'tweet';
  if (lowerText.includes('@carrossel') || lowerText.includes('@carousel')) return 'carousel';
  if (lowerText.includes('@stories') || lowerText.includes('@story')) return 'stories';
  if (lowerText.includes('@linkedin')) return 'linkedin_post';
  if (lowerText.includes('@blog')) return 'blog_post';
  if (lowerText.includes('@artigo')) return 'x_article';
  if (lowerText.includes('@reels') || lowerText.includes('@reel')) return 'short_video';
  
  // MÉTODO 2: Detecção por nome explícito
  // ORDEM CRÍTICA: Thread ANTES de stories para evitar false positives
  // ("thread" é mais específico que "story/storie")
  
  // Artigo no X (mais específico, antes de artigo genérico)
  if (lowerText.includes('artigo no x') || lowerText.includes('artigo x') || lowerText.includes('artigo twitter')) return 'x_article';
  
  // Thread (Twitter/X) - ANTES de stories
  if (/thread/i.test(lowerText)) return 'thread';
  
  // Newsletter
  if (/newsletter/i.test(lowerText)) return 'newsletter';
  
  // Carrossel
  if (/carrossel|carousel|carrosel/i.test(lowerText)) return 'carousel';
  
  // Stories (Instagram) - DEPOIS de thread para evitar confusão
  // Usar word boundary para evitar match em "história" 
  if (/\bstories?\b/i.test(lowerText) || /\bstorie\b/i.test(lowerText)) return 'stories';
  
  // Tweet (diferente de thread)
  if (/\btweet\b/i.test(lowerText)) return 'tweet';
  
  // Plataformas Twitter/X (quando não é thread nem artigo)
  if (/\btwitter\b/i.test(lowerText) || /\bpara o x\b/i.test(lowerText) || /\bno x\b/i.test(lowerText)) return 'tweet';
  
  // Reels/Shorts/Vídeo curto
  if (/reels?|tiktok|vídeo curto|video curto|shorts?/i.test(lowerText)) return 'short_video';
  
  // Vídeo longo
  if (/vídeo longo|video longo|youtube|roteiro de vídeo|roteiro de video/i.test(lowerText)) return 'long_video';
  
  // LinkedIn
  if (/linkedin/i.test(lowerText)) return 'linkedin_post';
  
  // Post estático
  if (/post estático|imagem estática|post único|estático/i.test(lowerText)) return 'static_image';
  
  // Post Instagram (genérico)
  if (/post instagram|legenda instagram|instagram post/i.test(lowerText)) return 'instagram_post';
  
  // Blog (menos específico, por último)
  if (/blog\s*post|post\s*(do|para)\s*blog/i.test(lowerText)) return 'blog_post';
  
  // Artigo genérico (pode ser blog ou x_article, default para blog)
  if (/\bartigo\b/i.test(lowerText)) return 'blog_post';
  
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
  
  // Padrões expandidos para detectar pedidos de ideias
  const quantityPatterns = [
    // "3 ideias", "5 ideias de newsletter"
    /(\d+)\s*(novas?)?\s*(ideias?|sugestões?)/i,
    // "De 3 novas ideias", "Dê 5 ideias", "Me dê 3 ideias"
    /(d[eê]|me\s+d[eêaá]|quero|preciso\s+de)\s*(\d+)\s*(novas?)?\s*(ideias?|sugestões?)/i,
    // "uma ideia", "duas ideias"
    /(uma|duas|três|quatro|cinco|seis|sete|oito|nove|dez)\s*(novas?)?\s*(ideias?|sugestões?)/i,
    // "De uma ideia", "Me dê três sugestões"
    /(d[eê]|me\s+d[eêaá]|quero|preciso\s+de)\s*(uma|duas|três|quatro|cinco|seis|sete|oito|nove|dez)\s*(novas?)?\s*(ideias?|sugestões?)/i,
  ];
  
  // Padrões simples para detectar se é pedido de ideias (sem quantidade específica)
  const ideaPatterns = [
    /novas?\s+ideias?/i,
    /ideias?\s+(de|para|sobre)/i,
    /me\s+d[eêaá]\s+ideias?/i,
    /sugira\s+ideias?/i,
    /quero\s+ideias?/i,
    /preciso\s+de\s+ideias?/i,
    /brainstorm/i,
  ];
  
  let quantity: number | null = null;
  const numberMap: Record<string, number> = {
    'uma': 1, 'duas': 2, 'três': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10
  };
  
  // Tentar extrair quantidade
  for (const pattern of quantityPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Encontrar o número no match
      for (const group of match.slice(1)) {
        if (!group) continue;
        const num = parseInt(group);
        if (!isNaN(num)) {
          quantity = num;
          break;
        }
        if (numberMap[group.toLowerCase()]) {
          quantity = numberMap[group.toLowerCase()];
          break;
        }
      }
      if (quantity) break;
    }
  }
  
  // Detectar tipo de conteúdo
  const contentType = detectContentType(text);
  
  // Verificar se é pedido de ideias
  const matchesIdeaPattern = ideaPatterns.some(p => p.test(text));
  const hasIdeaKeyword = isIdeaRequest(text);
  const isIdea = hasIdeaKeyword || matchesIdeaPattern || quantity !== null;
  
  // Debug log
  console.log(`[parseIdeaRequest] text: "${text.substring(0, 50)}..." -> isIdea: ${isIdea}, quantity: ${quantity}, contentType: ${contentType}`);
  
  return { isIdea, quantity, contentType };
};

// Regras específicas para modo de ideias
export const IDEA_MODE_RULES = `
## 🎯 MODO IDEIAS - REGRAS OBRIGATÓRIAS

**O usuário está pedindo IDEIAS, não conteúdo final.**

### PROCESSO OBRIGATÓRIO:
1. ANALISE a biblioteca de conteúdo e referências do cliente
2. IDENTIFIQUE os temas, assuntos e abordagens que funcionam para este cliente
3. CRIE ideias NOVAS e ORIGINAIS inspiradas nesses temas (nunca copie!)
4. As ideias devem ser RELEVANTES para o nicho/posicionamento do cliente

### Formato de Apresentação:
Para cada ideia, use EXATAMENTE este formato:

**Ideia [N]: [Título curto e atrativo - máx 8 palavras]**
[Descrição concisa em 1-2 frases explicando o conceito]

### Regras Críticas:
1. **BASEIE-SE NA BIBLIOTECA**: Use os temas e assuntos que o cliente já aborda
2. **SEJA CONCISO**: Cada ideia deve ter no máximo 2-3 linhas TOTAL
3. **SEJA ESPECÍFICO**: Títulos claros que explicam a ideia de forma direta
4. **NUNCA COPIE**: Crie VARIAÇÕES e NOVAS ABORDAGENS dos temas, não repita ideias existentes
5. **QUANTIDADE EXATA**: Entregue EXATAMENTE a quantidade pedida (ou 5 se não especificado)
6. **DIVERSIDADE**: Cada ideia deve ser claramente diferente das outras
7. **NÃO DESENVOLVA**: NÃO escreva o conteúdo completo, apenas a ideia resumida
8. **MANTENHA O NICHO**: As ideias devem ser sobre os temas que o cliente trabalha

### O que NÃO fazer:
- NÃO escreva o conteúdo completo de nenhuma ideia
- NÃO copie ou repita ideias que já existem na biblioteca do cliente
- NÃO inclua CTAs, estruturas completas, textos longos ou formatação final
- NÃO repita ideias similares com palavras diferentes
- NÃO inclua emojis no título das ideias
- NÃO numere dentro do título (o número vem antes)
- NÃO sugira temas FORA do nicho/posicionamento do cliente

### Exemplo de Resposta CORRETA:

**Ideia 1: O mito do trabalho duro**
Desmistificar que trabalhar mais horas = mais sucesso. Mostrar dados sobre produtividade real.

**Ideia 2: Antes e depois do método X**
Comparação visual entre a rotina antiga vs. nova abordagem otimizada com resultados.

**Ideia 3: 5 sinais de que você está no caminho certo**
Lista de indicadores positivos de progresso que passam despercebidos no dia a dia.

### Exemplo de Resposta INCORRETA (evite):
❌ Ideia muito longa com explicação detalhada que desenvolve todo o conteúdo...
❌ "Ideia 1: 🚀 Uma ideia incrível que vai mudar sua vida!" (emojis e título vago)
❌ Repetir uma ideia que já está na biblioteca do cliente
❌ Sugerir temas que o cliente não trabalha (ex: receitas para um cliente de finanças)
`;

// Regras específicas para modo de criação de conteúdo
export const CONTENT_CREATION_RULES = `
## ✍️ MODO CRIAÇÃO DE CONTEÚDO - REGRAS OBRIGATÓRIAS

**O usuário quer CONTEÚDO FINAL, não ideias.**

### PROCESSO OBRIGATÓRIO:
1. ANALISE a biblioteca de referências para entender o ESTILO e TOM do cliente
2. SIGA a estrutura e formato das regras específicas do tipo de conteúdo
3. ESCREVA no mesmo TOM e ESTILO dos conteúdos de referência
4. APLIQUE os padrões de escrita identificados na biblioteca

### Regras Críticas:
1. **SIGA O ESTILO**: Escreva igual está nos exemplos da biblioteca de referência
2. **USE O TOM CERTO**: Mantenha a personalidade e voz do cliente
3. **APLIQUE AS REGRAS**: Siga as regras de formato específicas (carrossel, stories, etc.)
4. **ENTREGUE COMPLETO**: O conteúdo deve estar pronto para publicar
5. **MANTENHA CONSISTÊNCIA**: O novo conteúdo deve parecer feito pelo mesmo autor

### O que FAZER:
- Copie o ESTILO, não o conteúdo
- Use o mesmo vocabulário e expressões do cliente
- Siga a mesma estrutura de organização
- Mantenha o mesmo nível de formalidade/informalidade
- Aplique os mesmos padrões de formatação
`;
