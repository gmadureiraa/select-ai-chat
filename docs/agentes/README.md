# 🤖 Documentação dos Agentes de IA

Este diretório contém documentação completa sobre como cada agente especializado deve agir no sistema.

---

## 📋 Agentes Disponíveis

### Agentes Especializados Principais:

1. **[CONTENT_WRITER.md](./CONTENT_WRITER.md)** - Agente principal de criação de conteúdo textual
2. **[DESIGN_AGENT.md](./DESIGN_AGENT.md)** - Agente crítico para geração de imagens
3. **[RESEARCHER.md](./RESEARCHER.md)** - Agente de pesquisa e análise
4. **[STRATEGIST.md](./STRATEGIST.md)** - Agente de estratégia e planejamento
5. **[EMAIL_DEVELOPER.md](./EMAIL_DEVELOPER.md)** - Agente de desenvolvimento de templates HTML
6. **[METRICS_ANALYST.md](./METRICS_ANALYST.md)** - Agente de análise de métricas e performance

---

## 🎯 Como Cada Agente Funciona

Cada documento de agente contém:

- ✅ **Missão** - Objetivo principal do agente
- ✅ **Capacidades** - O que o agente pode fazer
- ✅ **Como Deve Agir** - Diretrizes específicas de comportamento
- ✅ **Contexto Necessário** - Dados que o agente precisa
- ✅ **Fluxo de Trabalho** - Processo passo a passo
- ✅ **Regras Absolutas** - O que SEMPRE e NUNCA fazer
- ✅ **Métricas de Qualidade** - Como medir se está fazendo bem
- ✅ **Casos de Uso** - Exemplos práticos

---

## 📚 Integração com Documentação de Formatos

Os agentes trabalham em conjunto com a documentação de formatos em `../formatos/`:

### Content Writer + Formatos:

O **Content Writer** deve **SEMPRE** consultar a documentação de formato quando criar conteúdo específico:

- `NEWSLETTER.md` → Para newsletters
- `TWEET.md` → Para tweets
- `THREAD.md` → Para threads
- `LINKEDIN_POST.md` → Para posts LinkedIn
- `CARROSSEL.md` → Para carrosséis
- `POST_INSTAGRAM.md` → Para posts Instagram
- `BLOG_POST.md` → Para blog posts
- `REELS_SHORT_VIDEO.md` → Para roteiros de Reels
- `LONG_VIDEO_YOUTUBE.md` → Para roteiros de vídeo longo
- `ARTIGO_X.md` → Para artigos no X
- `STORIES.md` → Para stories
- `EMAIL_MARKETING.md` → Para emails promocionais

**Fluxo:**
1. Content Writer identifica formato solicitado
2. Consulta documento de formato em `docs/formatos/`
3. Segue estrutura e regras definidas no documento
4. Combina com tom de voz e estilo do cliente
5. Entrega conteúdo finalizado

### Design Agent + Brand Assets:

O **Design Agent** deve **SEMPRE** usar Brand Assets e Visual References para criar prompts que resultem em imagens indistinguíveis do estilo do cliente.

---

## 🔄 Fluxo de Trabalho Geral

### 1. Orquestração

O sistema identifica qual agente deve ser usado baseado na requisição do usuário.

### 2. Execução do Agente

Cada agente:
- Carrega contexto necessário (brand assets, content library, etc)
- Consulta documentação relevante (formatos, guias, etc)
- Executa sua função específica
- Valida qualidade da entrega

### 3. Entrega

O agente entrega resultado finalizado e pronto para uso.

---

## ⚠️ Regras Gerais para Todos os Agentes

1. **SEMPRE** use o contexto do cliente (identity guide, brand assets, content library)
2. **NUNCA** invente ou fabrique informações
3. **SEMPRE** consulte documentação relevante quando disponível
4. **NUNCA** comprometa qualidade por velocidade
5. **SEMPRE** entregue conteúdo finalizado e polido
6. **NUNCA** ignore diretrizes e regras estabelecidas

---

## 📊 Hierarquia de Informação

Quando houver conflito ou múltiplas fontes de informação:

1. **Diretrizes do Cliente** (identity guide, brand assets) - PRIORIDADE MÁXIMA
2. **Documentação de Formatos** (`docs/formatos/`) - Estrutura técnica
3. **Global Knowledge (global_knowledge)** - Melhores práticas, insights estratégicos e informações técnicas
4. **Dados e Métricas** - Informações verificáveis

### Como Usar Global Knowledge:

A **base de conhecimento global** (`global_knowledge`) é fornecida automaticamente no contexto quando disponível. Os agentes devem:

- ✅ **Consultar sempre** quando disponível no contexto
- ✅ **Integrar insights relevantes** no conteúdo que está sendo criado
- ✅ **Adaptar ao tom e estilo do cliente** (nunca usar texto genérico da knowledge base diretamente)
- ✅ **Enriquecer conteúdo** com melhores práticas, tendências e informações estratégicas
- ✅ **Usar como fonte de conhecimento técnico**, mas escrever com personalidade do cliente

**Exemplo:**
- Knowledge base tem: "Newsletters devem ter CTAs claros"
- Cliente tem tom conversacional e amigável
- Agente integra: "E aí, que tal experimentar isso? [CTA claro mas no tom do cliente]"

---

## 🎯 Objetivo Final

Todos os agentes trabalham juntos para criar conteúdo de **alta qualidade** que:

- ✅ Segue rigorosamente a identidade do cliente
- ✅ Respeita estrutura e regras dos formatos
- ✅ Está pronto para publicar (sem edição adicional)
- ✅ Mantém consistência com conteúdo existente
- ✅ Entrega valor e resultados para o cliente

---

**Última atualização:** 31 de Dezembro de 2024
