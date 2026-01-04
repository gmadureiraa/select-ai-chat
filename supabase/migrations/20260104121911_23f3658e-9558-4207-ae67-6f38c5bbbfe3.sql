-- Tabela para armazenar documentação de formatos e agentes
-- Isso permite que edge functions acessem a documentação dinamicamente
CREATE TABLE public.kai_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('format', 'agent', 'flow')),
  doc_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  checklist JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(doc_type, doc_key)
);

-- Enable RLS
ALTER TABLE public.kai_documentation ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (documentação é para todos os usuários)
CREATE POLICY "kai_documentation_read" ON public.kai_documentation
  FOR SELECT TO authenticated USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_kai_documentation_updated_at
  BEFORE UPDATE ON public.kai_documentation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index para buscas rápidas
CREATE INDEX idx_kai_documentation_type_key ON public.kai_documentation(doc_type, doc_key);

-- Popular com documentação de FORMATOS
INSERT INTO public.kai_documentation (doc_type, doc_key, title, content, summary, checklist, metadata) VALUES

-- THREAD
('format', 'thread', 'Thread (Twitter/X)', 
$DOC$## FORMATO: THREAD (TWITTER/X)

### PLATAFORMA: TWITTER/X (NÃO Instagram!)
Thread é uma série de TWEETS conectados no TWITTER/X.
NUNCA confunda com Stories (que é Instagram).

### ESTRUTURA OBRIGATÓRIA

**TWEET 1 (GANCHO)**: 100-150 caracteres
- Promessa, pergunta ou dado impactante
- OBRIGATÓRIO: Termine com "🧵" ou "Thread:"
- Este tweet precisa viralizar SOZINHO

**TWEETS 2-9 (DESENVOLVIMENTO)**
- 1 ideia por tweet
- OBRIGATÓRIO: Numere cada tweet (1/, 2/, 3/...)
- Cada tweet deve fazer sentido sozinho
- Use quebras de linha para legibilidade
- Máximo 280 caracteres por tweet

**ÚLTIMO TWEET (CTA)**
- Peça RT do primeiro tweet
- Resumo do valor entregue + call to action
- Convide para seguir

### REGRAS DE OURO
1. Limite de 280 caracteres por tweet (OBRIGATÓRIO)
2. Tweet 1 deve viralizar sozinho
3. Progressão lógica de valor
4. Dados específicos, não genéricos
5. 5-15 tweets ideal
6. Cada tweet faz sentido sozinho
7. Numerar: 1/X, 2/X, etc.
8. Último tweet: Pedir RT do primeiro

### FORMATO DE ENTREGA
```
1/10
[Tweet 1 - Gancho com 🧵]

2/10
[Tweet 2 - Primeiro ponto]

...

10/10
[Último tweet - Resumo + CTA + "RT o primeiro tweet"]
```$DOC$,
'Thread é série de tweets conectados no Twitter/X. 5-15 tweets, max 280 chars cada, numerar 1/X.',
'["Cada tweet max 280 caracteres", "Tweet 1 com 🧵 no final", "Numerar tweets (1/X, 2/X)", "5-15 tweets total", "Um ponto por tweet", "Último tweet pede RT do primeiro", "Progressão lógica de valor"]'::jsonb,
'{"platform": "twitter", "ideal_length": "5-15 tweets", "char_limit": 280}'::jsonb),

