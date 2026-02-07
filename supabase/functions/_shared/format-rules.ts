// =====================================================
// ⚠️ ATENÇÃO: ARQUIVO DE FALLBACK
// =====================================================
// A documentação PRIMÁRIA de formatos está em:
//   Tabela: kai_documentation (doc_type = 'format')
//
// Este arquivo é usado APENAS como FALLBACK quando:
//   1. O banco de dados não está disponível
//   2. Um formato específico não existe no banco
//
// Para ATUALIZAR regras de formato, edite diretamente no banco via:
//   - Interface de administração de kai_documentation
//   - SQL: UPDATE kai_documentation SET content = '...' WHERE doc_key = 'formato'
//
// As funções getFormatDocs() e getFullContentContext() em knowledge-loader.ts
// buscam do banco primeiro e usam este arquivo como fallback.
// =====================================================

// Universal format rules for content generation
// Shared across all edge functions: kai-content-agent, generate-content-v2, etc.
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
[Texto do tweet - máx 280 chars, sem hashtags, sem emojis decorativos]
\`\`\`

### REGRA DE EMOJI (CRÍTICO)
- **PADRÃO**: ZERO emojis no corpo do tweet
- **EXCEÇÃO**: máximo 1 emoji no CTA final, SE absolutamente relevante
- **NA DÚVIDA**: NÃO use emoji
- **PROIBIDO**: Emojis decorativos (💡🔥✨🚀💰📈💼🎯 etc.) em qualquer parte

### PROIBIÇÕES ABSOLUTAS
- ❌ HASHTAGS (NUNCA use hashtags, são consideradas spam em 2024+)
- ❌ Exceder 280 caracteres (CRÍTICO)
- ❌ Emojis decorativos no corpo do texto (💡🔥✨🚀💰📈💼🎯)
- ❌ Linguagem corporativa ou genérica
- ❌ Começar com "Você sabia que..." ou similares
- ❌ Tweets vazios sem valor real (apenas afirmações genéricas)
- ❌ Mencionar o nome do cliente como hashtag (#gabrielmadureira, etc)
- ❌ Frases como "Aqui está", "Segue", "Criei para você"

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
- ❌ HASHTAGS (nunca use)

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
- ❌ Começar com "Aqui está a newsletter", "Segue", "Criei para você"

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
- ❌ HASHTAGS (nunca use)

### TÉCNICAS QUE FUNCIONAM
- ✅ Contraste de ideias
- ✅ Números específicos
- ✅ Perguntas diretas
- ✅ Chamadas provocativas
`,

  reels: `
## REGRAS OBRIGATÓRIAS PARA ROTEIRO DE REELS/VÍDEO CURTO

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
- ❌ HASHTAGS na descrição

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

### REGRA DE EMOJI (CRÍTICO)
- **PADRÃO**: ZERO emojis no corpo dos tweets
- **EXCEÇÃO**: máximo 1 emoji no tweet final (CTA), SE relevante
- **NA DÚVIDA**: NÃO use emoji
- **PROIBIDO**: Emojis decorativos (💡🔥✨🚀💰📈💼🎯 etc.)

### PROIBIÇÕES ABSOLUTAS
- ❌ Tweets que excedem 280 caracteres
- ❌ Múltiplas ideias no mesmo tweet
- ❌ Ganchos vagos
- ❌ Emojis decorativos no corpo (💡🔥✨🚀💰📈💼🎯)
- ❌ HASHTAGS (nunca use)

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
- ❌ Hashtags em excesso (máx 3-5 no final, se necessário)
- ❌ Texto corporativo e formal demais

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

  blog_post: `
## REGRAS OBRIGATÓRIAS PARA BLOG POST

### ESTRUTURA
- **Título**: SEO-friendly, máximo 60 caracteres
- **Meta Description**: 150-160 caracteres
- **Introdução**: 2-3 parágrafos que fisguem o leitor
- **Corpo**: H2s e H3s para escaneabilidade
- **Conclusão**: CTA claro

