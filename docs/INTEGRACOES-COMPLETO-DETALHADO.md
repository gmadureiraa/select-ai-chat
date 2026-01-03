# 🔌 Integrações - Completo e Detalhado

**Objetivo:** Documentação completa de todas as integrações do sistema, incluindo OAuth, APIs, Edge Functions, Storage e automações.

---

## 🎯 VISÃO GERAL

O sistema kAI integra com múltiplas plataformas e serviços para:
- ✅ Coleta automática de métricas (YouTube, Instagram)
- ✅ Publicação de conteúdo (Twitter/X, LinkedIn)
- ✅ Processamento de dados (Edge Functions)
- ✅ Armazenamento de arquivos (Supabase Storage)
- ✅ Automações externas (N8N)

---

## 📺 INTEGRAÇÕES DE REDES SOCIAIS

### 🎥 YouTube OAuth 2.0

#### Objetivo:
Coleta automática de métricas do YouTube Analytics e YouTube Data API.

#### Fluxo de Autenticação:

**1. Início do OAuth:**
```
Frontend → Edge Function: youtube-oauth-start
- Envia: clientId
- Retorna: URL de autorização do Google
```

**2. Redirecionamento:**
```
Usuário → Google OAuth Consent Screen
- Permissões solicitadas:
  * youtube.readonly (YouTube Data API)
  * youtube.analytics.readonly (YouTube Analytics API)
```

**3. Callback:**
```
Google → Edge Function: youtube-oauth-callback
- Recebe: authorization code
- Troca por: access_token + refresh_token
- Armazena: client_youtube_connections table
```

**4. Refresh Token:**
```
Automático quando access_token expira
- Usa refresh_token para obter novo access_token
- Atualiza no banco automaticamente
```

#### Estrutura de Dados:

```sql
CREATE TABLE client_youtube_connections (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  channel_id TEXT,
  channel_title TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Funcionalidades:

- **Sincronização Manual:** Botão "Sincronizar" no dashboard
- **Coleta de Métricas:** `fetch-youtube-analytics` function
- **Dados Coletados:**
  - Visualizações
  - Horas assistidas
  - Inscritos ganhos/perdidos
  - Likes, comentários
  - CTR (Click-Through Rate)
  - Retenção de audiência

#### Edge Functions Relacionadas:

- `youtube-oauth-start` - Inicia fluxo OAuth
- `youtube-oauth-callback` - Processa callback
- `fetch-youtube-analytics` - Busca métricas
- `fetch-youtube-metrics` - Busca dados de vídeos
- `analyze-youtube-sentiment` - Análise de comentários

---

### 📸 Instagram OAuth

#### Objetivo:
Coleta automática de métricas do Instagram Graph API (Facebook).

#### Fluxo de Autenticação:

**1. Início do OAuth:**
```
Frontend → Edge Function: instagram-oauth-start
- Envia: clientId
- Retorna: URL de autorização do Facebook
```

**2. Redirecionamento:**
```
Usuário → Facebook OAuth Consent Screen
- Permissões solicitadas:
  * instagram_basic
  * instagram_manage_insights
  * pages_read_engagement