-- STORIES
('format', 'stories', 'Stories (Instagram)', 
$DOC$## FORMATO: STORIES (INSTAGRAM)

### PLATAFORMA: INSTAGRAM (NÃO Twitter!)
Stories são sequências VERTICAIS de imagens/vídeos no INSTAGRAM.
NUNCA confunda com Thread (que é Twitter/X).

### ESTRUTURA OBRIGATÓRIA

**STORY 1 (GANCHO/CAPA)**
- Visual impactante
- Texto CURTO (máx 10 palavras)
- Indicação: "1/5" ou "1 de 5"
- Cria curiosidade para continuar

**STORIES 2-6 (DESENVOLVIMENTO)**
- 10-20 palavras por story
- Texto GRANDE e LEGÍVEL (fonte grande!)
- UMA ideia por story
- Cada story tem valor próprio

**ÚLTIMO STORY (CTA)**
- "Deslize para cima", "Link na bio", etc.
- Destaque visual para o CTA
- Indicação de sequência final

### REGRAS DE OURO
1. Sequência de 3-7 stories (ideal: 5)
2. Máx 50 palavras por story
3. Texto GRANDE e legível
4. Alto contraste para leitura
5. Formato VERTICAL (9:16)
6. Indicação de sequência (1/5, 2/5...)

### FORMATO DE ENTREGA
```
**SEQUÊNCIA:** [X stories]

[STORY 1/5 - CAPA]
VISUAL: [Descrição do visual]
TEXTO: [Texto do story - máx 50 palavras]
INDICAÇÃO: "1/5"

[STORY 2/5]
VISUAL: [Descrição]
TEXTO: [Texto]
INDICAÇÃO: "2/5"

...

[STORY 5/5 - CTA]
VISUAL: [Descrição com CTA destacado]
TEXTO: [CTA + encerramento]
INDICAÇÃO: "5/5"
LINK: [Se aplicável]
```$DOC$,
'Stories são sequências verticais no Instagram. 3-7 stories, max 50 palavras cada, indicar sequência.',
'["Sequência de 3-7 stories", "Máx 50 palavras por story", "Indicar sequência (1/5)", "Texto grande e legível", "Formato vertical 9:16", "Último story com CTA"]'::jsonb,
'{"platform": "instagram", "ideal_length": "5 stories", "format": "9:16 vertical"}'::jsonb),

-- CARROSSEL
('format', 'carousel', 'Carrossel (Instagram/LinkedIn)', 
$DOC$## FORMATO: CARROSSEL

### REGRA DE OURO
O Slide 1 é 80% do sucesso. Se não parar o scroll, o resto não importa.

### ESTRUTURA OBRIGATÓRIA
**SLIDE 1 (CAPA/GANCHO)**: Máx 20 palavras - headline impactante, dor/urgência/curiosidade
**SLIDE 2 (PONTE)**: Aprofunde a dor, NÃO entregue solução ainda
**SLIDES 3-8**: 1 ideia por slide, máx 30 palavras cada
**SLIDE 9 (RESUMO)**: Lista dos pontos principais
**SLIDE 10 (CTA)**: "Salve para depois" + "Manda pra alguém" + CTA específico

### REGRAS DE OURO
1. Headline da capa: Máximo 8 palavras
2. Cada slide: Máximo 30 palavras
3. Fonte legível (grande)
4. Contraste alto
5. Gancho entre slides
6. Visual consistente
7. Um ponto por slide
8. 7-10 slides ideal

### FORMATO DE ENTREGA
```
[SLIDE 1 - CAPA]
TÍTULO: [Headline impactante]
VISUAL: [Descrição do design]

[SLIDE 2]
TÍTULO: [Título do ponto]
VISUAL: [Descrição]
TEXTO: [Texto - máx 30 palavras]

...

[SLIDE 10 - CTA]
VISUAL: [Descrição]
TEXTO: [CTA + "Salve" + "Manda pra alguém"]

---
LEGENDA: [Texto com hashtags]
```$DOC$,
'Carrossel para Instagram/LinkedIn. 7-10 slides, max 30 palavras por slide, capa impactante.',
'["Slide 1 com headline max 8 palavras", "Cada slide max 30 palavras", "7-10 slides ideal", "Fonte grande e legível", "Contraste alto", "Último slide com CTA", "Legenda com 3-5 hashtags"]'::jsonb,
'{"platform": "instagram,linkedin", "ideal_length": "10 slides", "format": "1080x1080 ou 1080x1350"}'::jsonb),