### FORMATO DE ENTREGA
\`\`\`
**TÍTULO:** [Título SEO - máx 60 chars]
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
[Resumo + CTA]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Parágrafos maiores que 4 linhas
- ❌ Introdução sem gancho
- ❌ Texto sem subtítulos (H2/H3)
- ❌ Terminar sem CTA
- ❌ Linguagem genérica de IA

### TÉCNICAS QUE FUNCIONAM
- ✅ Listas e bullet points
- ✅ Dados e estatísticas específicas
- ✅ Exemplos práticos
- ✅ Perguntas retóricas para engajar
`,

  email_marketing: `
## REGRAS OBRIGATÓRIAS PARA EMAIL MARKETING

### ESTRUTURA
- **Assunto**: Máximo 50 caracteres, urgência ou curiosidade
- **Preview**: 90 caracteres, complementa assunto
- **Corpo**: Foco em UMA oferta/ação
- **CTA**: Botão claro e único

### FORMATO DE ENTREGA
\`\`\`
**ASSUNTO:** [Máx 50 chars - urgência/curiosidade]
**PREVIEW:** [90 chars - complementa]

---

[Saudação curta]

[Parágrafo 1 - Problema/Dor]

[Parágrafo 2 - Solução/Oferta]

[BOTÃO CTA: Texto do botão]

[Urgência/Escassez se aplicável]

[Assinatura]

P.S. [Reforço da oferta]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Múltiplos CTAs competindo
- ❌ Email longo demais (>300 palavras)
- ❌ Assunto spam (GRÁTIS, $$$, etc)
- ❌ Sem personalização

### TÉCNICAS QUE FUNCIONAM
- ✅ P.S. com urgência
- ✅ Escassez real (prazo, vagas)
- ✅ Prova social
- ✅ Benefícios > Características
`,

  long_video: `
## REGRAS OBRIGATÓRIAS PARA ROTEIRO DE VÍDEO LONGO (YOUTUBE)

### ESTRUTURA
- **0-30s**: GANCHO irresistível + promessa do vídeo
- **30s-2min**: Contexto e por que importa
- **2min+**: Desenvolvimento em seções claras
- **Final**: Resumo + CTA (inscreva-se, próximo vídeo)

### FORMATO DE ENTREGA
\`\`\`
**TÍTULO:** [Título YouTube - máx 60 chars]
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

[...]

**CONCLUSÃO:**
[Resumo + CTA para inscrição]

**DESCRIÇÃO:**
[Descrição otimizada para SEO]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Começar com "Olá pessoal, tudo bem?"
- ❌ Gancho fraco ou longo
- ❌ Seções sem propósito claro
- ❌ Terminar sem CTA

### TÉCNICAS QUE FUNCIONAM
- ✅ Pattern interrupt no início
- ✅ Promessa clara do que será entregue
- ✅ Timestamps para navegação
- ✅ Loops abertos entre seções
`,

  short_video: `
## REGRAS OBRIGATÓRIAS PARA VÍDEO CURTO (TIKTOK/SHORTS)

### ESTRUTURA
- **0-1s**: GANCHO visual/textual imediato
- **1-15s**: Conteúdo principal, ritmo rápido
- **15-60s**: Desenvolvimento (se necessário)
- **Final**: CTA rápido

### FORMATO DE ENTREGA
\`\`\`
**GANCHO (0-1s):**
[Texto na tela / Primeira fala]

**DESENVOLVIMENTO:**
[Roteiro ultra-conciso]

Cena 1:
[Ação/Texto]

Cena 2:
[Ação/Texto]

[...]

**CTA:**
[Ação final - siga/comente]

**LEGENDA:**
[Legenda curta sem hashtags]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Gancho maior que 1 segundo
- ❌ Ritmo lento
- ❌ Introduções desnecessárias
- ❌ HASHTAGS (nunca use)

### TÉCNICAS QUE FUNCIONAM
- ✅ Texto grande na tela
- ✅ Cortes rápidos
- ✅ Trending sounds quando relevante
- ✅ Loop - final conecta com início
`,

  static_image: `
## REGRAS OBRIGATÓRIAS PARA IMAGEM ESTÁTICA (FEED)

### ESTRUTURA
- **Texto Principal**: 3-8 palavras impactantes
- **Texto Secundário** (opcional): Complemento curto
- **Legenda**: Gancho + desenvolvimento + CTA

### FORMATO DE ENTREGA
\`\`\`
**TEXTO PRINCIPAL:**
[3-8 palavras de impacto]

**TEXTO SECUNDÁRIO:**
[Complemento opcional]

---

**LEGENDA:**
[Gancho - primeira linha que para scroll]

[Desenvolvimento - 2-3 parágrafos curtos]

[CTA claro]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Mais de 10 palavras no visual
- ❌ Texto genérico/corporativo
- ❌ Legenda sem gancho
- ❌ HASHTAGS

### TÉCNICAS QUE FUNCIONAM
- ✅ Contraste visual de ideias
- ✅ Números específicos
- ✅ Perguntas provocativas
- ✅ Afirmações polêmicas
`,

  x_article: `
## REGRAS OBRIGATÓRIAS PARA ARTIGO NO X (TWITTER ARTICLE)

### ESTRUTURA
- **Título**: Claro e direto, máximo 100 caracteres
- **Subtítulo**: Complementa o título
- **Corpo**: Parágrafos curtos, imagens entre seções
- **Conclusão**: Takeaways + CTA

### FORMATO DE ENTREGA
\`\`\`
**TÍTULO:** [Máx 100 chars]
**SUBTÍTULO:** [Complemento]

---

[Introdução - 2-3 parágrafos curtos]

## [Seção 1]
[Conteúdo...]

## [Seção 2]
[Conteúdo...]

[...]

## Conclusão
[Resumo + CTA]

---

**TWEET DE DIVULGAÇÃO:**
[Tweet para promover o artigo - máx 280 chars, sem hashtags]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Parágrafos longos
- ❌ Sem subtítulos/seções
- ❌ Linguagem acadêmica demais
- ❌ HASHTAGS

### TÉCNICAS QUE FUNCIONAM
- ✅ Storytelling pessoal
- ✅ Dados e exemplos concretos
- ✅ Imagens/screenshots entre seções
- ✅ Tweet de divulgação impactante
`,

  case_study: `
## REGRAS OBRIGATÓRIAS PARA ESTUDO DE CASO

### ESTRUTURA
- **Título**: Resultado específico alcançado
- **Contexto**: Quem é o cliente/empresa
- **Desafio**: Problema específico
- **Solução**: O que foi feito
- **Resultados**: Números e métricas

### FORMATO DE ENTREGA
\`\`\`
**TÍTULO:** [Resultado específico - ex: "Como X aumentou vendas em 300%"]

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
[Próximo passo para o leitor]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Resultados vagos ("melhorou muito")
- ❌ Sem números específicos
- ❌ Linguagem genérica de marketing

### TÉCNICAS QUE FUNCIONAM
- ✅ Números específicos e verificáveis
- ✅ Antes x Depois
- ✅ Linha do tempo clara
- ✅ Depoimento real do cliente
`,

  report: `
## REGRAS OBRIGATÓRIAS PARA RELATÓRIO DE PERFORMANCE

### ESTRUTURA
- **Resumo Executivo**: Principais insights em 3-5 bullets
- **Métricas-Chave**: KPIs com comparativo
- **Análise**: O que funcionou e o que não
- **Recomendações**: Próximos passos

### FORMATO DE ENTREGA
\`\`\`
# Relatório de Performance - [Período]

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
3. [Ação prioritária 3]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Dados sem contexto comparativo
- ❌ Métricas de vaidade sem insights
- ❌ Sem recomendações acionáveis

### TÉCNICAS QUE FUNCIONAM
- ✅ Comparativos período a período
- ✅ Insights acionáveis
- ✅ Priorização clara de ações
- ✅ Visualização de dados quando possível
`,

  instagram_post: `
## REGRAS OBRIGATÓRIAS PARA POST INSTAGRAM

### ESTRUTURA
- **Visual**: Texto impactante de 5-10 palavras
- **Legenda**: Gancho + valor + CTA
- **Sem hashtags** - são datadas

### FORMATO DE ENTREGA
\`\`\`
**TEXTO DO VISUAL:**
[5-10 palavras impactantes]

---

**LEGENDA:**
[Gancho - primeira linha que para o scroll]

[Desenvolvimento com valor real em parágrafos curtos]

[CTA claro no final]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Mais de 10 palavras no visual
- ❌ Legenda genérica
- ❌ HASHTAGS (nunca use)
- ❌ Emojis excessivos

### TÉCNICAS QUE FUNCIONAM
- ✅ Primeira linha polêmica ou provocativa
- ✅ Storytelling pessoal
- ✅ Números específicos
- ✅ Perguntas que geram comentários
`,

  linkedin_post: `
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
- ❌ Texto corporativo e formal demais

### TÉCNICAS QUE FUNCIONAM
- ✅ Storytelling pessoal/profissional
- ✅ Contraste: erro passado vs aprendizado
- ✅ Listas numeradas ou com bullets
- ✅ Perguntas que geram debate
`,

  youtube_script: `
## REGRAS OBRIGATÓRIAS PARA ROTEIRO YOUTUBE

### ESTRUTURA
- **0-30s**: GANCHO irresistível + promessa do vídeo
- **30s-2min**: Contexto e por que importa
- **2min+**: Desenvolvimento em seções claras
- **Final**: Resumo + CTA (inscreva-se, próximo vídeo)

### FORMATO DE ENTREGA
\`\`\`
**TÍTULO:** [Título YouTube - máx 60 chars]
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

[...]

**CONCLUSÃO:**
[Resumo + CTA para inscrição]
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Começar com "Olá pessoal, tudo bem?"
- ❌ Gancho fraco ou longo
- ❌ Seções sem propósito claro
- ❌ Terminar sem CTA

### TÉCNICAS QUE FUNCIONAM
- ✅ Pattern interrupt no início
- ✅ Promessa clara do que será entregue
- ✅ Timestamps para navegação
- ✅ Loops abertos entre seções
`,
};

