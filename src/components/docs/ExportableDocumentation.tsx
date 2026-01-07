import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FULL_DOCUMENTATION = `# kAI - Documentação Técnica Completa
## Plataforma de Inteligência Artificial para Criação de Conteúdo
### Versão 0.1 | Dezembro 2025

---

# SUMÁRIO

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Assistente Multi-Agente](#assistente-multi-agente)
4. [Sistema de Planejamento](#sistema-de-planejamento)
5. [Performance Analytics](#performance-analytics)
6. [Biblioteca de Conteúdo](#biblioteca-de-conteúdo)
7. [Base de Conhecimento](#base-de-conhecimento)
8. [Gestão de Clientes](#gestão-de-clientes)
9. [Sistema de Workspaces](#sistema-de-workspaces)
10. [Edge Functions](#edge-functions)
11. [Banco de Dados](#banco-de-dados)
12. [Integrações Sociais](#integrações-sociais)
13. [Segurança e RLS](#segurança-e-rls)
14. [Fluxos de Dados](#fluxos-de-dados)

---

# 1. VISÃO GERAL

## 1.1 O que é o kAI?

O kAI é uma plataforma completa de inteligência artificial para criação e gestão de conteúdo digital. Desenvolvido pela Kaleidos, combina:

- **Geração de Conteúdo por IA**: Pipeline multi-agente com 11 especialistas
- **Analytics Unificado**: Métricas de Instagram, YouTube, Twitter, Newsletter e TikTok
- **Planejamento Editorial**: Kanban e Calendário sincronizados
- **Biblioteca Inteligente**: Conteúdo e referências com busca semântica
- **Publicação Automatizada**: Agendamento e posting automático

## 1.2 Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Estilização | Tailwind CSS + Radix UI |
| Estado | React Query (TanStack) |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| IA | Gemini 2.5 Flash/Pro, GPT-5 via Lovable AI |
| Realtime | Supabase Realtime + SSE |
| Storage | Supabase Storage (buckets públicos) |

## 1.3 Principais Rotas

| Rota | Descrição |
|------|-----------|
| \`/kai\` | Interface principal unificada |
| \`/kai/docs\` | Documentação |
| \`/knowledge-base\` | Base de conhecimento global |
| \`/settings\` | Configurações do workspace |

---

# 2. ARQUITETURA DO SISTEMA

## 2.1 Estrutura de Pastas

\`\`\`
src/
├── components/
│   ├── chat/           # Componentes do assistente
│   ├── kai/            # Interface principal unificada
│   ├── planning/       # Kanban e Calendário
│   ├── performance/    # Dashboards de analytics
│   ├── clients/        # Gestão de clientes
│   ├── research/       # Canvas de pesquisa
│   └── ui/             # Componentes Shadcn
├── hooks/              # Custom hooks (50+ hooks)
├── pages/              # Páginas principais
├── contexts/           # WorkspaceContext
├── types/              # TypeScript types
└── lib/                # Utilitários

supabase/
├── functions/          # 48 Edge Functions
│   ├── chat-multi-agent/   # Pipeline principal
│   ├── orchestrator/       # Orquestrador de agentes
│   ├── generate-image/     # Geração de imagens
│   └── ...
└── migrations/         # Migrações SQL
\`\`\`

## 2.2 Fluxo de Dados Principal

\`\`\`
[Usuário] 
    ↓ (input)
[Frontend React]
    ↓ (fetch/mutation)
[React Query]
    ↓ (request)
[Supabase Client]
    ↓ (HTTP/WebSocket)
[Edge Functions / PostgreSQL]
    ↓ (response/SSE)
[UI Update]
\`\`\`

## 2.3 Contexto de Workspace

O sistema usa \`WorkspaceContext\` para:
- Isolar dados por workspace
- Gerenciar permissões (Owner, Admin, Member, Viewer)
- Controlar acesso a clientes específicos

\`\`\`typescript
const { workspace, clients, currentClient, setCurrentClient } = useWorkspace();
\`\`\`

---

# 3. ASSISTENTE MULTI-AGENTE

## 3.1 Arquitetura do Pipeline

O assistente usa um pipeline de 4 agentes em sequência:

\`\`\`
[Input do Usuário]
       ↓
┌──────────────────┐
│   PESQUISADOR    │  → Analisa contexto, busca na biblioteca
│   (Researcher)   │     e knowledge base
└────────┬─────────┘
         ↓
┌──────────────────┐
│    ESCRITOR      │  → Aplica regras do formato específico
│    (Writer)      │     (carrossel, newsletter, etc.)
└────────┬─────────┘
         ↓
┌──────────────────┐
│     EDITOR       │  → Refina tom, estilo e voz do cliente
│    (Editor)      │
└────────┬─────────┘
         ↓
┌──────────────────┐
│    REVISOR       │  → Verificação final de qualidade
│   (Reviewer)     │
└────────┬─────────┘
         ↓
[Output Final]
\`\`\`

## 3.2 Os 11 Agentes Especializados

Cada tipo de conteúdo tem um agente com regras específicas:

| Agente | Formato | Regras Principais |
|--------|---------|-------------------|
| \`newsletter_agent\` | Newsletter | Assunto 60 chars, preview 90 chars, corpo com H2/H3, CTA final |
| \`email_marketing_agent\` | Email Marketing | Copy de vendas, urgência, múltiplos CTAs |
| \`carousel_agent\` | Carrossel Instagram | 10 slides, gancho forte, legenda com hashtags |
| \`static_post_agent\` | Post Estático | Imagem única, mensagem impactante |
| \`reels_agent\` | Reels/Shorts | Roteiro 15-60s, hook em 2s |
| \`long_video_agent\` | Vídeo Longo | Roteiro YouTube, capítulos, 8-20min |
| \`tweet_agent\` | Tweet | 280 chars, take quente |
| \`thread_agent\` | Thread | 5-15 tweets numerados |
| \`linkedin_agent\` | LinkedIn | Storytelling profissional |
| \`article_agent\` | Artigo | 1500-3000 palavras estruturadas |
| \`blog_agent\` | Blog Post | SEO otimizado, meta description |

## 3.3 Contexto Injetado nos Agentes

Cada agente recebe automaticamente:

\`\`\`typescript
{
  // Identidade do cliente
  clientIdentity: client.identity_guide,
  
  // Brand assets
  brandAssets: {
    logo_url: "...",
    color_palette: { primary, secondary, accent },
    typography: { primary_font, secondary_font },
    visual_style: { mood, photography_style }
  },
  
  // Exemplos da biblioteca (3 mais similares)
  structureExamples: [
    { title: "Carrossel sobre X", content: "..." },
    { title: "Carrossel sobre Y", content: "..." }
  ],
  
  // Base de conhecimento relevante
  knowledgeContext: [...],
  
  // Regras do template (se houver)
  templateRules: { ... },
  
  // Métricas de performance (opcional)
  performanceContext: { topPosts, engagementRate }
}
\`\`\`

## 3.4 Streaming SSE

Respostas são enviadas em tempo real via Server-Sent Events:

\`\`\`typescript
// Edge function envia chunks
encoder.encode(\`data: \${JSON.stringify({
  type: 'chunk',
  content: textChunk,
  tokens: { input: 100, output: 50, cost: 0.001 }
})}\n\n\`)

// Frontend processa
const eventSource = new EventSource(url);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setResponse(prev => prev + data.content);
  setTokens(data.tokens);
};
\`\`\`

## 3.5 Sugestões Contextuais Inteligentes

Hook \`useSmartSuggestions\` analisa dados do cliente e gera sugestões personalizadas:

\`\`\`typescript
// Exemplo de sugestões geradas
[
  "📸 Criar carrossel sobre [tema do melhor post]",
  "🚨 Último conteúdo há 7 dias - criar urgente",
  "📊 Analisar por que engajamento caiu 15%",
  "📥 Importar dados do YouTube (sem dados)"
]
\`\`\`

## 3.6 Consumo de Tokens em Tempo Real

O \`AdvancedProgress\` exibe durante a geração:
- Tokens consumidos por agente
- Custo estimado (USD)
- Progresso visual do pipeline
- Tempo decorrido

---

# 4. SISTEMA DE PLANEJAMENTO

## 4.1 Arquitetura Unificada

Kanban e Calendário usam a mesma tabela \`planning_items\`:

\`\`\`sql
CREATE TABLE planning_items (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  client_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,           -- Conteúdo rich text
  content_type TEXT,      -- carousel, reels, newsletter, etc.
  platform TEXT,          -- instagram, twitter, linkedin, etc.
  status TEXT DEFAULT 'draft',
  due_date TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  media_urls JSONB,
  labels JSONB,
  metadata JSONB,
  position INT,
  column_id UUID,
  assigned_to UUID,
  created_by UUID NOT NULL
);
\`\`\`

## 4.2 Status de Publicação

| Status | Descrição | Badge |
|--------|-----------|-------|
| \`draft\` | Rascunho | Cinza |
| \`scheduled\` | Agendado | Azul |
| \`publishing\` | Publicando | Amarelo pulsante |
| \`published\` | Publicado | Verde |
| \`failed\` | Falhou | Vermelho |

## 4.3 Editor Rich Content

\`RichContentEditor\` suporta:
- Markdown (negrito, itálico, listas)
- Upload de imagens inline
- Preview em tempo real
- Contador de caracteres

## 4.4 Thread Editor

Para Twitter/X, editor especializado:
- Múltiplos tweets numerados
- Limite de 280 chars por tweet
- Preview visual da thread
- Sugestões de onde quebrar

## 4.5 Publicação Automática

Fluxo de agendamento:

\`\`\`
[Usuário agenda post]
       ↓
[scheduled_at é definido]
       ↓
[Cron job (process-scheduled-posts)]
       ↓ (a cada 5 minutos)
[Verifica posts com scheduled_at <= now()]
       ↓
[Busca credenciais do cliente]
       ↓
[Chama API da plataforma]
       ↓
[Atualiza status para published/failed]
\`\`\`

---

# 5. PERFORMANCE ANALYTICS

## 5.1 Plataformas Suportadas

| Plataforma | Métricas | Fonte de Dados |
|------------|----------|----------------|
| Instagram | Alcance, Impressões, Engajamento, Salvos | CSV export |
| YouTube | Views, Watch Time, Subscribers, CTR | OAuth + CSV |
| Twitter/X | Impressões, Engajamento, Retweets | CSV export |
| Newsletter | Open Rate, Click Rate, Subscribers | Beehiiv API + CSV |
| TikTok | Views, Likes, Shares, Comments | CSV export |

## 5.2 Tabelas de Métricas

\`\`\`sql
-- Métricas diárias agregadas por plataforma
CREATE TABLE platform_metrics (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  platform TEXT NOT NULL,        -- instagram, youtube, twitter, newsletter
  metric_date DATE NOT NULL,
  views INT,
  likes INT,
  comments INT,
  shares INT,
  subscribers INT,
  engagement_rate DECIMAL,
  open_rate DECIMAL,             -- newsletter
  click_rate DECIMAL,            -- newsletter
  metadata JSONB
);

-- Posts individuais do Instagram
CREATE TABLE instagram_posts (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  post_id TEXT,
  caption TEXT,
  post_type TEXT,                -- image, carousel, reel
  posted_at TIMESTAMPTZ,
  likes INT,
  comments INT,
  saves INT,
  shares INT,
  reach INT,
  impressions INT,
  engagement_rate DECIMAL,
  thumbnail_url TEXT
);

-- Vídeos do YouTube
CREATE TABLE youtube_videos (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  video_id TEXT UNIQUE,
  title TEXT,
  published_at TIMESTAMPTZ,
  views INT,
  likes INT,
  comments INT,
  watch_time_minutes INT,
  average_view_duration INT,
  thumbnail_url TEXT
);
\`\`\`

## 5.3 Importação Inteligente de CSV

O sistema detecta automaticamente o tipo de arquivo:

\`\`\`typescript
// useSmartInstagramImport.ts
const detectFileType = (headers: string[]) => {
  if (headers.includes('Impressions') && headers.includes('Reach')) {
    return 'daily_metrics';
  }
  if (headers.includes('Post ID') || headers.includes('Permalink')) {
    return 'posts';
  }
  return 'unknown';
};
\`\`\`

## 5.4 Insights Automáticos por IA

Após importação, \`generate-performance-insights\` analisa:

\`\`\`typescript
// Prompt para análise
"Analise as métricas de {platform} do cliente {name}:
- Identifique padrões de engajamento
- Encontre melhores horários para postar
- Compare tipos de conteúdo
- Sugira melhorias estratégicas

Dados: {metricsJSON}"
\`\`\`

Insights são cacheados por 24h em \`metadata.cached_insights\`.

## 5.5 Metas e Objetivos

\`\`\`sql
CREATE TABLE performance_goals (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  platform TEXT NOT NULL,
  metric_name TEXT NOT NULL,     -- followers, engagement_rate, views
  target_value DECIMAL NOT NULL,
  current_value DECIMAL,
  period TEXT,                   -- weekly, monthly, quarterly
  start_date DATE,
  end_date DATE,
  status TEXT                    -- on_track, at_risk, achieved
);
\`\`\`

---

# 6. BIBLIOTECA DE CONTEÚDO

## 6.1 Content Library

Armazena todo conteúdo produzido para referência:

\`\`\`sql
CREATE TABLE client_content_library (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type content_type NOT NULL,  -- ENUM: newsletter, carousel, tweet, etc.
  content_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB                        -- slides, engagement_data, etc.
);
\`\`\`

Tipos de conteúdo suportados:
- Newsletter, Email Marketing
- Carrossel, Post Estático, Reels
- Tweet, Thread
- LinkedIn Post, Artigo, Blog
- Roteiro de Vídeo

## 6.2 Reference Library

Materiais externos de inspiração:

\`\`\`sql
CREATE TABLE client_reference_library (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  reference_type TEXT,           -- external_example, competitor, trend
  source_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB                 -- { scraped_url, pdf_url, image_urls }
);
\`\`\`

## 6.3 Importação de Carrossel Instagram

\`extract-instagram\` edge function:
1. Recebe URL do post
2. Faz scraping das imagens
3. Extrai texto via OCR (transcribe-images)
4. Salva na content_library

## 6.4 Uso pela IA

O pipeline busca automaticamente:
- 3 exemplos mais recentes do mesmo content_type
- Extrai padrões de estrutura
- Injeta como \`structureExamples\` no contexto

---

# 7. BASE DE CONHECIMENTO

## 7.1 Estrutura

Conhecimento global (não específico de cliente):

\`\`\`sql
CREATE TABLE global_knowledge (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category knowledge_category,    -- framework, technique, reference, research
  source_url TEXT,
  source_file TEXT,
  summary TEXT,                   -- Gerado por IA
  key_takeaways JSONB,            -- ["insight1", "insight2", ...]
  tags TEXT[],
  embedding VECTOR(768),          -- Para busca semântica
  metadata JSONB
);
\`\`\`

## 7.2 Tipos de Entrada

| Tipo | Processamento |
|------|---------------|
| URL | scrape-research-link → extrai conteúdo |
| PDF | extract-pdf → OCR + extração de texto |
| Imagem | transcribe-images → Gemini Vision |
| Texto | Salvo diretamente |

## 7.3 Busca Semântica

\`\`\`sql
-- Função de busca por similaridade
CREATE FUNCTION search_knowledge_semantic(
  query_embedding VECTOR(768),
  workspace_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  similarity FLOAT
)
AS $$
  SELECT id, title, content,
         1 - (embedding <=> query_embedding) as similarity
  FROM global_knowledge
  WHERE workspace_id = $2
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE sql;
\`\`\`

## 7.4 Processamento Automático

\`process-knowledge\` edge function:
1. Gera embedding do conteúdo
2. Cria summary via IA
3. Extrai key_takeaways
4. Salva tudo na tabela

---

# 8. GESTÃO DE CLIENTES

## 8.1 Estrutura do Cliente

\`\`\`sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  
  -- Identidade (CRÍTICO para IA)
  identity_guide TEXT,           -- Tom de voz, valores, posicionamento
  
  -- Brand Assets
  brand_assets JSONB,            -- { logo_url, color_palette, typography, visual_style }
  
  -- Redes Sociais
  social_media JSONB,            -- { instagram, youtube, twitter, linkedin, tiktok }
  
  -- Metadados
  tags JSONB,
  context_notes TEXT,
  function_templates JSONB       -- Templates customizados
);
\`\`\`

## 8.2 Hierarquia de Contexto

Prioridade na geração de conteúdo:

1. **identity_guide** → Tom de voz, valores fundamentais
2. **Arquivos em public/clients/{name}/** → Guias detalhados
3. **content_library** → Exemplos reais
4. **reference_library** → Inspirações externas
5. **template.rules** → Regras específicas do template

## 8.3 Templates

\`\`\`sql
CREATE TABLE client_templates (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT,                     -- newsletter, carousel, tweet, etc.
  rules JSONB,                   -- Regras customizadas pelo usuário
  clickup_list_id TEXT           -- Integração ClickUp (opcional)
);
\`\`\`

## 8.4 Documentos do Cliente

\`\`\`sql
CREATE TABLE client_documents (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,       -- Path no Storage
  file_type TEXT,                -- pdf, docx, pptx
  extracted_content TEXT         -- Texto extraído
);
\`\`\`

## 8.5 Websites do Cliente

\`\`\`sql
CREATE TABLE client_websites (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  url TEXT NOT NULL,
  scraped_content TEXT,          -- Texto extraído
  scraped_markdown TEXT,         -- Versão em Markdown
  last_scraped_at TIMESTAMPTZ
);
\`\`\`

---

# 9. SISTEMA DE WORKSPACES

## 9.1 Estrutura

\`\`\`sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  plan_type plan_type DEFAULT 'free',
  token_balance INT DEFAULT 10000,
  settings JSONB,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT
);

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,            -- owner, admin, member, viewer
  status TEXT DEFAULT 'pending', -- pending, active
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ
);

-- Controle granular de acesso a clientes
CREATE TABLE workspace_member_clients (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL,       -- FK workspace_members
  client_id UUID NOT NULL        -- FK clients
);
\`\`\`

## 9.2 Permissões

| Role | Clientes | Configurações | Billing | Membros |
|------|----------|---------------|---------|---------|
| Owner | Todos | ✅ | ✅ | ✅ |
| Admin | Todos | ✅ | ❌ | ✅ |
| Member | Específicos | ❌ | ❌ | ❌ |
| Viewer | Específicos (read-only) | ❌ | ❌ | ❌ |

## 9.3 Tokens e Billing

\`\`\`sql
CREATE TABLE token_transactions (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID,
  amount INT NOT NULL,           -- Positivo = crédito, Negativo = débito
  balance_after INT NOT NULL,
  type token_transaction_type,   -- usage, purchase, bonus, refund
  description TEXT,
  metadata JSONB                 -- { edge_function, model, tokens_used }
);
\`\`\`

---

# 10. EDGE FUNCTIONS

## 10.1 Lista Completa (48 funções)

### Assistente e IA
| Função | Descrição |
|--------|-----------|
| \`chat\` | Chat simples com contexto |
| \`chat-multi-agent\` | Pipeline multi-agente completo |
| \`orchestrator\` | Orquestrador de agentes |
| \`execute-agent\` | Executa agente específico |
| \`generate-image\` | Geração de imagens com brand assets |
| \`analyze-style\` | Analisa estilo de escrita |
| \`reverse-engineer\` | Engenharia reversa de conteúdo |

### Extração e Processamento
| Função | Descrição |
|--------|-----------|
| \`extract-pdf\` | Extrai texto de PDFs |
| \`extract-docx\` | Extrai texto de Word |
| \`extract-instagram\` | Scraping de posts Instagram |
| \`extract-youtube\` | Extrai dados de vídeos YouTube |
| \`extract-branding\` | Extrai brand assets de website |
| \`extract-knowledge\` | Processa conhecimento |
| \`transcribe-audio\` | Transcrição de áudio |
| \`transcribe-video\` | Transcrição de vídeo |
| \`transcribe-images\` | OCR de imagens |

### Scraping
| Função | Descrição |
|--------|-----------|
| \`scrape-website\` | Scraping de websites |
| \`scrape-newsletter\` | Scraping de newsletters |
| \`scrape-research-link\` | Scraping para knowledge base |
| \`scrape-social-metrics\` | Scraping de métricas sociais |

### Performance
| Função | Descrição |
|--------|-----------|
| \`generate-performance-insights\` | Insights por IA |
| \`validate-csv-import\` | Validação de CSV |
| \`collect-daily-metrics\` | Coleta métricas diárias |
| \`weekly-metrics-update\` | Atualização semanal |
| \`fetch-instagram-metrics\` | Busca métricas Instagram |
| \`fetch-youtube-metrics\` | Busca métricas YouTube |
| \`fetch-youtube-analytics\` | Analytics detalhado YouTube |
| \`fetch-beehiiv-metrics\` | Busca métricas Beehiiv |
| \`fetch-notion-metrics\` | Busca métricas Notion |
| \`analyze-youtube-sentiment\` | Análise de sentimento |
| \`update-client-metrics\` | Atualiza métricas do cliente |

### Publicação Social
| Função | Descrição |
|--------|-----------|
| \`twitter-post\` | Publica no Twitter/X |
| \`linkedin-post\` | Publica no LinkedIn |
| \`process-scheduled-posts\` | Processa posts agendados |
| \`validate-social-credentials\` | Valida credenciais |

### YouTube OAuth
| Função | Descrição |
|--------|-----------|
| \`youtube-oauth-start\` | Inicia fluxo OAuth |
| \`youtube-oauth-callback\` | Callback do OAuth |

### Pesquisa
| Função | Descrição |
|--------|-----------|
| \`analyze-research\` | Analisa itens de pesquisa |
| \`grok-search\` | Busca via Grok/xAI |
| \`search-knowledge\` | Busca semântica |
| \`process-knowledge\` | Processa conhecimento |

### Automação
| Função | Descrição |
|--------|-----------|
| \`run-automation\` | Executa automação |
| \`import-beehiiv-newsletters\` | Importa newsletters |

### Billing
| Função | Descrição |
|--------|-----------|
| \`check-subscription\` | Verifica assinatura |
| \`create-checkout\` | Cria checkout Stripe |
| \`customer-portal\` | Portal do cliente Stripe |

## 10.2 Estrutura Padrão de Edge Function

\`\`\`typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await req.json();
    
    // ... lógica da função

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
\`\`\`

---

# 11. BANCO DE DADOS

## 11.1 Tabelas Principais

| Tabela | Registros Estimados | Descrição |
|--------|---------------------|-----------|
| \`workspaces\` | ~100 | Workspaces ativos |
| \`workspace_members\` | ~500 | Membros de workspaces |
| \`clients\` | ~1000 | Clientes cadastrados |
| \`client_content_library\` | ~50000 | Conteúdos produzidos |
| \`client_reference_library\` | ~10000 | Referências externas |
| \`planning_items\` | ~20000 | Items de planejamento |
| \`instagram_posts\` | ~100000 | Posts do Instagram |
| \`platform_metrics\` | ~500000 | Métricas diárias |
| \`conversations\` | ~10000 | Conversas do chat |
| \`messages\` | ~500000 | Mensagens do chat |
| \`global_knowledge\` | ~5000 | Base de conhecimento |
| \`ai_agents\` | ~100 | Agentes customizados |

## 11.2 ENUMs

\`\`\`sql
CREATE TYPE content_type AS ENUM (
  'newsletter', 'email_marketing', 'carousel', 'static_post',
  'reels', 'long_video', 'tweet', 'thread', 'linkedin',
  'article', 'blog', 'roteiro', 'outro'
);

CREATE TYPE knowledge_category AS ENUM (
  'framework', 'technique', 'reference', 'research'
);

CREATE TYPE plan_type AS ENUM (
  'free', 'starter', 'pro', 'enterprise'
);

CREATE TYPE token_transaction_type AS ENUM (
  'usage', 'purchase', 'bonus', 'refund'
);

CREATE TYPE activity_type AS ENUM (
  'content_created', 'client_added', 'template_created',
  'import_completed', 'automation_run', 'login'
);

CREATE TYPE share_permission AS ENUM (
  'view', 'comment', 'edit'
);
\`\`\`

## 11.3 Índices Importantes

\`\`\`sql
CREATE INDEX idx_content_library_client ON client_content_library(client_id);
CREATE INDEX idx_content_library_type ON client_content_library(content_type);
CREATE INDEX idx_instagram_posts_client ON instagram_posts(client_id);
CREATE INDEX idx_instagram_posts_date ON instagram_posts(posted_at);
CREATE INDEX idx_platform_metrics_client_date ON platform_metrics(client_id, metric_date);
CREATE INDEX idx_planning_items_workspace ON planning_items(workspace_id);
CREATE INDEX idx_planning_items_status ON planning_items(status);
CREATE INDEX idx_global_knowledge_embedding ON global_knowledge USING ivfflat (embedding vector_cosine_ops);
\`\`\`

---

# 12. INTEGRAÇÕES SOCIAIS

## 12.1 Credenciais Armazenadas

\`\`\`sql
CREATE TABLE client_social_credentials (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  platform TEXT NOT NULL,        -- twitter, linkedin, instagram
  
  -- OAuth tokens
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  
  -- API keys (para algumas plataformas)
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  access_token_secret TEXT,
  
  -- Metadados
  account_id TEXT,
  account_name TEXT,
  is_valid BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  validation_error TEXT
);
\`\`\`

## 12.2 Fluxo de Publicação

### Twitter/X
\`\`\`typescript
// twitter-post edge function
const client = new TwitterApi({
  appKey: credentials.api_key,
  appSecret: credentials.api_secret,
  accessToken: credentials.access_token,
  accessSecret: credentials.access_token_secret,
});

// Post simples
await client.v2.tweet(content);

// Thread
for (const tweet of threadTweets) {
  const result = await client.v2.tweet(tweet, { reply: { in_reply_to_tweet_id: lastTweetId } });
  lastTweetId = result.data.id;
}

// Com mídia
const mediaId = await client.v1.uploadMedia(imageBuffer);
await client.v2.tweet(content, { media: { media_ids: [mediaId] } });
\`\`\`

### LinkedIn
\`\`\`typescript
// linkedin-post edge function
const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${accessToken}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    author: \`urn:li:person:\${authorId}\`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  })
});
\`\`\`

## 12.3 Validação de Credenciais

\`validate-social-credentials\` verifica periodicamente:
- Token ainda válido
- Permissões suficientes
- Conta não suspensa

---

# 13. SEGURANÇA E RLS

## 13.1 Políticas RLS por Tabela

### Clients
\`\`\`sql
CREATE POLICY "Users can view clients in their workspace"
  ON clients FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
\`\`\`

### Planning Items
\`\`\`sql
CREATE POLICY "Users can manage planning items in their workspace"
  ON planning_items FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
\`\`\`

### Content Library (com controle granular)
\`\`\`sql
CREATE POLICY "Members can access allowed clients content"
  ON client_content_library FOR SELECT
  USING (
    client_id IN (
      SELECT wmc.client_id
      FROM workspace_member_clients wmc
      JOIN workspace_members wm ON wm.id = wmc.member_id
      WHERE wm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN clients c ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND c.id = client_id
    )
  );
\`\`\`

## 13.2 Credenciais Sensíveis

⚠️ **Nota**: Credenciais sociais são armazenadas em texto plano. Recomenda-se:
- Usar Supabase Vault para encriptação
- Ou migrar para OAuth puro onde possível

## 13.3 Validações

- Todos os inputs são validados com Zod
- Rate limiting em edge functions
- Sanitização de HTML em conteúdo rich text

---

# 14. FLUXOS DE DADOS

## 14.1 Fluxo de Geração de Conteúdo

\`\`\`
[Usuário digita prompt]
       ↓
[Frontend detecta tipo de conteúdo]
       ↓
[Chama chat-multi-agent com clientId + templateId]
       ↓
[Edge Function busca contexto automaticamente]
  ├── client (identity_guide, brand_assets)
  ├── content_library (3 exemplos)
  ├── reference_library
  ├── client_documents
  ├── client_websites
  ├── template.rules
  └── global_knowledge (se relevante)
       ↓
[Monta prompt com contexto]
       ↓
[Executa pipeline: Researcher → Writer → Editor → Reviewer]
       ↓
[Cada agente envia chunks via SSE]
       ↓
[Frontend exibe em tempo real]
       ↓
[Salva resposta em messages]
       ↓
[Debita tokens do workspace]
\`\`\`

## 14.2 Fluxo de Importação de Métricas

\`\`\`
[Usuário faz upload de CSV]
       ↓
[Frontend detecta tipo (SmartCSVUpload)]
       ↓
[Parse e validação client-side]
       ↓
[CSVValidationAgent exibe warnings]
       ↓
[Usuário confirma importação]
       ↓
[Insere dados na tabela correta]
       ↓
[Chama generate-performance-insights]
       ↓
[IA analisa dados e gera insights]
       ↓
[Insights salvos em metadata.cached_insights]
       ↓
[UI atualiza com novo dashboard]
\`\`\`

## 14.3 Fluxo de Publicação Agendada

\`\`\`
[Usuário cria item no Kanban/Calendário]
       ↓
[Define scheduled_at e platform]
       ↓
[Salva em planning_items com status 'scheduled']
       ↓
[Cron job (a cada 5 min) executa process-scheduled-posts]
       ↓
[Busca items com scheduled_at <= now() AND status = 'scheduled']
       ↓
[Para cada item:]
  ├── Atualiza status para 'publishing'
  ├── Busca credenciais do cliente
  ├── Chama API da plataforma (twitter-post, linkedin-post)
  ├── Se sucesso: status = 'published', published_at = now()
  └── Se erro: status = 'failed', error_message = erro
       ↓
[UI atualiza via Realtime]
\`\`\`

---

# APÊNDICE A: HOOKS PRINCIPAIS

| Hook | Descrição |
|------|-----------|
| \`useWorkspace\` | Contexto do workspace atual |
| \`useClients\` | CRUD de clientes |
| \`useClientChat\` | Chat com contexto do cliente |
| \`usePlanningItems\` | Gestão de planning items |
| \`useContentLibrary\` | Biblioteca de conteúdo |
| \`useReferenceLibrary\` | Biblioteca de referências |
| \`usePerformanceMetrics\` | Métricas de performance |
| \`useInstagramPosts\` | Posts do Instagram |
| \`useYouTubeMetrics\` | Métricas do YouTube |
| \`useSmartSuggestions\` | Sugestões contextuais |
| \`useGlobalKnowledge\` | Base de conhecimento |
| \`useOrchestrator\` | Orquestrador de agentes |
| \`useWorkflowExecution\` | Execução de workflows |
| \`useTokens\` | Consumo de tokens |
| \`useTeamMembers\` | Gestão de equipe |

---

# APÊNDICE B: COMPONENTES PRINCIPAIS

| Componente | Localização | Descrição |
|------------|-------------|-----------|
| \`KaiAssistantTab\` | \`kai/\` | Interface principal do chat |
| \`AdvancedProgress\` | \`chat/\` | Progresso do pipeline |
| \`EnhancedMessageBubble\` | \`chat/\` | Mensagem com ações |
| \`QuickSuggestions\` | \`chat/\` | Sugestões rápidas |
| \`PlanningBoard\` | \`planning/\` | Container Kanban/Calendário |
| \`KanbanView\` | \`planning/\` | Visualização Kanban |
| \`CalendarView\` | \`planning/\` | Visualização Calendário |
| \`RichContentEditor\` | \`planning/\` | Editor Markdown |
| \`PerformanceOverview\` | \`performance/\` | Dashboard geral |
| \`InstagramDashboard\` | \`performance/\` | Dashboard Instagram |
| \`ClientList\` | \`clients/\` | Lista de clientes |
| \`ClientEditDialog\` | \`clients/\` | Edição de cliente |
| \`KnowledgeBaseTool\` | \`kai/tools/\` | Ferramenta knowledge base |

---

# APÊNDICE C: VARIÁVEIS DE AMBIENTE

| Variável | Descrição |
|----------|-----------|
| \`SUPABASE_URL\` | URL do projeto Supabase |
| \`SUPABASE_ANON_KEY\` | Chave pública |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Chave de serviço (backend) |
| \`LOVABLE_AI_URL\` | URL do Lovable AI |
| \`LOVABLE_AI_KEY\` | Chave do Lovable AI |

---

# CONCLUSÃO

O kAI é uma plataforma robusta e modular para criação de conteúdo por IA. Os principais diferenciais são:

1. **Pipeline Multi-Agente**: Qualidade superior via especialização
2. **Contexto Rico**: IA com acesso completo à identidade do cliente
3. **Transparência**: Usuário vê tudo que está acontecendo
4. **Unificação**: Uma interface para tudo
5. **Extensibilidade**: Agent Builder para workflows customizados

Para melhorias futuras, considerar:
- Sistema de feedback para outputs
- Memory bank por cliente
- Variações A/B/C de conteúdo
- Biblioteca de estruturas salvas
- Templates de prompt customizáveis

---

*Documentação gerada em ${new Date().toISOString().split('T')[0]}*
*Versão do Sistema: 0.1*
*Total de Edge Functions: 48*
*Total de Hooks: 50+*
*Total de Componentes: 100+*
`;

export const ExportableDocumentation = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    
    try {
      // Create blob with markdown content
      const blob = new Blob([FULL_DOCUMENTATION], { type: 'text/markdown;charset=utf-8' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kAI-Documentacao-Completa-${new Date().toISOString().split('T')[0]}.md`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      toast.success("Documentação exportada com sucesso!");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Erro ao exportar documentação");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-6 rounded-xl bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-amber-500/10 border border-violet-500/20">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-violet-500/20">
          <FileText className="h-6 w-6 text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Documentação Técnica Completa</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Arquivo Markdown com toda a arquitetura do sistema, incluindo: 
            pipeline multi-agente, 48 edge functions, estrutura do banco de dados, 
            fluxos de dados, hooks, componentes e mais.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs">14 seções</span>
            <span className="px-2 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs">~3000 linhas</span>
            <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs">Markdown</span>
          </div>
          <Button 
            onClick={handleDownload} 
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloading ? "Exportando..." : "Baixar Documentação (.md)"}
          </Button>
        </div>
      </div>
    </div>
  );
};