-- NEWSLETTER
('format', 'newsletter', 'Newsletter', 
$DOC$## FORMATO: NEWSLETTER

### ESTRUTURA OBRIGATÓRIA
1. **Assunto** (45-60 chars) - Curto, intrigante, cria urgência
2. **Preview Text** (85-100 chars) - Complementa o assunto, NÃO repete
3. **Abertura** (100 palavras) - Gancho forte, conecta com leitor
4. **Corpo** - 2-4 seções com valor real, parágrafos curtos
5. **CTA Principal** - Claro e específico
6. **Assinatura** - Pessoal e memorável
7. **PS** (opcional) - Alta taxa de leitura, última chance de engajamento

### REGRAS DE OURO
- Taxa de abertura meta: >25%
- Taxa de clique meta: >3%
- Máximo 500-800 palavras
- Parágrafos curtos (máx 3 linhas)
- 1 CTA principal por newsletter
- Tom conversacional e pessoal

### FORMATO DE ENTREGA
```
**ASSUNTO:** [Max 50 caracteres]
**PREVIEW:** [Max 90 caracteres]

---

[Corpo da newsletter com formatação]

---

**CTA:** [Call-to-action principal]

[Fechamento com assinatura]

P.S. [Gatilho final opcional]
```$DOC$,
'Newsletter com assunto curto, preview text, abertura com gancho, corpo com valor, CTA claro.',
'["Assunto max 50 caracteres", "Preview text max 90 chars", "Gancho forte na abertura", "Parágrafos max 3 linhas", "1 CTA principal", "Assinatura pessoal", "500-800 palavras total"]'::jsonb,
'{"ideal_length": "500-800 words", "open_rate_target": ">25%", "click_rate_target": ">3%"}'::jsonb),

-- TWEET
('format', 'tweet', 'Tweet (Twitter/X)', 
$DOC$## FORMATO: TWEET

### PLATAFORMA: TWITTER/X
Tweet único, diferente de Thread.

### REGRAS
- Limite OBRIGATÓRIO: 280 caracteres
- Primeira linha é crítica (gancho)
- Uma ideia por tweet
- Menos é mais
- Máx 1-2 hashtags
- Máx 1-2 emojis

### TIPOS QUE FUNCIONAM
1. Take quente (opinião controversa)
2. Insight (sabedoria em uma frase)
3. Pergunta (gera replies)
4. Lista rápida (3-5 itens)
5. História em 1 tweet

### ESTRUTURAS EFICAZES
- Afirmação + Contexto
- Pergunta + Resposta
- Dado + Insight
- Lista rápida$DOC$,
'Tweet único no Twitter/X. Max 280 caracteres, uma ideia, gancho forte.',
'["Max 280 caracteres", "Uma ideia por tweet", "Primeira linha é gancho", "Max 1-2 hashtags", "Linguagem conversacional"]'::jsonb,
'{"platform": "twitter", "char_limit": 280}'::jsonb),

-- LINKEDIN POST
('format', 'linkedin_post', 'Post LinkedIn', 
$DOC$## FORMATO: LINKEDIN POST

### ESTRUTURA
**LINHA 1-2 (GANCHO)**: Primeiras linhas aparecem ANTES do "ver mais" - críticas!
**DESENVOLVIMENTO**: 100-250 palavras, parágrafos curtos
**LIÇÃO/TAKEAWAY**: Valor claro e aplicável
**CTA**: Pergunta para comentários

### REGRAS
- LinkedIn valoriza autenticidade
- Storytelling > Teoria
- Eduque, não venda
- Parágrafos de 1-2 linhas
- 1.200-1.500 caracteres ideal
- Máximo 3-5 hashtags
- Tom profissional mas humano$DOC$,
'Post LinkedIn com gancho nas primeiras 2 linhas, storytelling, tom profissional.',
'["Gancho forte nas 2 primeiras linhas", "Parágrafos de 1-2 linhas", "1.200-1.500 caracteres", "Max 3-5 hashtags", "Terminar com pergunta", "Tom profissional mas humano"]'::jsonb,
'{"platform": "linkedin", "ideal_length": "1200-1500 chars"}'::jsonb),