// Universal rules that apply to ALL formats
export const UNIVERSAL_RULES = `
## ⚠️ REGRA CRÍTICA #1: ENTREGUE APENAS O CONTEÚDO FINAL

**PROIBIÇÕES ABSOLUTAS DE META-TEXTO:**
- ❌ NUNCA escreva "Aqui está...", "Segue...", "Criei para você...", "Pronto!"
- ❌ NUNCA escreva "Essa é a newsletter que você pediu"
- ❌ NUNCA escreva "Aqui está o tweet sobre..."
- ❌ NUNCA escreva "Segue o carrossel..."
- ❌ NUNCA explique o que você fez ou por que fez
- ❌ NUNCA inclua notas, observações ou comentários
- ❌ NUNCA use frases introdutórias de qualquer tipo

**O QUE FAZER:**
- ✅ Entregue DIRETAMENTE o conteúdo pronto para publicar
- ✅ Comece imediatamente com o conteúdo (título, assunto, texto)
- ✅ Se precisar de múltiplas versões, numere-as (Versão 1, Versão 2)

## ⚠️ REGRA CRÍTICA #2: ZERO HASHTAGS

- ❌ NUNCA use hashtags em NENHUM formato
- ❌ Hashtags são consideradas spam e datadas em 2024+
- ❌ Não use hashtags com nome do cliente (#gabrielmadureira)
- ❌ Não use hashtags temáticas (#marketing #sucesso)

## DIRETRIZES UNIVERSAIS DE CRIAÇÃO

### 1. CLAREZA ACIMA DE TUDO
- 1 ideia por seção/slide/parágrafo
- Texto conciso respeitando limites de palavras do formato
- Progressão lógica: cada parte leva naturalmente à próxima
- Linguagem simples e direta

### 2. EMOJIS: QUASE ZERO
- Emojis APENAS no CTA final quando apropriado
- NUNCA no corpo principal do conteúdo
- Máximo 2-3 emojis POR PEÇA INTEIRA
- Exceção: Stories podem usar mais por natureza visual

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

// Self-validation checklist - FOR INTERNAL USE ONLY
export const VALIDATION_CHECKLIST = `
## ⚠️ VALIDAÇÃO INTERNA (NÃO INCLUA NA RESPOSTA)
Antes de entregar, valide INTERNAMENTE:
- Comecei DIRETAMENTE com o conteúdo (sem "Aqui está...", "Segue...")?
- NÃO usei nenhuma hashtag?
- Respeitei o limite de palavras por seção?
- Usei emojis APENAS onde permitido (máx 2-3 no CTA)?
- Cada slide/seção tem apenas 1 ideia?
- O gancho inicial cria curiosidade (NÃO educa)?
- O CTA é claro e específico?
- O formato de entrega está exatamente como especificado?
- O tom de voz está fiel ao cliente?
- Evitei frases genéricas proibidas?
- Cada frase agrega valor real (não é preenchimento)?

