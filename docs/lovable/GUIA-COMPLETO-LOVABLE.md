# 📘 Guia Completo para Lovable - Sistema de Agentes e Formatos

**Data:** 31 de Dezembro de 2024  
**Objetivo:** Organizar e atualizar o sistema de assistente, agentes e formatos

---

## 🎯 ÍNDICE

1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Documentos Essenciais que DEVEM Estar Certos](#documentos-essenciais-que-devem-estar-certos)
3. [Estrutura de Agentes](#estrutura-de-agentes)
4. [Estrutura de Formatos](#estrutura-de-formatos)
5. [Integração com APIs (Gemini e Outras)](#integração-com-apis-gemini-e-outras)
6. [Fluxo Completo do Sistema](#fluxo-completo-do-sistema)
7. [Mudanças de Interface Sugeridas](#mudanças-de-interface-sugeridas)
8. [Checklist de Implementação](#checklist-de-implementação)

---

## 🎯 VISÃO GERAL DO SISTEMA

### O Que É Este Sistema:

Um **sistema de assistente de IA** que cria conteúdo de alta qualidade usando:
- **6 Agentes Especializados** (content_writer, design_agent, researcher, etc)
- **11 Agentes Específicos de Conteúdo** (newsletter_agent, tweet_agent, etc)
- **12 Formatos de Conteúdo** documentados (Newsletter, Tweet, Thread, etc)
- **API Gemini** (atualmente) com suporte para outras APIs

### Arquitetura:

```
Usuário → Assistente → Orquestrador → Agente Específico → API (Gemini) → Conteúdo Finalizado
```

---

## 📋 DOCUMENTOS ESSENCIAIS QUE DEVEM ESTAR CERTOS

### ⚠️ CRÍTICO: Estes documentos DEVEM estar atualizados e corretos

### 1. Documentação de Agentes (`docs/agentes/`)

**Localização:** `docs/agentes/`

**Documentos Obrigatórios:**
- ✅ `README.md` - Índice e visão geral
- ✅ `CONTENT_WRITER.md` - Agente principal (MAIS IMPORTANTE)
- ✅ `DESIGN_AGENT.md` - Geração de imagens
- ✅ `RESEARCHER.md` - Pesquisa e análise
- ✅ `STRATEGIST.md` - Estratégia e planejamento
- ✅ `EMAIL_DEVELOPER.md` - Templates HTML
- ✅ `METRICS_ANALYST.md` - Análise de métricas

**O Que Cada Documento Deve Conter:**
- ✅ Missão do agente
- ✅ Capacidades
- ✅ Como deve agir (diretrizes específicas)
- ✅ Contexto necessário
- ✅ Fluxo de trabalho
- ✅ Regras absolutas (SEMPRE/NUNCA)
- ✅ Métricas de qualidade
- ✅ Casos de uso

**Status Atual:** ✅ Todos os 6 agentes estão documentados

---

### 2. Documentação de Formatos (`docs/formatos/`)

**Localização:** `docs/formatos/`

**Documentos Obrigatórios (12 formatos):**
- ✅ `NEWSLETTER.md` - Newsletters
- ✅ `TWEET.md` - Tweets
- ✅ `THREAD.md` - Threads no Twitter/X
- ✅ `LINKEDIN_POST.md` - Posts LinkedIn
- ✅ `CARROSSEL.md` - Carrosséis Instagram/LinkedIn
- ✅ `POST_INSTAGRAM.md` - Posts estáticos Instagram
- ✅ `BLOG_POST.md` - Blog posts
- ✅ `REELS_SHORT_VIDEO.md` - Roteiros de Reels/Shorts
- ✅ `LONG_VIDEO_YOUTUBE.md` - Roteiros de vídeo longo
- ✅ `ARTIGO_X.md` - Artigos no X
- ✅ `STORIES.md` - Stories Instagram
- ✅ `EMAIL_MARKETING.md` - Emails promocionais

**O Que Cada Documento Deve Conter:**
- ✅ Estrutura obrigatória (elementos que DEVEM estar presentes)
- ✅ Regras de ouro (o que SEMPRE fazer, o que NUNCA fazer)
- ✅ Boas práticas da plataforma
- ✅ Formato de entrega (como estruturar o conteúdo)
- ✅ Checklist obrigatório (validação antes de entregar)
- ✅ Erros comuns a evitar

**Status Atual:** ✅ Todos os 12 formatos estão documentados

---

### 3. Regras e Guias (`docs/estrutura/regras-guias/`)

**Localização:** `docs/estrutura/regras-guias/`

**Documentos Obrigatórios:**
- ✅ `REGRAS-GERAIS-AGENTES.md` - Regras fundamentais para TODOS os agentes
- ✅ `REGRAS-VALIDACAO-CONTEUDO.md` - Checklist obrigatório de validação
- ✅ `GUIA-USO-KNOWLEDGE-BASE.md` - Como usar base de conhecimento

**Status Atual:** ✅ Todos os 3 documentos estão criados

---

### 4. Código dos Agentes (`supabase/functions/execute-agent/index.ts`)

**Localização:** `supabase/functions/execute-agent/index.ts`

**O Que Deve Estar Certo:**
- ✅ System prompts de todos os 11 agentes específicos
- ✅ Mapeamento agente ↔ formato
- ✅ Configuração de modelos (Gemini)
- ✅ Integração com documentação de formatos

**Status Atual:** ✅ Código existe e está funcional

---

## 🤖 ESTRUTURA DE AGENTES

### Tipos de Agentes:

#### 1. Agentes Especializados (6):

Estes são os agentes principais documentados em `docs/agentes/`:

| Agente | Arquivo | Função Principal |
|--------|---------|-----------------|
| `content_writer` | `CONTENT_WRITER.md` | Criação de conteúdo textual |
| `design_agent` | `DESIGN_AGENT.md` | Geração de imagens |
| `researcher` | `RESEARCHER.md` | Pesquisa e análise |
| `strategist` | `STRATEGIST.md` | Estratégia e planejamento |
| `email_developer` | `EMAIL_DEVELOPER.md` | Templates HTML |
| `metrics_analyst` | `METRICS_ANALYST.md` | Análise de métricas |

#### 2. Agentes Específicos de Conteúdo (11):

Estes são variações do `content_writer` otimizadas para formatos específicos:

| Agente no Código | Formato | Documentação |
|-----------------|---------|--------------|
| `newsletter_agent` | Newsletter | `docs/formatos/NEWSLETTER.md` |
| `email_marketing_agent` | Email Marketing | `docs/formatos/EMAIL_MARKETING.md` |
| `carousel_agent` | Carrossel | `docs/formatos/CARROSSEL.md` |
| `static_post_agent` | Post Instagram | `docs/formatos/POST_INSTAGRAM.md` |
| `reels_agent` | Reels/Shorts | `docs/formatos/REELS_SHORT_VIDEO.md` |
| `long_video_agent` | Vídeo Longo | `docs/formatos/LONG_VIDEO_YOUTUBE.md` |
| `tweet_agent` | Tweet | `docs/formatos/TWEET.md` |
| `thread_agent` | Thread | `docs/formatos/THREAD.md` |
| `linkedin_agent` | LinkedIn Post | `docs/formatos/LINKEDIN_POST.md` |
| `article_agent` | Artigo no X | `docs/formatos/ARTIGO_X.md` |
| `blog_agent` | Blog Post | `docs/formatos/BLOG_POST.md` |

**IMPORTANTE:** Os agentes específicos NÃO têm documentação individual. Eles:
- São configurados no código (`supabase/functions/execute-agent/index.ts`)
- Têm system prompts específicos
- Usam a documentação de formato correspondente
- São ativados automaticamente quando o formato é detectado

---

### Como Funciona a Detecção de Agente:

1. **Usuário solicita:** "Crie uma newsletter sobre X"
2. **Sistema detecta:** formato = newsletter
3. **Sistema ativa:** `newsletter_agent`
4. **Agente carrega:**
   - System prompt do `newsletter_agent` (do código)
   - Documentação `NEWSLETTER.md` (mais completa)
   - Contexto do cliente (identity_guide, content_library)
5. **Agente cria conteúdo** combinando tudo
6. **Entrega** conteúdo finalizado

---

## 📚 ESTRUTURA DE FORMATOS

### Formatos Disponíveis (12):

Todos os formatos estão documentados em `docs/formatos/`:

1. **NEWSLETTER.md** - Estrutura completa para newsletters
2. **TWEET.md** - Guia para tweets virais
3. **THREAD.md** - Estrutura de threads no Twitter/X
4. **LINKEDIN_POST.md** - Posts profissionais no LinkedIn
5. **CARROSSEL.md** - Carrosséis Instagram/LinkedIn
6. **POST_INSTAGRAM.md** - Posts estáticos Instagram
7. **BLOG_POST.md** - Blog posts otimizados para SEO
8. **REELS_SHORT_VIDEO.md** - Roteiros de Reels/Shorts
9. **LONG_VIDEO_YOUTUBE.md** - Roteiros de vídeo longo
10. **ARTIGO_X.md** - Artigos no X (Twitter)
11. **STORIES.md** - Stories Instagram
12. **EMAIL_MARKETING.md** - Emails promocionais

### Como os Agentes Usam os Formatos:

**Fluxo:**
1. Agente identifica formato solicitado
2. Carrega documento de formato (`docs/formatos/[FORMATO].md`)
3. Segue estrutura obrigatória definida
4. Aplica regras de ouro
5. Combina com tom de voz do cliente
6. Valida usando checklist
7. Entrega conteúdo finalizado

**Hierarquia de Informação:**
1. **Diretrizes do Cliente** (identity_guide, brand_assets) - PRIORIDADE MÁXIMA
2. **Documentação de Formatos** (`docs/formatos/`) - Estrutura técnica
3. **Global Knowledge** (global_knowledge) - Melhores práticas
4. **Dados e Métricas** - Informações verificáveis

---

## 🔌 INTEGRAÇÃO COM APIS (GEMINI E OUTRAS)

### API Atual: Google Gemini

**Configuração:**
- **Variável de Ambiente:** `GOOGLE_AI_STUDIO_API_KEY`
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Método:** POST

**Modelos Suportados:**
- `gemini-2.5-flash` - Rápido e econômico (padrão)
- `gemini-2.5-pro` - Mais poderoso, mais caro
- `gemini-2.5-flash-lite` - Mais econômico
- `gemini-3-pro-preview` - Preview (gratuito)

**Formato da Requisição:**

```typescript
const requestBody = {
  contents: [
    {
      role: "user",
      parts: [{ text: userPrompt }]
    }
  ],
  systemInstruction: {
    parts: [{ text: systemPrompt }]
  },
  generationConfig: {
    temperature: 0.8,
    maxOutputTokens: 8192
  }
};

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  }
);
```

**Resposta:**

```typescript
{
  candidates: [{
    content: {
      parts: [{ text: "conteúdo gerado" }]
    }
  }],
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 50
  }
}
```

---

### Suporte para Outras APIs

**Arquitetura Atual:**
- ✅ Apenas Gemini implementado
- ⚠️ Código não está preparado para múltiplas APIs

**Como Adicionar Suporte para Outras APIs:**

#### 1. Criar Abstração de Provider

**Arquivo:** `supabase/functions/_shared/ai-provider.ts`

```typescript
interface AIProvider {
  name: string;
  call(
    systemPrompt: string,
    userPrompt: string,
    model: string,
    temperature: number
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }>;
}

class GeminiProvider implements AIProvider {
  name = "google";
  
  async call(systemPrompt, userPrompt, model, temperature) {
    // Implementação atual do Gemini
  }
}

class OpenAIProvider implements AIProvider {
  name = "openai";
  
  async call(systemPrompt, userPrompt, model, temperature) {
    // Implementação OpenAI
  }
}

class AnthropicProvider implements AIProvider {
  name = "anthropic";
  
  async call(systemPrompt, userPrompt, model, temperature) {
    // Implementação Anthropic
  }
}
```

#### 2. Factory Pattern

```typescript
function getAIProvider(provider: string): AIProvider {
  switch (provider) {
    case "google":
      return new GeminiProvider();
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    default:
      return new GeminiProvider(); // Fallback
  }
}
```

#### 3. Configuração por Agente

**Arquivo:** `supabase/functions/execute-agent/index.ts`

```typescript
interface AgentConfig {
  systemPrompt: string;
  model: string;
  provider: "google" | "openai" | "anthropic"; // NOVO
  temperature: number;
  requiredData?: string[];
}
```

#### 4. Variáveis de Ambiente

```env
# Google Gemini
GOOGLE_AI_STUDIO_API_KEY=xxx

# OpenAI (opcional)
OPENAI_API_KEY=xxx

# Anthropic (opcional)
ANTHROPIC_API_KEY=xxx
```

---

### Preços e Custos

**Arquivo:** `supabase/functions/_shared/ai-usage.ts`

**Modelos Gemini (por 1M tokens):**
- `gemini-2.5-flash`: Input $0.15, Output $0.60
- `gemini-2.5-pro`: Input $1.25, Output $5.00
- `gemini-2.5-flash-lite`: Input $0.075, Output $0.30

**Outros Modelos (adicionar quando implementar):**
- OpenAI GPT-4o: Input $2.50, Output $10.00
- Anthropic Claude: Input $3.00, Output $15.00

**Logging:**
- Todos os usos são logados em `ai_usage_logs` table
- Custo estimado calculado automaticamente
- Provider identificado automaticamente

---

## 🔄 FLUXO COMPLETO DO SISTEMA

### Fluxo de Criação de Conteúdo:

```
1. USUÁRIO SOLICITA
   "Crie uma newsletter sobre lançamento do produto X"
   ↓
2. ORQUESTRADOR (orchestrator/index.ts)
   - Analisa requisição
   - Identifica formato: newsletter
   - Decide qual agente usar: newsletter_agent
   ↓
3. EXECUTE AGENT (execute-agent/index.ts)
   - Carrega configuração do newsletter_agent
   - Busca contexto do cliente:
     * identity_guide
     * content_library
     * brand_assets
     * global_knowledge
   - Carrega documentação: docs/formatos/NEWSLETTER.md
   ↓
4. CONSTRUÇÃO DO PROMPT
   - System prompt do newsletter_agent (código)
   - Documentação NEWSLETTER.md (completa)
   - Contexto do cliente
   - Requisição do usuário
   ↓
5. CHAMADA API (Gemini)
   - Endpoint: generateContent
   - Model: gemini-2.5-pro
   - Temperature: 0.8
   ↓
6. RESPOSTA
   - Conteúdo gerado
   - Tokens usados
   - Custo estimado
   ↓
7. VALIDAÇÃO
   - Checklist do formato
   - Consistência com cliente
   - Qualidade
   ↓
8. ENTREGA
   - Conteúdo finalizado
   - Pronto para publicar
```

---

### Fluxo de Geração de Imagem:

```
1. USUÁRIO SOLICITA
   "Gere uma imagem para este post"
   ↓
2. DESIGN AGENT (generate-image/index.ts)
   - Carrega brand_assets
   - Carrega visual_references
   - Analisa estilo do cliente
   ↓
3. CRIAÇÃO DO PROMPT
   - System prompt do design_agent
   - Brand assets formatados
   - Visual references
   - Requisição do usuário
   ↓
4. CHAMADA API (Gemini Image Generation)
   - Model: gemini-2.5-flash-preview-image-generation
   - Prompt otimizado
   ↓
5. RESPOSTA
   - Imagem gerada (base64 ou URL)
   - Tokens usados
   ↓
6. ENTREGA
   - Imagem finalizada
   - Pronta para uso
```

---

## 🎨 MUDANÇAS DE INTERFACE SUGERIDAS

### 1. Remover Modos de Chat da Interface ⭐ ALTA PRIORIDADE

**Problema Atual:**
- Modos de chat não existem mais na interface
- `ModeSelector` ainda pode estar no código

**Solução:**
- ✅ Remover `ModeSelector` da interface
- ✅ Manter apenas no backend
- ✅ Usar `@` mentions para mudar comportamento
- ✅ Exemplo: "@criativo", "@formal", "@casual"

**Arquivos a Modificar:**
- `src/components/chat/ModeSelector.tsx` - Remover ou ocultar
- `src/components/chat/FloatingInput.tsx` - Adicionar suporte a `@` mentions
- `src/hooks/useClientChat.ts` - Processar `@` mentions

---

### 2. Integração Natural: Criar → Planejar ⭐ ALTA PRIORIDADE

**Problema Atual:**
- Criar conteúdo e planejar estão separados
- Fluxo não é natural

**Solução:**
- ✅ Ao criar conteúdo no assistente, permitir "Editar conteúdo"
- ✅ Abrir bloco de texto editável (igual ao "Adicionar ao planejamento")
- ✅ Permitir editar e subir direto para planejamento
- ✅ Permitir programar diretamente

**Arquivos a Modificar:**
- `src/components/chat/MessageContent.tsx` - Adicionar botão "Editar"
- `src/components/planning/PlanningItemDialog.tsx` - Integrar com criação
- `src/hooks/useClientChat.ts` - Adicionar função de edição

---

### 3. Melhorar Feedback Visual

**Sugestões:**
- ✅ Adicionar loading states mais claros
- ✅ Mostrar qual agente está trabalhando
- ✅ Mostrar progresso (ex: "Gerando conteúdo...", "Validando...")
- ✅ Melhorar mensagens de erro

**Arquivos a Modificar:**
- `src/components/chat/MessageContent.tsx` - Adicionar estados de loading
- `src/hooks/useClientChat.ts` - Adicionar eventos de progresso

---

### 4. Mostrar Qual Formato Está Sendo Usado

**Sugestão:**
- ✅ Mostrar badge com formato detectado
- ✅ Exemplo: "📧 Newsletter" quando detectar newsletter
- ✅ Permitir mudar formato manualmente

**Arquivos a Modificar:**
- `src/components/chat/FloatingInput.tsx` - Adicionar badge de formato
- `src/hooks/useClientChat.ts` - Detectar e mostrar formato

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Verificar Documentação

- [ ] Verificar que todos os 6 agentes estão documentados em `docs/agentes/`
- [ ] Verificar que todos os 12 formatos estão documentados em `docs/formatos/`
- [ ] Verificar que regras e guias estão em `docs/estrutura/regras-guias/`
- [ ] Verificar que READMEs estão atualizados

### Fase 2: Verificar Código

- [ ] Verificar `supabase/functions/execute-agent/index.ts` tem todos os 11 agentes específicos
- [ ] Verificar system prompts estão alinhados com documentação
- [ ] Verificar mapeamento agente ↔ formato está correto
- [ ] Verificar integração com Gemini API está funcionando

### Fase 3: Atualizar Agentes (se necessário)

- [ ] Ler documentação de cada agente em `docs/agentes/`
- [ ] Comparar com system prompts no código
- [ ] Atualizar system prompts se necessário
- [ ] Garantir que agentes consultam documentação de formatos

### Fase 4: Adicionar Formatos (se necessário)

- [ ] Verificar se novo formato precisa ser adicionado
- [ ] Criar documento em `docs/formatos/[NOVO_FORMATO].md`
- [ ] Adicionar agente específico em `execute-agent/index.ts`
- [ ] Adicionar mapeamento agente ↔ formato

### Fase 5: Melhorar Interface (opcional)

- [ ] Remover `ModeSelector` da interface
- [ ] Adicionar suporte a `@` mentions
- [ ] Adicionar botão "Editar" após criar conteúdo
- [ ] Adicionar badge de formato detectado
- [ ] Melhorar feedback visual

### Fase 6: Adicionar Suporte para Outras APIs (opcional)

- [ ] Criar abstração de provider (`ai-provider.ts`)
- [ ] Implementar OpenAI provider
- [ ] Implementar Anthropic provider
- [ ] Adicionar configuração por agente
- [ ] Adicionar variáveis de ambiente
- [ ] Atualizar logging de custos

---

## 📊 RESUMO EXECUTIVO

### O Que Está Pronto:

✅ **Documentação Completa:**
- 6 agentes especializados documentados
- 12 formatos documentados
- 3 documentos de regras e guias

✅ **Código Funcional:**
- 11 agentes específicos implementados
- Integração com Gemini API
- Sistema de orquestração funcionando

✅ **Estrutura Clara:**
- Hierarquia de informação definida
- Fluxo de trabalho documentado
- Regras e validações estabelecidas

### O Que Pode Ser Melhorado:

⚠️ **Interface:**
- Remover modos de chat
- Adicionar `@` mentions
- Integrar criar → planejar

⚠️ **APIs:**
- Adicionar suporte para outras APIs (OpenAI, Anthropic)
- Criar abstração de provider

---

## 🎯 CONCLUSÃO

**O sistema está COMPLETO e FUNCIONAL.**

**Documentação:** ✅ 100% completa  
**Código:** ✅ Funcional  
**APIs:** ✅ Gemini integrado  

**Próximos Passos:**
1. Verificar que documentação está alinhada com código
2. Atualizar system prompts se necessário
3. Melhorar interface (opcional)
4. Adicionar suporte para outras APIs (opcional)

---

**Última atualização:** 31 de Dezembro de 2024