-- INSTAGRAM POST
('format', 'instagram_post', 'Post Instagram', 
$DOC$## FORMATO: POST INSTAGRAM

### ESTRUTURA
**PRIMEIRA LINHA**: Máx 125 chars (aparece antes do "mais...")
**CORPO**: 150-300 palavras, quebras de linha
**CTA + HASHTAGS**: 5-10 hashtags no final

### REGRAS
- Emojis apenas início/fim de linhas
- Parágrafos curtos (1-2 linhas)
- Hashtags NUNCA no meio do texto
- Uma mensagem por post
- Contraste alto no visual
- Texto na imagem: máx 20 palavras$DOC$,
'Post Instagram com primeira linha como gancho, parágrafos curtos, 5-10 hashtags.',
'["Primeira linha max 125 chars", "Uma mensagem por post", "Parágrafos curtos", "5-10 hashtags no final", "Texto na imagem max 20 palavras"]'::jsonb,
'{"platform": "instagram", "format": "1080x1080 ou 1080x1350"}'::jsonb),

-- EMAIL MARKETING
('format', 'email_marketing', 'Email Marketing', 
$DOC$## FORMATO: EMAIL MARKETING

### ESTRUTURA
1. **Assunto**: Max 50 chars, urgência ou curiosidade
2. **Preview**: Complementa assunto
3. **Headline**: Benefício principal
4. **Problema**: Dor do público (2-3 frases)
5. **Solução**: Seu produto/oferta
6. **Benefícios**: 3-5 bullets
7. **Prova social**: Se disponível
8. **CTA**: Único, repetido 2-3x
9. **PS**: Gatilho final

### REGRAS
- Foco em benefícios, não features
- Urgência sem ser forçado
- 1 CTA principal, repetido 2-3x
- Mobile-first (parágrafos curtos)
- 200-500 palavras$DOC$,
'Email marketing com assunto curto, benefícios claros, CTA repetido.',
'["Assunto max 50 chars", "1 CTA repetido 2-3x", "3-5 benefícios em bullets", "PS no final", "Mobile-first", "200-500 palavras"]'::jsonb,
'{"ideal_length": "200-500 words"}'::jsonb),

-- BLOG POST
('format', 'blog_post', 'Blog Post', 
$DOC$## FORMATO: BLOG POST

### ESTRUTURA
1. **Título (H1)**: Max 60 chars, keyword no início
2. **Meta description**: 150-160 chars
3. **Introdução**: 150-200 palavras com gancho
4. **Corpo**: H2/H3 hierárquicos, parágrafos max 4 linhas
5. **Conclusão**: Recap em bullets + CTA

### REGRAS SEO
- Keyword principal no H1, primeiro parágrafo, 1 H2
- Links internos: 2-5
- Links externos: 1-3
- Alt text em imagens
- Subtítulos a cada 300-400 palavras
- 1.500-2.000 palavras ideal$DOC$,
'Blog post otimizado para SEO com título max 60 chars, hierarquia H2/H3.',
'["Título max 60 chars com keyword", "Meta description 150-160 chars", "Introdução com gancho", "Parágrafos max 4 linhas", "Subtítulos a cada 300-400 palavras", "1.500-2.000 palavras", "Links internos 2-5"]'::jsonb,
'{"ideal_length": "1500-2000 words", "title_limit": 60}'::jsonb),

-- ARTIGO X
('format', 'x_article', 'Artigo no X', 
$DOC$## FORMATO: ARTIGO NO X

### ESTRUTURA
**TÍTULO**: Máx 100 chars, impactante
**CAPA**: Imagem 16:9 de qualidade
**ABERTURA**: Gancho forte nos 2 primeiros parágrafos
**CORPO**: Parágrafos curtos, headings, 2-5 imagens inline
**CONCLUSÃO**: Recap breve + opinião + CTA de engajamento

### REGRAS
- Tom conversacional e opinativo
- Parágrafos max 3 linhas
- NÃO use emojis no meio de frases
- 1.500-4.000 palavras
- Opiniões fortes geram mais engajamento$DOC$,
'Artigo longo no X com tom opinativo, 1.500-4.000 palavras.',
'["Título max 100 chars", "Imagem de capa 16:9", "Parágrafos curtos", "2-5 imagens inline", "Tom opinativo", "1.500-4.000 palavras", "CTA de engajamento no final"]'::jsonb,
'{"platform": "twitter", "ideal_length": "1500-4000 words"}'::jsonb);