⚠️ CRÍTICO: Esta validação é APENAS para você internamente. 
NÃO inclua este checklist na sua resposta.
NÃO inclua "Observações:", "Notas:" ou explicações sobre o que você fez.
ENTREGUE APENAS o conteúdo final, pronto para publicação.
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
    
    // Email Marketing (different from newsletter)
    'emailmarketing': 'email_marketing',
    
    // Blog Post
    'blogpost': 'blog_post',
    'blog': 'blog_post',
    
    // Static Post/Image
    'post': 'post',
    'staticpost': 'post',
    'instagram': 'instagram_post',
    'instagrampost': 'instagram_post',
    'staticimage': 'static_image',
    
    // Video/Reels
    'reels': 'reels',
    'reel': 'reels',
    'video': 'reels',
    'shortvideo': 'short_video',
    'shorts': 'short_video',
    'tiktok': 'short_video',
    'longvideo': 'long_video',
    'youtube': 'long_video',
    'youtubescript': 'youtube_script',
    
    // Thread
    'thread': 'thread',
    'twitterthread': 'thread',
    
    // Tweet (individual)
    'tweet': 'tweet',
    
    // LinkedIn
    'linkedin': 'linkedin',
    'linkedinpost': 'linkedin_post',
    
    // X Article
    'xarticle': 'x_article',
    'article': 'x_article',
    
    // Stories
    'stories': 'stories',
    'story': 'stories',
    'instagramstory': 'stories',
    
    // Case Study
    'casestudy': 'case_study',
    'case': 'case_study',
    
    // Report
    'report': 'report',
    'relatorio': 'report',
  };

  const mappedFormat = formatMap[normalizedFormat] || 'post';
  const specificRules = FORMAT_RULES[mappedFormat] || FORMAT_RULES.post;

  return `${specificRules}\n\n${UNIVERSAL_RULES}\n\n${VALIDATION_CHECKLIST}`;
}
