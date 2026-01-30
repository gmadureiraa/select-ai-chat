// Universal format rules for content generation
// These rules are injected into the agent's system prompt based on the content format

export const FORMAT_RULES: Record<string, string> = {
  tweet: `
## REGRAS OBRIGATÓRIAS PARA TWEET

### ESTRUTURA
- **Máximo 280 caracteres** (incluindo espaços)
- Uma mensagem clara, impactante e direta
- **SEM HASHTAGS** - hashtags são datadas e prejudicam alcance

### FORMATO DE ENTREGA
\`\`\`
[Texto do tweet - máx 280 chars, sem hashtags]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ HASHTAGS (NUNCA use hashtags, são consideradas spam em 2024+)
- ❌ Exceder 280 caracteres (CRÍTICO)
- ❌ Linguagem corporativa ou genérica
- ❌ Começar com "Você sabia que..." ou similares
- ❌ Tweets vazios sem valor real (apenas afirmações genéricas)
- ❌ Mencionar o nome do cliente como hashtag (#gabrielmadureira, etc)

### TÉCNICAS QUE FUNCIONAM
- ✅ Gancho forte na primeira frase
- ✅ Números específicos ("3 erros" em vez de "alguns erros")
- ✅ Opinião ou take polêmico que gera discussão
- ✅ Perguntas diretas que provocam reflexão
- ✅ Insight único baseado em experiência real
- ✅ Estrutura com quebras de linha para ritmo
`,

  carousel: `
## REGRAS OBRIGATÓRIAS PARA CARROSSEL

### ESTRUTURA
- **Slide 1 (CAPA)**: Máximo 8 palavras. Crie dor, urgência ou curiosidade. NÃO eduque.
- **Slides 2-8**: Máximo 30 palavras por slide. UMA ideia por slide.
- **Último Slide**: CTA claro (Salve, Compartilhe, Siga)

### FORMATO DE ENTREGA
\`\`\`
Página 1:
[Headline impactante - máx 8 palavras]
[Subtítulo se necessário - máx 10 palavras]

---

Página 2:
[Título do ponto]
[Texto explicativo - máx 30 palavras]

---

[... repetir para cada página ...]

---

Página Final:
SALVE ESTE POST
Para consultar depois

COMPARTILHE
Com quem precisa ver isso

---

LEGENDA:
[Texto da legenda com gancho forte na primeira linha]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Emojis nos slides de conteúdo (apenas no CTA final, máx 2)
- ❌ Frases genéricas: "Entenda", "Aprenda", "Vamos falar sobre", "Descubra"
- ❌ Entregar o conteúdo na capa (apenas ganchos)
- ❌ Ultrapassar 30 palavras por slide
- ❌ Mais de 1 ideia por slide

### TÉCNICAS QUE FUNCIONAM
- ✅ Números específicos: "4,5% ao ano" em vez de "vários por cento"
- ✅ Contraste: Antes vs Depois
- ✅ Dor + Solução
- ✅ Perguntas provocativas na capa
- ✅ Listas numeradas (1., 2., 3.)
- ✅ Progressão lógica entre slides
`,

  newsletter: `
## REGRAS OBRIGATÓRIAS PARA NEWSLETTER

### ESTRUTURA
- **ASSUNTO**: Máximo 50 caracteres, gere curiosidade
- **PREVIEW TEXT**: Complementa o assunto, máximo 90 caracteres
- **SAUDAÇÃO**: Personalizada quando possível
- **CORPO**: Parágrafos curtos (2-3 linhas), escaneável
- **CTA**: Claro e específico no final

### FORMATO DE ENTREGA
\`\`\`
**ASSUNTO:** [Texto do assunto - máx 50 chars]
**PREVIEW:** [Preview text - máx 90 chars]

---

[Saudação personalizada]

[Parágrafo 1 - Gancho que prende atenção]

[Parágrafo 2-4 - Desenvolvimento com valor]

[CTA Final claro]

[Assinatura]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Assuntos genéricos ou clickbait vazio
- ❌ Parágrafos longos (>4 linhas)
- ❌ Terminar sem CTA
- ❌ Emojis excessivos (máx 2-3 na newsletter inteira)
- ❌ Linguagem corporativa fria

### TÉCNICAS QUE FUNCIONAM
- ✅ Assunto com número ou pergunta
- ✅ Preview que complementa (não repete) o assunto
- ✅ Storytelling no primeiro parágrafo
- ✅ Bullet points para listas
- ✅ CTA com verbo de ação
`,

  post: `
## REGRAS OBRIGATÓRIAS PARA POST ESTÁTICO

### ESTRUTURA
- **Texto visual**: 5-10 palavras (máximo 15)
- **Texto secundário** (opcional): 5-10 palavras
- **Legenda**: Gancho forte na primeira linha

### FORMATO DE ENTREGA
\`\`\`
**TEXTO PRINCIPAL:**
[Frase impactante - máx 10 palavras]

**TEXTO SECUNDÁRIO (opcional):**
[Complemento - máx 10 palavras]

---

**LEGENDA:**
[Primeira linha = gancho que para o scroll]

[Desenvolvimento em parágrafos curtos]

[CTA no final]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Ultrapassar 15 palavras no visual
- ❌ Texto genérico sem impacto
- ❌ Legenda sem gancho inicial
- ❌ Emojis no texto visual

### TÉCNICAS QUE FUNCIONAM
- ✅ Contraste de ideias
- ✅ Números específicos
- ✅ Perguntas diretas
- ✅ Chamadas provocativas
`,

  reels: `
## REGRAS OBRIGATÓRIAS PARA ROTEIRO DE REELS/VÍDEO

### ESTRUTURA
- **0-3 segundos**: GANCHO que para o scroll (frase impactante)
- **3-60 segundos**: Desenvolvimento com ritmo rápido
- **Final**: CTA claro (siga, salve, comente)

### FORMATO DE ENTREGA
\`\`\`
**GANCHO (0-3s):**
[Frase que para o scroll - visual ou falada]

**DESENVOLVIMENTO:**
[Roteiro com marcações de tempo/cenas]

Cena 1 (3-15s):
[Ação/fala]

Cena 2 (15-30s):
[Ação/fala]

[...]

**CTA FINAL:**
[Ação específica + texto na tela]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Começar devagar ou com apresentação
- ❌ Ser prolixo ou repetitivo
- ❌ Terminar sem CTA
- ❌ Ganchos genéricos: "Você sabia que..."

### TÉCNICAS QUE FUNCIONAM
- ✅ Gancho com polêmica leve ou dado surpreendente
- ✅ Ritmo rápido com cortes
- ✅ Texto na tela reforçando pontos-chave
- ✅ CTA visual + falado
`,

  thread: `
## REGRAS OBRIGATÓRIAS PARA THREAD

### ESTRUTURA
- **Tweet 1**: Gancho irresistível que promete valor
- **Tweets 2-9**: Uma ideia por tweet, máximo 280 caracteres
- **Tweet final**: CTA + resumo do valor entregue

### FORMATO DE ENTREGA
\`\`\`
Tweet 1/10:
[Gancho prometendo o que a pessoa vai aprender/ganhar]

Tweet 2/10:
[Primeiro ponto - uma ideia]

[...]

Tweet 10/10:
[CTA: Curta, salve, siga para mais]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Tweets que excedem 280 caracteres
- ❌ Múltiplas ideias no mesmo tweet
- ❌ Ganchos vagos
- ❌ Mais de 2 emojis por tweet

### TÉCNICAS QUE FUNCIONAM
- ✅ Numerar os tweets (1/10, 2/10...)
- ✅ Conectores entre tweets ("Mas tem mais...")
- ✅ Listas dentro dos tweets
`,

  linkedin: `
## REGRAS OBRIGATÓRIAS PARA POST LINKEDIN

### ESTRUTURA
- **Gancho**: Primeira linha impactante (aparece antes do "ver mais")
- **Corpo**: Parágrafos curtos, espaçados
- **CTA**: Pergunta ou ação clara no final

### FORMATO DE ENTREGA
\`\`\`
[Gancho de 1 linha que aparece antes do "ver mais"]

[Espaço]

[Parágrafo 1 - Contexto ou história]

[Espaço]

[Parágrafos 2-4 - Desenvolvimento com insights]

[Espaço]

[CTA: Pergunta que gera comentários ou ação]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Começar com "Olá rede" ou saudações genéricas
- ❌ Parágrafos longos sem quebras
- ❌ Emojis excessivos (máx 3-4 no post inteiro)
- ❌ Hashtags em excesso (máx 3-5 no final)

### TÉCNICAS QUE FUNCIONAM
- ✅ Storytelling pessoal/profissional
- ✅ Contraste: erro passado vs aprendizado
- ✅ Listas numeradas ou com bullets
- ✅ Perguntas que geram debate
`,

  stories: `
## REGRAS OBRIGATÓRIAS PARA STORIES

### ESTRUTURA
- **Story 1**: Gancho visual + texto curto
- **Stories 2-4**: Desenvolvimento (1 ideia por story)
- **Story final**: CTA (enquete, caixa de perguntas, link)

### FORMATO DE ENTREGA
\`\`\`
Story 1:
[Visual/Ação]
Texto: [Máx 20 palavras]

Story 2:
[Visual/Ação]
Texto: [Máx 20 palavras]

[...]

Story Final:
[CTA com sticker interativo]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Mais de 20 palavras por story
- ❌ Stories sem interatividade no final
- ❌ Texto pequeno demais para ler rápido

### TÉCNICAS QUE FUNCIONAM
- ✅ Texto grande e legível
- ✅ Contraste fundo x texto
- ✅ Stickers de engajamento (enquete, pergunta, slider)
`,
};