-- Popular com documentação de AGENTES
INSERT INTO public.kai_documentation (doc_type, doc_key, title, content, summary, metadata) VALUES

-- CONTENT WRITER
('agent', 'content_writer', 'Content Writer Agent', 
$DOC$## AGENTE ESCRITOR DE CONTEÚDO

### MISSÃO
Criar conteúdo textual de alta qualidade seguindo estritamente as diretrizes do cliente.

### HIERARQUIA DE INFORMAÇÃO (ordem de prioridade)
1. **Identidade do cliente** (identity_guide) - tom, voz, estilo - PRIORIDADE MÁXIMA
2. **Documentação do formato** - estrutura e regras obrigatórias
3. **Biblioteca de conteúdo** (content_library) - exemplos reais como referência
4. **Knowledge base** (global_knowledge) - insights a ADAPTAR ao tom do cliente

### COMO AGIR
1. **SEMPRE consultar identity_guide** - Tom de voz, personalidade, valores são SAGRADOS
2. **SEMPRE seguir documentação do formato** - Estrutura obrigatória do tipo de conteúdo
3. **Usar content_library como REFERÊNCIA** - Inspire-se, nunca copie
4. **ADAPTAR knowledge base** - Use insights, mas reescreva no tom do cliente
5. **Entregar conteúdo PRONTO** - Sem necessidade de edição adicional

### REGRAS ABSOLUTAS
- NUNCA crie conteúdo sem consultar identity_guide
- NUNCA use linguagem genérica de IA
- NUNCA copie conteúdo da biblioteca (inspire-se)
- SEMPRE adapte knowledge base ao tom do cliente
- SEMPRE siga a estrutura do formato
- SEMPRE valide com checklist do formato antes de entregar$DOC$,
'Agente principal de criação de conteúdo. Segue identidade do cliente, formato e usa biblioteca como referência.',
'{"model": "gemini-2.5-pro", "temperature": 0.8}'::jsonb),

-- RESEARCHER
('agent', 'researcher', 'Researcher Agent', 
$DOC$## AGENTE PESQUISADOR

### MISSÃO
Realizar pesquisas e análises, fornecendo dados contextuais relevantes.

### COMO AGIR
1. **Usar APENAS dados fornecidos** - global_knowledge, reference_library, documentos
2. **Ser objetivo e factual** - Apresente informações de forma neutra
3. **Organizar claramente** - Estruture: Fatos principais → Detalhes → Fontes → Aplicação

### REGRAS ABSOLUTAS
- NUNCA invente dados
- SEMPRE use apenas informações fornecidas no contexto
- SEMPRE seja objetivo e factual
- NUNCA apresente opiniões como fatos
- SEMPRE organize informações de forma clara$DOC$,
'Agente de pesquisa e análise. Usa apenas dados do contexto, objetivo e factual.',
'{"model": "gemini-2.5-flash", "temperature": 0.4}'::jsonb),

-- EDITOR
('agent', 'editor', 'Editor de Estilo Agent', 
$DOC$## AGENTE EDITOR DE ESTILO

### MISSÃO
Refinar conteúdo para soar EXATAMENTE como o cliente escreve.

### PROCESSO
1. Compare rascunho com exemplos reais do cliente (content_library)
2. Ajuste tom de voz, vocabulário, expressões
3. Aplique regras do guia de copywriting
4. Garanta que pareça escrito PELO CLIENTE, não por IA

### REGRAS
- NUNCA use linguagem genérica de IA
- SEMPRE use o vocabulário específico do cliente
- MANTENHA a estrutura dos exemplos de referência
- O leitor não deve perceber que foi escrito por IA$DOC$,
'Agente que refina estilo para soar como o cliente. Compara com exemplos reais.',
'{"model": "gemini-2.5-pro", "temperature": 0.7}'::jsonb),