```

**3. Callback:**
```
Facebook → Edge Function: instagram-oauth-callback
- Recebe: authorization code
- Troca por: access_token (long-lived)
- Armazena: client_instagram_connections table
```

#### Estrutura de Dados:

```sql
CREATE TABLE client_instagram_connections (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  instagram_account_id TEXT,
  username TEXT,
  access_token TEXT,
  token_type TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Funcionalidades:

- **Sincronização Manual:** Botão "Sincronizar" no dashboard
- **Coleta de Métricas:** `fetch-instagram-oauth-metrics` function
- **Dados Coletados:**
  - Seguidores
  - Alcance
  - Impressões
  - Engajamentos
  - Cliques em perfil
  - Interações

#### Edge Functions Relacionadas:

- `instagram-oauth-start` - Inicia fluxo OAuth
- `instagram-oauth-callback` - Processa callback
- `fetch-instagram-oauth-metrics` - Busca métricas via OAuth
- `fetch-instagram-metrics` - Busca métricas (fallback CSV)
- `extract-instagram` - Extrai dados de posts

---

### 🐦 Twitter/X API

#### Objetivo:
Publicação de tweets e coleta de métricas (via API v2).

#### Método:
**Credenciais API (não OAuth para publicação)**

#### Estrutura de Dados:

```sql
CREATE TABLE client_social_credentials (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  platform TEXT NOT NULL, -- 'twitter'
  
  -- API v2 Credentials
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  access_token_secret TEXT,
  bearer_token TEXT,
  
  -- Metadados
  account_id TEXT,
  account_name TEXT,
  username TEXT,
  is_valid BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  validation_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Funcionalidades:

- **Validação de Credenciais:** `validate-social-credentials` function
- **Publicação:** `twitter-post` function
- **Métricas:** Coleta via CSV (API limitada)

#### Edge Functions Relacionadas:

- `twitter-post` - Publica tweet
- `validate-social-credentials` - Valida credenciais
- `scrape-social-metrics` - Coleta métricas (scraping)

---

### 💼 LinkedIn API

#### Objetivo:
Publicação de posts no LinkedIn.

#### Método:
**OAuth Access Token (manual)**

#### Estrutura de Dados:

```sql
-- Usa client_social_credentials com platform = 'linkedin'
-- Campos específicos:
oauth_access_token TEXT,
expires_at TIMESTAMPTZ,
account_id TEXT,
account_name TEXT
```

#### Funcionalidades:

- **Publicação:** `linkedin-post` function
- **Validação:** Valida token antes de publicar

#### Edge Functions Relacionadas:

- `linkedin-post` - Publica post no LinkedIn
- `validate-social-credentials` - Valida token

---

## 🔧 SUPABASE EDGE FUNCTIONS

### 📊 Categorização Completa

#### 🤖 Agentes e IA (11 functions)

**Geração de Conteúdo:**
- `chat` - Chat principal com Gemini
- `chat-multi-agent` - Pipeline multi-agente
- `execute-agent` - Executa agente específico
- `orchestrator` - Orquestra múltiplos agentes
- `generate-ideas-pipeline` - Gera ideias de conteúdo
- `generate-content-from-idea` - Gera conteúdo de ideia

**Análise e Processamento:**
- `analyze-research` - Analisa pesquisas
- `analyze-style` - Analisa estilo de escrita
- `analyze-youtube-sentiment` - Análise de sentimentos (YouTube)
- `analyze-client-onboarding` - Analisa onboarding do cliente
- `extract-branding` - Extrai branding de conteúdo

#### 📊 Métricas e Analytics (10 functions)

**Coleta de Métricas:**
- `fetch-youtube-analytics` - Métricas YouTube (OAuth)
- `fetch-youtube-metrics` - Dados de vídeos YouTube
- `fetch-instagram-oauth-metrics` - Métricas Instagram (OAuth)
- `fetch-instagram-metrics` - Métricas Instagram (fallback)
- `fetch-beehiiv-metrics` - Métricas Beehiiv (Newsletter)
- `scrape-social-metrics` - Scraping de métricas sociais
- `fetch-notion-metrics` - Métricas Notion (futuro)

**Processamento:**
- `collect-daily-metrics` - Coleta diária automática
- `weekly-metrics-update` - Atualização semanal
- `generate-performance-insights` - Gera insights de performance
- `update-client-metrics` - Atualiza métricas do cliente

#### 📤 Importação e Extração (8 functions)

**Extração de Conteúdo:**
- `extract-instagram` - Extrai dados Instagram
- `extract-youtube` - Extrai dados YouTube
- `extract-knowledge` - Extrai conhecimento de documentos
- `extract-pdf` - Extrai texto de PDFs
- `extract-docx` - Extrai texto de DOCX

**Importação:**
- `import-beehiiv-newsletters` - Importa newsletters Beehiiv
- `scrape-newsletter` - Scraping de newsletters
- `validate-csv-import` - Valida importação CSV

#### 🔍 Pesquisa e Scraping (4 functions)

- `scrape-website` - Scraping de websites
- `scrape-research-link` - Scraping de links de pesquisa
- `grok-search` - Busca via Grok (X/Twitter)
- `reverse-engineer` - Reverse engineering de conteúdo

#### 🎨 Mídia e Processamento (4 functions)

- `generate-image` - Gera imagens (DALL-E, Stable Diffusion)
- `transcribe-images` - Transcreve texto de imagens (OCR)
- `transcribe-video` - Transcreve vídeos (audio → texto)
- `transcribe-audio` - Transcreve áudio

#### 🔐 Autenticação OAuth (4 functions)

- `youtube-oauth-start` - Inicia OAuth YouTube
- `youtube-oauth-callback` - Callback YouTube OAuth
- `instagram-oauth-start` - Inicia OAuth Instagram
- `instagram-oauth-callback` - Callback Instagram OAuth

#### 📝 Publicação e Automação (5 functions)

- `twitter-post` - Publica no Twitter/X
- `linkedin-post` - Publica no LinkedIn
- `process-scheduled-posts` - Processa posts agendados
- `run-automation` - Executa automação
- `execute-workflow` - Executa workflow

#### 🔍 Conhecimento e Base (3 functions)

- `process-knowledge` - Processa e indexa conhecimento
- `search-knowledge` - Busca semântica na base de conhecimento

#### 💳 Pagamentos e Assinaturas (4 functions)

- `create-checkout` - Cria sessão de checkout (Stripe)
- `check-subscription` - Verifica status de assinatura
- `customer-portal` - Portal do cliente (Stripe)
- (Billing relacionado)

#### 🔗 Integrações Externas (1 function)

- `n8n-api` - Integração com N8N (automações externas)

---

## 📦 SUPABASE STORAGE

### 🗂️ Buckets e Estrutura

#### Buckets Principais:

**1. `client-assets`**
- **Propósito:** Assets gerais dos clientes
- **Público:** Não (privado)
- **Uso:** Logos, imagens de marca, documentos
- **Estrutura:** `{client_id}/{tipo}/{arquivo}`

**2. `content-media`**
- **Propósito:** Mídia de conteúdo criado
- **Público:** Sim (para preview)
- **Uso:** Imagens geradas, thumbnails, vídeos
- **Estrutura:** `{client_id}/content/{content_id}/{arquivo}`

**3. `references`**
- **Propósito:** Referências visuais
- **Público:** Não (privado)
- **Uso:** Imagens de referência para criação
- **Estrutura:** `{client_id}/references/{categoria}/{arquivo}`

**4. `avatars`**
- **Propósito:** Avatares de usuários
- **Público:** Sim
- **Uso:** Fotos de perfil dos usuários
- **Estrutura:** `{user_id}/{arquivo}`

#### Políticas RLS (Row Level Security):

- ✅ Usuários só acessam arquivos de seus clientes
- ✅ Validação de `client_id` em todas as operações
- ✅ Uploads verificam permissões de workspace

#### Funções de Ajuda:

```typescript
// src/lib/storage.ts
- uploadFile(bucket, path, file)
- deleteFile(bucket, path)
- getPublicUrl(bucket, path)
- listFiles(bucket, prefix)
```

---

## 🤖 APIS EXTERNAS

### 🧠 Google Gemini API

#### Uso:
- **Geração de conteúdo** (agents)
- **Análise de texto**
- **Busca semântica** (embeddings)

#### Configuração:
- **Variável:** `GEMINI_API_KEY`
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta`
- **Modelos:** `gemini-2.5-flash`, `gemini-2.5-pro`

#### Rate Limits:
- Requests por minuto: Variável por modelo
- Tokens por request: Limitado por modelo
- Custo: Por token (input/output)

#### Edge Functions que usam:
- `chat`
- `chat-multi-agent`
- `execute-agent`
- `orchestrator`
- `process-knowledge`
- `search-knowledge`
- (praticamente todas que geram conteúdo)

---

### 💳 Stripe API

#### Uso:
- **Pagamentos** (checkout)
- **Assinaturas** (recorrente)
- **Portal do cliente**

#### Configuração:
- **Variáveis:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- **Endpoint:** `https://api.stripe.com/v1`
- **Webhooks:** Configurados no Supabase

#### Edge Functions:
- `create-checkout`
- `check-subscription`
- `customer-portal`

---

### 🔗 N8N Integration

#### Objetivo:
Automações externas e workflows customizados.

#### Método:
- **Edge Function:** `n8n-api`
- **Comunicação:** HTTP requests
- **Autenticação:** API key

#### Casos de Uso:
- Workflows customizados
- Integrações específicas do cliente
- Automações avançadas

---

## 🔄 WEBHOOKS E AUTOMAÇÕES

### Webhooks Recebidos:

**Stripe Webhooks:**
- `checkout.session.completed` - Checkout concluído
- `customer.subscription.updated` - Assinatura atualizada
- `customer.subscription.deleted` - Assinatura cancelada

**Processamento:**
- Atualiza status de assinatura no banco
- Ajusta permissões do usuário
- Envia notificações

---

## 📋 FLUXOS COMPLETOS

### Fluxo 1: Conectar YouTube e Coletar Métricas

```
1. Usuário clica "Conectar YouTube"
2. Frontend chama: youtube-oauth-start
3. Usuário autoriza no Google
4. Google redireciona para: youtube-oauth-callback
5. Callback salva tokens no banco
6. Usuário clica "Sincronizar"
7. Frontend chama: fetch-youtube-analytics
8. Function busca métricas da API
9. Dados salvos em: platform_metrics
10. Dashboard atualiza com novos dados
```

### Fluxo 2: Publicar Tweet

```
1. Usuário cria conteúdo no sistema
2. Usuário seleciona "Publicar no Twitter"
3. Frontend valida credenciais: validate-social-credentials
4. Frontend chama: twitter-post
5. Function autentica com Twitter API
6. Function publica tweet
7. Retorna: tweet_id e métricas iniciais
8. Frontend salva referência no banco
```

### Fluxo 3: Processar Conhecimento

```
1. Usuário faz upload de documento
2. Documento salvo em: client-assets bucket
3. Frontend chama: extract-knowledge
4. Function extrai texto do documento
5. Function chama: process-knowledge
6. Process-knowledge:
   - Divide em chunks
   - Gera embeddings (Gemini)
   - Indexa no vector store
7. Conhecimento disponível para busca semântica
```

---

## 🔒 SEGURANÇA E AUTENTICAÇÃO

### Tokens e Credenciais:

**Armazenamento:**
- ✅ Tokens OAuth: Criptografados no banco
- ✅ API Keys: Nunca expostas no frontend
- ✅ Secrets: Apenas em Edge Functions (variáveis de ambiente)

**Validação:**
- ✅ RLS (Row Level Security) em todas as tabelas
- ✅ JWT verification em Edge Functions
- ✅ Validação de `client_id` em todas as operações

**Refresh Tokens:**
- ✅ Refresh automático quando tokens expiram
- ✅ Rotação de tokens quando necessário
- ✅ Logs de erros de autenticação

---

## 📊 MONITORAMENTO E LOGS

### Métricas de Integração:

- Taxa de sucesso de OAuth
- Tempo de resposta das APIs
- Erros de autenticação
- Uso de quotas (Gemini, APIs)

### Logs:

- Todas as Edge Functions logam erros
- Falhas de autenticação são logadas
- Timeouts e rate limits são registrados

---

## ✅ CHECKLIST DE INTEGRAÇÃO

### Para Adicionar Nova Integração:

- [ ] Criar Edge Function (se necessário)
- [ ] Configurar variáveis de ambiente
- [ ] Criar/atualizar tabela no banco (se necessário)
- [ ] Implementar RLS policies
- [ ] Criar interface no frontend
- [ ] Testar fluxo completo
- [ ] Documentar no código
- [ ] Adicionar tratamento de erros
- [ ] Implementar refresh de tokens (se OAuth)
- [ ] Adicionar validação de credenciais

---

## 📚 DOCUMENTAÇÃO TÉCNICA

### Endpoints Principais:

**OAuth:**
- `POST /functions/v1/youtube-oauth-start`
- `GET /functions/v1/youtube-oauth-callback`
- `POST /functions/v1/instagram-oauth-start`
- `GET /functions/v1/instagram-oauth-callback`

**Publicação:**
- `POST /functions/v1/twitter-post`
- `POST /functions/v1/linkedin-post`

**Métricas:**
- `POST /functions/v1/fetch-youtube-analytics`
- `POST /functions/v1/fetch-instagram-oauth-metrics`

---

**Nota:** Este documento serve como referência completa para todas as integrações do sistema, incluindo fluxos, estruturas de dados e funções relacionadas.

