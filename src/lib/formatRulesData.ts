// =====================================================
// ⚠️ FONTE ÚNICA DE VERDADE — REGRAS DE FORMATO
// =====================================================
// Este arquivo define TODAS as regras de criação de conteúdo.
// É usado por:
//   1. src/pages/Documentation.tsx — para exibir na UI
//   2. supabase/functions/_shared/format-rules.ts — para a IA usar
//
// ⚠️ Ao alterar regras aqui, ATUALIZE TAMBÉM o arquivo espelho:
//   supabase/functions/_shared/format-rules.ts
// =====================================================

export interface FormatRuleData {
  id: string;
  name: string;
  emoji: string;
  summary: string;
  structure: { title: string; description: string }[];
  goldenRules: string[];
  deliveryFormat: string;
  commonMistakes: string[];
  examples: string[];
}

export const formatRulesData: FormatRuleData[] = [
  {
    id: "carousel",
    name: "Carrossel Instagram/LinkedIn",
    emoji: "🎠",
    summary: "7-10 slides com gancho visual, texto curto por página e CTA final.",
    structure: [
      { title: "Página 1 — Capa", description: "Headline impactante (máx 8 palavras). Promessa clara de valor. Crie DOR, URGÊNCIA ou CURIOSIDADE — NÃO eduque na capa." },
      { title: "Páginas 2-8 — Conteúdo", description: "Um ponto por página (máx 30 palavras). Título do ponto + texto principal. Gancho para o próximo slide. Progressão narrativa." },
      { title: "Página 9 — Resumo/Conclusão", description: "Lista dos pontos principais ou mensagem final forte. Reforce o valor entregue." },
      { title: "Página 10 — CTA + Engagement", description: "\"Salve este post 📌\", \"Compartilhe 📤\". Visual de fechamento." },
      { title: "Legenda", description: "Primeira linha = gancho irresistível. Resumo do carrossel. Pergunta para gerar comentários. ZERO hashtags." },
    ],
    goldenRules: [
      "Headline da capa: máximo 8 palavras",
      "Cada página: máximo 30 palavras",
      "Fonte legível e grande (mín. 24px)",
      "Contraste alto (texto vs fundo)",
      "Gancho entre páginas (curiosidade para o próximo)",
      "Visual consistente (cores, tipografia, layout)",
      "Um ponto por página — não sobrecarregue",
      "ZERO hashtags — são datadas e spam",
      "Emojis apenas no CTA final (máx 2)",
    ],
    deliveryFormat: `Página 1:
[Headline impactante - máx 8 palavras]
[Subtítulo se necessário - máx 10 palavras]

---

Página 2:
[Título do ponto]
[Texto explicativo - máx 30 palavras]

---

Página 3:
[Título do ponto]
[Texto explicativo - máx 30 palavras]

---

[... repetir até Página 9 ou 10 ...]

---

Página [Penúltima]:
RECAPITULANDO:
1. [Ponto 1]
2. [Ponto 2]
3. [Ponto 3]

---

Página [Última]:
SALVE ESTE POST 📌
Para consultar depois

COMPARTILHE 📤
Com quem precisa ver isso

---

LEGENDA:
[Primeira linha = gancho que para o scroll]

[2-3 parágrafos curtos com valor adicional]

[Pergunta para gerar comentários]

[CTA: Salve, compartilhe, siga]`,
    commonMistakes: [
      "Capa sem headline impactante",
      "Páginas com texto >30 palavras",
      "Fonte muito pequena (ilegível em mobile)",
      "Baixo contraste texto/fundo",
      "Inconsistência visual entre páginas",
      "Mais de um ponto por página",
      "Sem gancho entre páginas",
      "Página final sem CTA claro",
      "Usar hashtags (são spam)",
      "Emojis decorativos nos slides de conteúdo",
    ],
    examples: [
      `Página 1:
5 erros que destroem sua produtividade
Você comete algum desses?

---

Página 2:
Erro #1: Multitarefa
Estudos mostram que multitarefa reduz produtividade em 40%. Foque em uma tarefa por vez.

---

Página 3:
Erro #2: Sem pausas
Seu cérebro precisa de descanso para alta performance. Use a técnica Pomodoro: 25min foco, 5min pausa.

---

Página 4:
Erro #3: Sem priorização
Nem tudo é urgente. Identifique o que realmente importa. Use a matriz de Eisenhower.

---

Página 5:
Erro #4: Distrações constantes
Notificações quebram sua concentração. Desative alertas durante tarefas importantes.

---

Página 6:
Erro #5: Perfeccionismo
Feito é melhor que perfeito. Progresso > Perfeição. Entregue e melhore depois.

---

Página 7:
RECAPITULANDO:
1. Evite multitarefa
2. Descanse adequadamente
3. Priorize tarefas
4. Elimine distrações
5. Pare de buscar perfeição

---

Página 8:
SALVE ESTE POST 📌
Para consultar depois

COMPARTILHE 📤
Com quem precisa ver isso

---

LEGENDA:
Você está sabotando sua própria produtividade sem perceber.

Esses 5 erros parecem inofensivos, mas estão custando horas do seu dia. O pior: a maioria das pessoas comete pelo menos 3 deles.

Qual desses erros você mais comete? Conta nos comentários.

Salve para consultar depois e mande para alguém que precisa ver isso.`,
    ],
  },
  {
    id: "tweet",
    name: "Tweet",
    emoji: "🐦",
    summary: "Máx 280 caracteres. Primeira frase = gancho. Uma ideia por tweet. Sem hashtags.",
    structure: [
      { title: "Tipos que funcionam", description: "Take quente (opinião controversa), Insight (sabedoria condensada), Pergunta (gera replies), Lista (\"X coisas que...\"), História em 1 tweet." },
      { title: "Formato", description: "Texto simples. Quebras de linha para ritmo. Emoji: ZERO no corpo (máx 1 no CTA final, se relevante)." },
    ],
    goldenRules: [
      "Primeira frase = gancho (determina se vão ler)",
      "Máximo 280 caracteres (ideal 200-250)",
      "Uma ideia por tweet",
      "ZERO hashtags",
      "Evite links no tweet principal",
      "Linguagem conversacional (escreva como fala)",
      "Use quebras de linha para ritmo",
      "ZERO emojis decorativos no corpo",
    ],
    deliveryFormat: "[TEXTO DO TWEET PRONTO PARA PUBLICAR]",
    commonMistakes: [
      "Tweet próximo de 280 chars (longo demais)",
      "Múltiplas ideias no mesmo tweet",
      "Usar hashtags",
      "Links no início",
      "Linguagem muito formal/corporativa",
      "Texto sem quebras (bloco único)",
      "Ser genérico tentando agradar todo mundo",
      "Sem gancho na primeira frase",
    ],
    examples: [
      `A maioria dos founders confunde "estar ocupado" com "estar produzindo".

Ocupação é vaidade.
Resultado é métrica.

Se no final do dia você não sabe exatamente o que moveu a agulha, você só estava se distraindo com estilo.`,
      `3 coisas que aprendi depois de perder meu melhor cliente:

1. Contrato não substitui relacionamento
2. Silêncio do cliente nunca é bom sinal
3. Entregar "o combinado" é o mínimo — não o diferencial

A retenção começa no dia 1, não na renovação.`,
    ],
  },
  {
    id: "thread",
    name: "Thread (Twitter/X)",
    emoji: "🧵",
    summary: "5-15 tweets conectados. Tweet 1 = gancho com 🧵. Cada tweet = valor próprio. Último = CTA.",
    structure: [
      { title: "Tweet 1 — Gancho", description: "Promessa clara + \"🧵\". Criar curiosidade irresistível. Números específicos ou história pessoal funcionam." },
      { title: "Tweets 2-N — Conteúdo", description: "Cada tweet = 1 ponto + valor próprio. Numerar (1/X, 2/X). Exemplo ou dado concreto em cada. Transição entre tweets." },
      { title: "Último Tweet — CTA", description: "Resumo dos pontos. \"Segue para mais\". \"RT o primeiro tweet\"." },
    ],
    goldenRules: [
      "Tweet 1 determina o sucesso — gancho fortíssimo",
      "Cada tweet deve ter valor próprio",
      "Numere os tweets (1/X)",
      "Use dados e exemplos concretos",
      "Mantenha fluxo narrativo",
      "Não ultrapasse 15 tweets (ideal 7-10)",
      "CTA no último tweet",
      "ZERO emojis decorativos e hashtags",
    ],
    deliveryFormat: `Tweet 1/X:
[Gancho prometendo o que a pessoa vai aprender/ganhar] 🧵

Tweet 2/X:
[Primeiro ponto - uma ideia]

[...]

Tweet X/X:
[CTA: Curta, salve, siga para mais]`,
    commonMistakes: [
      "Gancho fraco no tweet 1",
      "Tweets sem valor individual",
      "Thread muito longa (>15 tweets)",
      "Sem numeração",
      "Repetição entre tweets",
      "Sem CTA no final",
    ],
    examples: [
      `Tweet 1/7:
Gastei R$50k em anúncios antes de entender uma coisa que mudou tudo.

O problema nunca foi o criativo. Era o funil. 🧵

Tweet 2/7:
Meus anúncios tinham CTR acima de 3%.

As pessoas clicavam. Mas não compravam.

Eu achava que o problema era o público. Não era.

Tweet 3/7:
O problema: minha landing page tentava vender para quem ainda não confiava em mim.

Solução: criei uma etapa intermediária. Conteúdo gratuito de alto valor antes da oferta.

Tweet 4/7:
Resultado imediato:

- Custo por lead caiu 60%
- Taxa de conversão subiu de 1.2% para 4.8%
- ROI de 3x no primeiro mês

Tweet 5/7:
A lição: atenção ≠ intenção de compra.

Seu anúncio compra atenção.
Seu conteúdo constrói confiança.
Sua oferta converte quem já confia.

Tweet 6/7:
Se seus anúncios estão gerando cliques mas não vendas, o problema está entre o clique e a compra.

Construa essa ponte.

Tweet 7/7:
Resumindo:
- Cliques sem confiança = desperdício
- Conteúdo gratuito = ponte para a venda
- Funil > Criativo

Se isso fez sentido, salve e segue para mais.`,
    ],
  },
  {
    id: "linkedin",
    name: "Post LinkedIn",
    emoji: "💼",
    summary: "Primeiras 2 linhas = gancho (antes do \"ver mais\"). Storytelling profissional. 1.200-1.500 chars ideal.",
    structure: [
      { title: "Gancho (2 primeiras linhas)", description: "Gatilho emocional forte. Curiosidade ou promessa clara. História pessoal, dado surpreendente ou contrarian take." },
      { title: "Corpo", description: "Storytelling: Contexto → Desafio → Solução → Resultado. Parágrafos curtos (1-2 frases). Listas para pontos-chave." },
      { title: "CTA + Fechamento", description: "Pergunta para gerar comentários. \"Concorda?\" ou \"O que você faria?\"." },
    ],
    goldenRules: [
      "Primeiras 2 linhas = gancho (antes do 'ver mais')",
      "Parágrafos curtos (1-2 frases máx)",
      "Storytelling > autopromoção",
      "Links reduzem alcance — coloque no comentário",
      "Tom profissional mas humano",
      "Emojis: máx 2-3 estratégicos",
      "ZERO hashtags",
    ],
    deliveryFormat: `[Gancho - 2 linhas que aparecem antes do "ver mais"]

[Corpo com parágrafos curtos de 1-2 frases]

[CTA / pergunta que gera comentários]`,
    commonMistakes: [
      "Gancho fraco (ninguém clica 'ver mais')",
      "Parágrafos longos",
      "Tom corporativo demais",
      "Link no corpo do post (reduz alcance)",
      "Usar hashtags",
      "Sem CTA no final",
    ],
    examples: [
      `Recusei uma proposta de R$40k/mês ontem.

Parece loucura? Deixa eu explicar.

O cliente queria que eu operasse 5 redes sociais, criasse 60 peças por mês, gerenciasse ads e ainda fizesse relatórios semanais.

Com uma equipe de... eu. Sozinho.

O mercado normalizou escopo infinito por preço fixo. E profissionais aceitam porque têm medo de perder o cliente.

O resultado? Burnout, trabalho medíocre e cliente insatisfeito mesmo assim.

Minha regra agora:

→ Menos clientes, mais profundidade
→ Preço justo pelo escopo real
→ Se não cabe no orçamento, reduzo o escopo — não o preço

Dizer "não" para dinheiro fácil é dizer "sim" para trabalho que vale a pena.

Qual foi a proposta mais absurda que você já recebeu?`,
    ],
  },
  {
    id: "newsletter",
    name: "Newsletter",
    emoji: "📧",
    summary: "Assunto <50 chars. Preview text complementar. Abertura com gancho. Parágrafos curtos. 1 CTA principal.",
    structure: [
      { title: "Assunto (Subject Line)", description: "Máx 50 caracteres. Curiosidade, urgência moderada ou benefício claro. Evite ALL CAPS e palavras spam." },
      { title: "Preview Text", description: "Máx 90 caracteres. Complementa o assunto (não repete). Funciona como segundo gancho." },
      { title: "Abertura (100 palavras)", description: "Gancho forte: história pessoal, dado surpreendente, pergunta provocativa. Tom pessoal com \"você\"." },
      { title: "Corpo Principal", description: "Parágrafos curtos (3-4 linhas). Formatos: curadoria (3-5 itens), educativo (problema→solução), storytelling (caso real)." },
      { title: "CTA", description: "1 CTA principal claro. Texto de ação específico ('Leia o artigo completo' > 'Clique aqui')." },
      { title: "Fechamento", description: "Assinatura pessoal. PS/P.S. opcional (alta taxa de leitura). Preview do próximo envio." },
    ],
    goldenRules: [
      "Assunto: máx 50 caracteres",
      "Preview text complementar (não repete assunto)",
      "Gancho nos primeiros 100 palavras",
      "Parágrafos curtos (máx 3-4 linhas)",
      "1 CTA principal (não confundir leitor)",
      "Tom conversacional e pessoal",
      "500-1500 palavras (depende do formato)",
      "Valor real > promoção",
    ],
    deliveryFormat: `**ASSUNTO:** [máx 50 chars]
**PREVIEW:** [máx 90 chars]

---

[Corpo da newsletter com parágrafos curtos]

---

**CTA:** [Call-to-action principal]

[Fechamento + assinatura]

P.S. [Reforço opcional]`,
    commonMistakes: [
      "Assunto genérico ou muito longo",
      "Preview text que repete o assunto",
      "Abertura sem gancho",
      "Parágrafos muito longos",
      "Múltiplos CTAs competindo",
      "Foco em promoção (vs. valor)",
      "Tom muito formal/robótico",
    ],
    examples: [
      `**ASSUNTO:** O erro de R$200k que quase quebrou meu negócio
**PREVIEW:** E a planilha simples que me salvou

---

Oi,

Em 2024 eu quase quebrei.

Não por falta de clientes. Tinha mais projetos do que conseguia entregar. O problema era outro: eu não sabia quanto custava cada hora do meu time.

Resultado? Faturava R$80k/mês e lucrava R$3k. Às vezes dava prejuízo sem perceber.

O turning point foi uma planilha ridiculamente simples que me fez enxergar 3 coisas:

1. Dois clientes consumiam 60% do tempo e geravam 15% da receita
2. Meu serviço mais vendido tinha margem de 8% (quase zero)
3. Eu estava subsidiando clientes grandes com o lucro dos pequenos

Em 30 dias, renegociei 2 contratos, cortei 1 serviço e aumentei preço de 3.

Margem foi de 4% para 31% no trimestre seguinte.

Se você presta serviço e não sabe sua margem por cliente, me responde este email que eu te mando a planilha.

---

**CTA:** Responda "margem" e eu te envio a planilha

Abraço,
[Nome]

P.S. Não é uma planilha complexa. São 4 colunas. Mas mudou tudo.`,
    ],
  },
  {
    id: "post-instagram",
    name: "Post Estático Instagram",
    emoji: "📸",
    summary: "Uma mensagem visual impactante. Legenda com gancho na 1ª linha. Sem hashtags.",
    structure: [
      { title: "Tipos que funcionam", description: "Quote/frase, dica rápida, meme/trend, bastidores, antes/depois, dado impactante." },
      { title: "Imagem", description: "1080x1080 (quadrado) ou 1080x1350 (vertical). Visual limpo, tipografia legível, contraste alto." },
      { title: "Legenda", description: "Primeira linha = gancho (antes do 'mais'). Corpo com valor. CTA para engajamento. ZERO hashtags." },
    ],
    goldenRules: [
      "Uma mensagem por post",
      "Primeira linha da legenda = gancho",
      "Visual > texto na imagem",
      "ZERO hashtags",
      "CTA na legenda (pergunta ou ação)",
      "Consistência visual com a marca",
    ],
    deliveryFormat: `**TEXTO NA IMAGEM:**
[Frase principal - máx 10 palavras]

---

**LEGENDA:**
[Gancho - primeira linha que para o scroll]

[Corpo com valor em parágrafos curtos]

[CTA claro]`,
    commonMistakes: [
      "Imagem com muito texto",
      "Legenda sem gancho",
      "Usar hashtags",
      "Sem CTA",
      "Visual inconsistente com a marca",
    ],
    examples: [
      `**TEXTO NA IMAGEM:**
Seu preço não é caro. Seu cliente é errado.

---

**LEGENDA:**
Se todo mundo acha caro, o problema não é o preço.

É o público.

Produto premium precisa de audiência premium. Não adianta vender caviar para quem quer miojo.

Antes de baixar seu preço, suba o nível da sua comunicação.

Concorda? Marca alguém que precisa ouvir isso.`,
    ],
  },
  {
    id: "reels",
    name: "Reels / Short Video",
    emoji: "🎬",
    summary: "Roteiro 30-90s. Gancho em 3 segundos. 1 ideia por vídeo. Texto na tela.",
    structure: [
      { title: "Gancho (0-3s)", description: "Frase ou ação que PARA o scroll. Curiosidade, choque ou identificação. Nunca comece com 'Olá'." },
      { title: "Desenvolvimento (3-50s)", description: "Conteúdo em blocos curtos. 1 ideia por corte visual. Ritmo acelerado. Texto na tela reforçando pontos." },
      { title: "Clímax (50-70s)", description: "Ponto principal, revelação ou insight mais forte." },
      { title: "CTA / Loop (últimos 5-10s)", description: "Call-to-action claro. OU loop para rewatches (conectar final ao início)." },
    ],
    goldenRules: [
      "Gancho nos 3 primeiros segundos",
      "1 ideia por vídeo",
      "Texto na tela — 70% assistem sem áudio",
      "Ritmo rápido — cortes a cada 2-4 segundos",
      "Formato vertical 9:16 sempre",
      "Linguagem falada (como se fala, não como se lê)",
    ],
    deliveryFormat: `**GANCHO (0-3s):**
[Texto na tela + fala]

**CENA 1 (3-15s):**
[Ação/fala + texto na tela]

**CENA 2 (15-30s):**
[Ação/fala + texto na tela]

[...]

**CTA FINAL:**
[Ação específica + texto na tela]

---

LEGENDA:
[Legenda curta sem hashtags]`,
    commonMistakes: [
      "Sem gancho forte nos 3 primeiros segundos",
      "Vídeo muito longo sem ritmo",
      "Sem texto na tela",
      "Múltiplos temas num único vídeo",
      "Formato horizontal",
    ],
    examples: [
      `**GANCHO (0-3s):**
TEXTO NA TELA: "Isso destruiu meu negócio"
FALA: "Uma decisão que eu tomei em 2023 quase acabou com tudo."

**CENA 1 (3-12s):**
TEXTO: "O erro: escalar antes de ter processo"
FALA: "Eu contratei 4 pessoas sem ter um processo definido. Resultado? Caos total."

**CENA 2 (12-22s):**
TEXTO: "O que deveria ter feito"
FALA: "Primeiro documenta, depois automatiza, depois contrata. Nessa ordem."

**CENA 3 (22-28s):**
TEXTO: "Hoje com processo → 3x mais entregas, metade do time"
FALA: "Hoje faço 3x mais com metade das pessoas. Processo > pessoas."

**CTA FINAL:**
TEXTO: "Salve para não esquecer"
FALA: "Salva esse vídeo e manda pra alguém que tá cometendo esse erro."

---

LEGENDA:
O maior erro de quem cresce rápido: achar que contratar resolve tudo.

Processo primeiro. Pessoas depois.`,
    ],
  },
  {
    id: "stories",
    name: "Stories Instagram",
    emoji: "✨",
    summary: "Sequência de 3-7 stories. 15s por story. Texto curto (máx 50 palavras). Vertical 9:16.",
    structure: [
      { title: "Story 1 — Capa/Gancho", description: "Visual impactante. Texto curto e claro. Criar curiosidade para continuar." },
      { title: "Stories 2-N — Conteúdo", description: "Uma ideia por story. Máx 50 palavras. Stickers interativos (enquete, quiz, slider)." },
      { title: "Última Story — CTA", description: "Ação clara: responda, vote, visite link, mande DM." },
    ],
    goldenRules: [
      "Máx 50 palavras por story",
      "Sequência de 3-7 stories (ideal)",
      "Use stickers interativos",
      "Texto legível em mobile",
      "Uma ideia por story",
      "Visual autêntico (não precisa ser perfeito)",
    ],
    deliveryFormat: `Story 1:
[Texto do story - máx 50 palavras]
STICKER: [Se aplicável]

---

Story 2:
[Texto]
STICKER: [Se aplicável]

---

[...]

Story Final:
[CTA claro]
STICKER: [Enquete/Pergunta/Link]`,
    commonMistakes: [
      "Sequência muito longa (>10 stories)",
      "Texto ilegível ou muito pequeno",
      "Sem interatividade (stickers)",
      "Visual poluído",
      "Sem CTA no final",
    ],
    examples: [
      `Story 1:
Uma coisa que ninguém te conta sobre criar conteúdo:

Story 2:
Consistência NÃO significa postar todo dia.
Significa NUNCA sumir por semanas.

Story 3:
3 posts por semana com qualidade > 7 posts ruins
STICKER: Enquete "Concordam? Sim / Não"

Story 4:
Minha regra: qualidade mínima.
Se não está bom o suficiente, não posto.
Prefiro silêncio a mediocridade.

Story 5:
Qual sua maior dificuldade com consistência?
STICKER: Caixa de perguntas`,
    ],
  },
  {
    id: "blog",
    name: "Blog Post",
    emoji: "📝",
    summary: "1.500-2.000 palavras. Título SEO <60 chars. Meta description. Headings hierárquicos. CTA no final.",
    structure: [
      { title: "Título (H1)", description: "Máx 60 chars. Keyword principal no início. Número ou promessa clara. Sem clickbait." },
      { title: "Meta Description", description: "Máx 160 chars. Resumo com benefício claro. Include keyword." },
      { title: "Introdução", description: "Gancho forte. Contexto do problema. Preview do que será coberto. 100-150 palavras." },
      { title: "Corpo (H2/H3)", description: "3-5 seções principais. Subtítulos claros. Bullet points. Exemplos e dados. Parágrafos curtos." },
      { title: "Conclusão + CTA", description: "Resumo dos pontos principais. CTA específico. Pergunta para comentários." },
    ],
    goldenRules: [
      "Título SEO-friendly com keyword",
      "Meta description <160 chars",
      "Headings hierárquicos (H2, H3)",
      "Parágrafos curtos (3-4 linhas)",
      "Dados e exemplos concretos",
      "Links internos e externos relevantes",
      "Imagens com alt text",
      "1.500-2.000 palavras (ideal)",
    ],
    deliveryFormat: `**TÍTULO:** [Título SEO - máx 60 chars]
**META DESCRIPTION:** [150-160 chars]

---

# [Título do artigo]

[Introdução - 2-3 parágrafos com gancho]

## [Seção 1]
[Conteúdo com parágrafos curtos, dados e exemplos]

## [Seção 2]
[Conteúdo...]

## [Seção 3]
[Conteúdo...]

## Conclusão
[Resumo + CTA]`,
    commonMistakes: [
      "Título muito longo ou sem keyword",
      "Sem meta description",
      "Parágrafos longos demais",
      "Sem headings (texto corrido)",
      "Sem dados ou exemplos",
      "Sem CTA no final",
    ],
    examples: [
      `**TÍTULO:** 5 Estratégias de Precificação Para Serviços Digitais
**META DESCRIPTION:** Aprenda como precificar seus serviços digitais com 5 estratégias testadas que aumentam margem sem perder clientes.

---

# 5 Estratégias de Precificação Para Serviços Digitais em 2026

Precificar serviços é uma das decisões mais difíceis para profissionais digitais. Cobrar pouco significa trabalhar demais por pouco. Cobrar muito pode afastar clientes.

A verdade? O preço "certo" não existe. Mas existem estratégias que aumentam sua margem sem espantar bons clientes.

## 1. Precificação por Valor, Não por Hora

O modelo de hora/trabalho tem um teto: suas horas são limitadas.

Quando você cobra pelo resultado entregue (não pelas horas gastas), seu ganho escala com sua expertise, não com seu tempo.

**Exemplo:** Um redesign de landing page que aumenta conversão em 40% vale muito mais do que "20 horas de design".

## 2. Ancoragem com 3 Pacotes

[...]

## Conclusão

Precificar bem não é sobre encontrar o número mágico. É sobre comunicar valor de forma que o cliente entenda o retorno.

Comece com uma mudança: troque "cobro X por hora" por "o investimento para [resultado] é X".`,
    ],
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    emoji: "📮",
    summary: "200-500 palavras. Assunto com urgência/curiosidade. Copy de vendas. CTA claro e repetido.",
    structure: [
      { title: "Assunto", description: "Máx 50 chars. Urgência moderada ou curiosidade. Benefício claro. Evite palavras spam." },
      { title: "Preview Text", description: "Complemento irresistível do assunto." },
      { title: "Abertura", description: "Gancho emocional. Conectar com dor/desejo. Pessoal e direto." },
      { title: "Corpo", description: "Benefícios > características. Prova social. Escassez/urgência moderada. Parágrafos curtos." },
      { title: "CTA", description: "Botão destacado. Texto de ação específico. Repetir CTA 2-3x ao longo do email." },
    ],
    goldenRules: [
      "Assunto: máx 50 caracteres",
      "Curto e direto (200-500 palavras)",
      "Benefícios > características",
      "1 objetivo por email",
      "CTA claro e repetido",
      "Prova social quando possível",
      "Urgência moderada (sem exagero)",
    ],
    deliveryFormat: `**ASSUNTO:** [Máx 50 chars]
**PREVIEW:** [Complemento]

---

[Saudação curta]

[Parágrafo 1 - Problema/Dor]

[Parágrafo 2 - Solução/Oferta]

[BOTÃO CTA: Texto do botão]

[Urgência/Escassez se aplicável]

[Assinatura]

P.S. [Reforço da oferta]`,
    commonMistakes: [
      "Email muito longo",
      "Múltiplos objetivos",
      "CTA fraco ou escondido",
      "Sem prova social",
      "Urgência exagerada (parece spam)",
      "Assunto com palavras spam (GRÁTIS, $$$)",
    ],
    examples: [
      `**ASSUNTO:** Últimas 12 vagas (fecha sexta)
**PREVIEW:** O desconto de 40% não volta

---

Oi [Nome],

Você já tentou criar conteúdo consistente e desistiu no meio do caminho?

Normal. 87% das pessoas param no primeiro mês.

A Mentoria Conteúdo Pro foi desenhada exatamente para esse problema: um sistema passo a passo que transforma criação de conteúdo em rotina — não em peso.

[BOTÃO: QUERO MINHA VAGA]

O que você recebe:
→ 8 semanas de acompanhamento
→ Templates prontos para 12 formatos
→ Grupo exclusivo com feedback diário
→ 143 alunos já passaram (NPS 9.2)

As vagas com 40% de desconto fecham sexta, 23:59.
Restam 12 das 30 originais.

[BOTÃO: GARANTIR MINHA VAGA COM 40% OFF]

Abraço,
[Nome]

P.S. Se você quer testar antes, responda este email com "teste" e eu libero acesso a uma aula gratuita.`,
    ],
  },
  {
    id: "long-video",
    name: "Vídeo Longo YouTube",
    emoji: "🎥",
    summary: "Roteiro 8-25 min. Hook em 30s. 3-5 seções com timestamps. Exemplos concretos. CTA no final.",
    structure: [
      { title: "Hook / Abertura (0-30s)", description: "Promessa clara. Dado surpreendente ou história rápida. Sem vinheta longa." },
      { title: "Contexto (30s-2min)", description: "Por que o tema é importante agora. Credibilidade rápida. Framework do vídeo." },
      { title: "Corpo Principal (2-18min)", description: "3-5 seções claramente delimitadas. Cada seção: título + explicação + exemplo. Timestamps." },
      { title: "Clímax (18-22min)", description: "Grande revelação ou framework completo. Recompensa por ter assistido." },
      { title: "CTA + Encerramento (últimos 2-3min)", description: "Resumo em 2-3 frases. CTA específico (inscrever, outro vídeo)." },
    ],
    goldenRules: [
      "Hook em 30 segundos — promessa clara de valor",
      "Estrutura visível — divida em seções com timestamps",
      "Exemplos concretos para cada ponto abstrato",
      "Retenção > Duração",
      "Pattern interrupt a cada 3-4 minutos",
      "Open loop — mencione algo que será revelado depois",
    ],
    deliveryFormat: `**TÍTULO:** [Título YouTube - máx 60 chars]
**THUMBNAIL TEXT:** [2-4 palavras impactantes]

---

[00:00] HOOK
[Fala que prende]

[00:30] CONTEXTO
[Por que importa]

[02:00] SEÇÃO 1: [Título]
[Roteiro com marcações]

[08:00] SEÇÃO 2: [Título]
[Roteiro...]

[...]

[TIMESTAMPS]

**DESCRIÇÃO:**
[Descrição SEO]

CTA: [Inscreva-se + próximo vídeo]`,
    commonMistakes: [
      "Sem hook nos primeiros 30 segundos",
      "Vídeo sem estrutura clara",
      "Sem timestamps",
      "Pontos abstratos sem exemplos",
      "Muito longo sem pattern interrupts",
    ],
    examples: [
      `**TÍTULO:** Como Criar um Funil de Conteúdo que Vende Sozinho
**THUMBNAIL TEXT:** FUNIL DE CONTEÚDO

---

[00:00] HOOK
"Nos últimos 6 meses, 73% das minhas vendas vieram de pessoas que me descobriram por um único post. Hoje vou te mostrar exatamente como montar esse funil."

[00:25] CONTEXTO
"A maioria cria conteúdo aleatório e espera que vendas apareçam. Não funciona assim. Você precisa de um funil — topo, meio e fundo — e cada conteúdo tem uma função específica."

[01:30] SEÇÃO 1: TOPO DE FUNIL — Conteúdo de Descoberta
"Aqui o objetivo é alcance. A pessoa não te conhece. Formatos: Reels polêmicos, carrosséis educativos, tweets provocativos..."

[...]`,
    ],
  },
  {
    id: "artigo-x",
    name: "Artigo no X (Twitter)",
    emoji: "📰",
    summary: "1.500-3.000 palavras nativo do X. Título <100 chars. Tom pessoal. Headings para escaneabilidade.",
    structure: [
      { title: "Título", description: "Máx 100 chars. Impactante e claro. Pode usar emoji no início (1 máx)." },
      { title: "Introdução", description: "Contexto pessoal. Por que este tema importa. Preview do conteúdo." },
      { title: "Corpo", description: "Seções com headings claros. Parágrafos curtos (2-3 frases). Listas e dados. Tom conversacional." },
      { title: "Conclusão", description: "Resumo dos takeaways. CTA para seguir/comentar." },
    ],
    goldenRules: [
      "Título impactante <100 chars",
      "Tom pessoal e conversacional",
      "Headings para escaneabilidade",
      "Parágrafos curtos (2-3 frases)",
      "Dados e exemplos concretos",
      "1.500-3.000 palavras",
    ],
    deliveryFormat: `**TÍTULO:** [Máx 100 chars]

---

[Introdução - 2-3 parágrafos pessoais]

## [Seção 1]
[Conteúdo com parágrafos curtos]

## [Seção 2]
[Conteúdo...]

## Conclusão
[Resumo + CTA]

---

**TWEET DE DIVULGAÇÃO:**
[Tweet para promover o artigo - máx 280 chars, sem hashtags]`,
    commonMistakes: [
      "Título fraco ou muito longo",
      "Texto corrido sem headings",
      "Tom muito formal",
      "Sem dados ou exemplos",
      "Sem tweet de divulgação",
    ],
    examples: [
      `**TÍTULO:** Por que parei de cobrar por hora (e tripliquei meu faturamento)

---

Em 2023, eu cobrava R$150/hora.

Trabalhava 10h por dia, 6 dias por semana. Faturava R$35k/mês e estava exausto. Meu teto era claro: minhas horas tinham limite.

Até que um mentor me perguntou: "Quanto vale o resultado que você entrega?"

## O Problema do Modelo por Hora

[...]

## A Transição para Valor

[...]

## Conclusão

Parar de cobrar por hora foi a melhor decisão de negócio que tomei. Não mudei o que faço. Mudei como comunico o valor.

---

**TWEET DE DIVULGAÇÃO:**
Parei de cobrar por hora em 2024.

Meu faturamento triplicou em 6 meses.

Escrevi sobre o processo completo, os erros e os números reais:`,
    ],
  },
];