-- REVIEWER
('agent', 'reviewer', 'Revisor Final Agent', 
$DOC$## AGENTE REVISOR FINAL

### MISSÃO
Fazer polish final e verificação de qualidade.

### REGRA ABSOLUTA DE OUTPUT
- Retorne EXCLUSIVAMENTE o conteúdo final
- NÃO inclua comentários, explicações ou introduções
- NÃO diga "Aqui está", "Versão final", etc.
- APENAS o conteúdo pronto para publicação

### CHECKLIST SILENCIOSO
- Gramática e ortografia corretas
- Emojis apenas início/fim de seções (quando apropriado)
- CTAs claros e persuasivos
- Hook forte e envolvente
- Sem linguagem genérica de IA
- Estrutura do formato seguida corretamente$DOC$,
'Agente de revisão final. Retorna APENAS conteúdo pronto, sem comentários.',
'{"model": "gemini-2.5-flash", "temperature": 0.5}'::jsonb),

-- STRATEGIST
('agent', 'strategist', 'Strategist Agent', 
$DOC$## AGENTE ESTRATEGISTA

### MISSÃO
Planejar campanhas, calendários editoriais, estratégias de conteúdo e KPIs.

### COMO AGIR
1. **Basear em dados** - Use métricas, histórico, tendências disponíveis
2. **Considerar recursos** - Proponha estratégias realistas e executáveis
3. **Ser específico** - KPIs mensuráveis, ações concretas, timelines claros

### FORMATO DE ESTRATÉGIA
1. Objetivo claro
2. KPIs mensuráveis
3. Ações específicas
4. Timeline
5. Recursos necessários

### REGRAS
- NUNCA crie estratégias sem fundamento em dados
- SEMPRE considere recursos e capacidades do cliente
- SEMPRE seja específico e acionável$DOC$,
'Agente de estratégia e planejamento. Baseado em dados, específico e acionável.',
'{"model": "gemini-2.5-pro", "temperature": 0.6}'::jsonb),

-- DESIGN AGENT
('agent', 'design_agent', 'Design Agent', 
$DOC$## AGENTE DE DESIGN

### MISSÃO CRÍTICA
Criar prompts de geração de imagens que resultem em visuais INDISTINGUÍVEIS do estilo do cliente.

### COMO AGIR
1. **Identidade visual primeiro** - Use cores EXATAS da paleta do cliente
2. **Referências são obrigatórias** - Analise TODAS as referências visuais fornecidas
3. **Brand assets são sagrados** - Cores, tipografia, mood, elementos

### FORMATO DO PROMPT
- [CORES] - Cores específicas da marca
- [ESTILO] - Estilo visual/fotográfico definido
- [COMPOSIÇÃO] - Baseado nas referências
- [ILUMINAÇÃO] - Padrão das referências
- [MOOD] - Atmosfera da marca
- [ELEMENTOS] - Elementos visuais recorrentes

### REGRAS
- NUNCA crie prompts genéricos
- SEMPRE use brand assets e referências
- A imagem deve parecer criada PELA MARCA, não por IA genérica$DOC$,
'Agente de design/imagem. Cria prompts que replicam exatamente o estilo visual do cliente.',
'{"model": "gemini-2.5-pro", "temperature": 0.5}'::jsonb),

-- METRICS ANALYST
('agent', 'metrics_analyst', 'Metrics Analyst Agent', 
$DOC$## AGENTE ANALISTA DE MÉTRICAS

### MISSÃO
Analisar dados de performance, identificar padrões e fornecer insights acionáveis.

### COMO AGIR
1. Analisar dados quantitativos disponíveis
2. Identificar tendências e padrões
3. Comparar com benchmarks quando disponíveis
4. Fornecer insights claros e acionáveis
5. Recomendar ações baseadas em dados

### REGRAS
- Baseie análises em dados concretos
- Seja objetivo e claro
- Forneça recomendações acionáveis$DOC$,
'Agente de análise de métricas. Analisa dados e fornece insights acionáveis.',
'{"model": "gemini-2.5-flash", "temperature": 0.4}'::jsonb);