// Universal rules that apply to ALL formats
export const UNIVERSAL_RULES = `
## DIRETRIZES UNIVERSAIS DE CRIAÇÃO

### ⚠️ REGRA CRÍTICA: ENTREGUE APENAS O CONTEÚDO FINAL
- NUNCA inclua meta-texto como "Aqui está a newsletter que você pediu", "Segue o tweet", "Criei para você", etc.
- NUNCA explique o que você fez ou por que fez
- NUNCA inclua notas, observações ou comentários
- Entregue DIRETAMENTE o conteúdo pronto para publicar, nada mais
- Se precisar de múltiplas versões, numere-as (Versão 1, Versão 2) sem explicações

### 1. CLAREZA ACIMA DE TUDO
- 1 ideia por seção/slide/parágrafo
- Texto conciso respeitando limites de palavras do formato
- Progressão lógica: cada parte leva naturalmente à próxima
- Linguagem simples e direta

### 2. EMOJIS E HASHTAGS: QUASE ZERO
- Emojis APENAS no CTA final quando apropriado
- NUNCA no corpo principal do conteúdo
- Máximo 2-3 emojis POR PEÇA INTEIRA
- Exceção: Stories podem usar mais por natureza visual
- **HASHTAGS: NÃO USE** - são datadas e consideradas spam em 2024+

### 3. LINGUAGEM DIRETA
- PROIBIDO: "Entenda", "Aprenda", "Descubra como", "Vamos falar sobre", "Você sabia que"
- USAR: "Você está perdendo", "O segredo é", "Faça isso agora", "Pare de..."
- Números específicos > adjetivos vagos ("3,5%" > "muito")
- Verbos de ação > verbos de estado

### 4. ESTRUTURA PROFISSIONAL
- Sempre siga o formato de entrega especificado acima
- Divida claramente seções/slides com separadores (---)
- Termine SEMPRE com CTA específico
- Entregue conteúdo PRONTO PARA USO, não sugestões

### 5. AUTENTICIDADE E VALOR
- Evite parecer "ChatGPT-like" ou genérico
- Mantenha 100% o tom de voz do cliente
- Use os exemplos fornecidos como referência de estilo
- Replique estruturas que funcionam para o cliente
- CADA FRASE deve agregar valor real - elimine preenchimento

### 6. GANCHOS QUE FUNCIONAM
- Dor/problema específico
- Número surpreendente
- Contrariar senso comum
- Promessa de valor claro
- Pergunta provocativa
`;

// Self-validation checklist
export const VALIDATION_CHECKLIST = `
## ANTES DE ENTREGAR, VALIDE:
- [ ] Respeitei o limite de palavras por seção?
- [ ] Usei emojis APENAS onde permitido (CTA)?
- [ ] Cada slide/seção tem apenas 1 ideia?
- [ ] O gancho inicial cria curiosidade (NÃO educa)?
- [ ] O CTA é claro e específico?
- [ ] O formato de entrega está exatamente como especificado?
- [ ] O tom de voz está fiel ao cliente?
- [ ] Evitei frases genéricas proibidas?

Se algum item falhar, REESCREVA antes de entregar.
`;

// Helper function to get format-specific rules
export function getFormatRules(format: string): string {
  const normalizedFormat = format?.toLowerCase().replace(/[_-]/g, '') || 'post';
  
  // Map common format names to our defined formats
  const formatMap: Record<string, string> = {
    // Carousel
    'carousel': 'carousel',
    'carrossel': 'carousel',
    'carouselinstagram': 'carousel',
    
    // Newsletter/Email
    'newsletter': 'newsletter',
    'email': 'newsletter',
    'blogpost': 'newsletter',
    'blog': 'newsletter',
    
    // Static Post
    'post': 'post',
    'staticpost': 'post',
    'instagram': 'post',
    'instagrampost': 'post',
    'staticimage': 'post',
    
    // Video/Reels
    'reels': 'reels',
    'reel': 'reels',
    'video': 'reels',
    'shortvideo': 'reels',
    'longvideo': 'reels',
    
    // Thread
    'thread': 'thread',
    'twitterthread': 'thread',
    
    // Tweet (individual)
    'tweet': 'tweet',
    
    // LinkedIn
    'linkedin': 'linkedin',
    'linkedinpost': 'linkedin',
    'xarticle': 'linkedin',
    
    // Stories
    'stories': 'stories',
    'story': 'stories',
    'instagramstory': 'stories',
  };

  const mappedFormat = formatMap[normalizedFormat] || 'post';
  const specificRules = FORMAT_RULES[mappedFormat] || FORMAT_RULES.post;

  return `${specificRules}\n\n${UNIVERSAL_RULES}\n\n${VALIDATION_CHECKLIST}`;
}
