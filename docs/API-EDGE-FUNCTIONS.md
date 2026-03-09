# API Edge Functions — Documentação

Este documento descreve as Edge Functions disponíveis no sistema Kaleidos.

---

## 📋 Índice

1. [Chat & IA](#chat--ia)
2. [Geração de Conteúdo](#geração-de-conteúdo)
3. [Agentes Especializados](#agentes-especializados)
4. [Análise & Insights](#análise--insights)
5. [Imagens](#imagens)
6. [Integrações Sociais](#integrações-sociais)
7. [Publicação (Late API)](#publicação-late-api)
8. [Métricas](#métricas)
9. [Extração de Dados](#extração-de-dados)
10. [Knowledge Base](#knowledge-base)
11. [Automações & Scheduling](#automações--scheduling)
12. [Notificações](#notificações)
13. [Pagamentos](#pagamentos)
14. [Utilitários](#utilitários)

---

## Chat & IA

### `kai-simple-chat`
Endpoint principal do kAI Chat. Detecção de intenção, geração de conteúdo, métricas e planejamento.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "clientId": "uuid",
  "model": "gemini-2.5-flash",
  "conversationId": "uuid (opcional)",
  "mode": "chat|content|ideas|performance (opcional)",
  "quality": "fast|high (opcional)"
}
```
**Resposta:** Stream de texto (SSE)

---

### `chat`
Endpoint legado de chat (mantido para compatibilidade).

**Método:** POST  
**Autenticação:** Bearer Token

---

### `chat-about-material`
Chat contextualizado sobre material específico (documento, artigo, vídeo).

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "materialContent": "conteúdo do material",
  "materialTitle": "título",
  "clientId": "uuid"
}
```

---

## Agentes Especializados

### `kai-content-agent`
Agente de geração de conteúdo. Aplica pipeline Writer → Validate → Repair → Review.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "brief": "briefing do conteúdo",
  "clientId": "uuid",
  "format": "tweet|thread|carousel|linkedin|newsletter|blog_post",
  "references": ["ids de materiais (opcional)"]
}
```

### `kai-planning-agent`
Agente de planejamento editorial. Cria e organiza cards no Kanban.

**Método:** POST  
**Autenticação:** Bearer Token

### `kai-metrics-agent`
Agente de análise de métricas. Interpreta dados de performance.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Geração de Conteúdo

### `unified-content-api`
Pipeline unificado de geração: Writer → Validate → Repair → Review.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "brief": "briefing",
  "clientId": "uuid",
  "formatType": "tweet|thread|carousel|linkedin|...",
  "formatRuleId": "uuid (opcional)",
  "references": []
}
```

### `generate-content-from-idea`
Gera conteúdo a partir de uma ideia (Canvas ou Library).

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "ideaId": "uuid",
  "clientId": "uuid",
  "formatRuleId": "uuid (opcional)"
}
```

### `generate-content-v2`
Versão 2 do gerador de conteúdo.

**Método:** POST  
**Autenticação:** Bearer Token

### `generate-content-learnings`
Gera learnings a partir de conteúdos de alta performance.

**Método:** POST  
**Autenticação:** Bearer Token

### `generate-voice-profile`
Gera Voice Profile do cliente a partir de amostras de conteúdo.

**Método:** POST  
**Autenticação:** Bearer Token

### `generate-client-context`
Gera contexto consolidado do cliente para uso em prompts.

**Método:** POST  
**Autenticação:** Bearer Token

### `reverse-engineer`
Analisa conteúdo existente e extrai estrutura/estilo/padrões.

**Método:** POST  
**Autenticação:** Bearer Token

### `research-newsletter-topic`
Pesquisa e gera conteúdo para newsletters com dados atualizados.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Análise & Insights

### `analyze-client-onboarding`
Analisa dados do onboarding e sugere configurações.

**Método:** POST  
**Autenticação:** Bearer Token

### `analyze-style`
Analisa estilo de escrita de amostras de texto.

**Método:** POST  
**Autenticação:** Bearer Token

### `analyze-youtube-sentiment`
Analisa sentimento de comentários do YouTube.

**Método:** POST  
**Autenticação:** Bearer Token

### `generate-performance-insights`
Gera insights de performance com análise de top performers.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "period": "7d|30d|90d",
  "metrics": {},
  "topPosts": []
}
```

---

## Imagens

### `generate-image`
Gera imagens via Gemini com DNA visual do cliente.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "prompt": "descrição da imagem",
  "clientId": "uuid",
  "style": "photographic|illustration|abstract|minimalist|corporate|cinematic",
  "aspectRatio": "1:1|16:9|9:16|1.91:1"
}
```

### `prepare-image-generation`
Prepara prompt enriquecido com DNA visual e contexto.

**Método:** POST  
**Autenticação:** Bearer Token

### `analyze-image-complete`
Analisa imagem com IA multimodal (Gemini Vision).

**Método:** POST  
**Autenticação:** Bearer Token

### `transcribe-images`
Extrai texto/conteúdo de imagens via OCR + IA.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Integrações Sociais (OAuth)

### Twitter/X
| Função | Método | Descrição |
|--------|--------|-----------|
| `twitter-oauth-start` | POST | Inicia fluxo OAuth |
| `twitter-oauth-callback` | GET | Callback OAuth |
| `twitter-post` | POST | Publica tweet |
| `twitter-reply` | POST | Responde tweet (Engagement Hub) |
| `twitter-feed` | POST | Busca tweets relevantes |

### LinkedIn
| Função | Método | Descrição |
|--------|--------|-----------|
| `linkedin-oauth-start` | POST | Inicia fluxo OAuth |
| `linkedin-oauth-callback` | GET | Callback OAuth |
| `linkedin-post` | POST | Publica no LinkedIn |

### Instagram
| Função | Método | Descrição |
|--------|--------|-----------|
| *Via Late API* | — | Instagram gerenciado via Late |

### YouTube
| Função | Método | Descrição |
|--------|--------|-----------|
| *OAuth via Late* | — | YouTube gerenciado via Late |

### `validate-social-credentials`
Valida credenciais de todas as plataformas.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Publicação (Late API)

### `late-oauth-start`
Inicia conexão OAuth via Late (multi-plataforma).

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "platform": "instagram|threads|tiktok|youtube",
  "redirectUri": "url"
}
```

### `late-oauth-callback`
Callback do OAuth Late.

**Método:** GET  
**Query Params:** `code`, `state`

### `late-post`
Publica em qualquer plataforma via Late API.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "platform": "instagram|threads|tiktok|linkedin|twitter",
  "content": "texto",
  "mediaUrls": ["url (opcional)"]
}
```

### `late-verify-accounts`
Verifica status de contas conectadas via Late.

**Método:** POST  
**Autenticação:** Bearer Token

### `late-disconnect-account`
Desconecta conta da Late API.

**Método:** POST  
**Autenticação:** Bearer Token

### `late-webhook`
Recebe webhooks da Late (status de publicação, etc.).

**Método:** POST  
**Autenticação:** Webhook Signature

### `fetch-late-metrics`
Busca métricas de posts via Late API.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Métricas

| Função | Plataforma |
|--------|-----------|
| `fetch-instagram-metrics` | Instagram Graph API |
| `fetch-youtube-metrics` | YouTube Data API |
| `fetch-beehiiv-metrics` | Beehiiv API |
| `fetch-late-metrics` | Late API (multi-plataforma) |

### `sync-rss-to-library`
Sincroniza feeds RSS para a Content Library.

**Método:** POST  
**Autenticação:** Service Role (cron)

### `fetch-rss-feed`
Busca e parseia feed RSS.

**Método:** POST  
**Autenticação:** Bearer Token

### `update-newsletter-covers`
Atualiza capas de newsletters via OpenGraph scraping.

**Método:** POST  
**Autenticação:** Service Role

### `resolve-youtube-channel`
Resolve informações de canal YouTube (nome, avatar, subscribers).

**Método:** POST  
**Autenticação:** Bearer Token

---

## Extração de Dados

| Função | Tipo | Descrição |
|--------|------|-----------|
| `extract-pdf` | Documento | Extrai texto de PDFs |
| `extract-docx` | Documento | Extrai texto de Word |
| `extract-youtube` | Vídeo | Extrai transcrição de YouTube |
| `extract-instagram` | Social | Extrai dados de posts Instagram |
| `extract-branding` | Website | Extrai branding de sites |
| `extract-knowledge` | Conhecimento | Extrai e processa para embeddings |
| `transcribe-media` | Áudio/Vídeo | Transcreve mídia (áudio e vídeo) |
| `scrape-website` | Website | Scraping genérico |
| `scrape-newsletter` | Newsletter | Extrai conteúdo de newsletters |
| `firecrawl-scrape` | Website | Scraping avançado via Firecrawl |
| `fetch-reference-content` | URL | Busca conteúdo de referências |
| `validate-csv-import` | Dados | Valida importação de CSV |

---

## Knowledge Base

| Função | Descrição |
|--------|-----------|
| `extract-knowledge` | Extrai conhecimento de arquivos para embeddings |
| `process-knowledge` | Processa chunks e gera embeddings vetoriais |
| `search-knowledge` | Busca semântica na base de conhecimento |

---

## Automações & Scheduling

| Função | Trigger | Descrição |
|--------|---------|-----------|
| `process-automations` | Cron (1min) | Processa automações ativas (RSS, agenda, webhook) |
| `process-recurring-content` | Cron | Processa conteúdo recorrente (GM tweets, etc.) |
| `process-scheduled-posts` | Cron (1min) | Publica posts agendados |
| `send-publish-reminders` | Cron (diário) | Envia lembretes de publicação |

---

## Notificações

| Função | Descrição |
|--------|-----------|
| `get-vapid-public-key` | Retorna chave VAPID para Web Push |
| `send-push-notification` | Envia push notification individual |
| `process-push-queue` | Processa fila de push (cron 2min) |
| `process-email-notifications` | Processa fila de email (cron 2min) |
| `process-due-date-notifications` | Cria notificações de prazo |
| `send-invite-email` | Envia email de convite para workspace |

---

## Pagamentos

| Função | Descrição |
|--------|-----------|
| `create-checkout` | Cria sessão Stripe Checkout |
| `customer-portal` | Abre portal do cliente Stripe |
| `verify-checkout-and-create-workspace` | Webhook pós-checkout |

---

## Utilitários

### `delete-account`
Deleta conta do usuário e dados associados.

**Método:** POST  
**Autenticação:** Bearer Token

### `_shared/`
Código compartilhado entre Edge Functions:
- `ai-provider.ts` — Gateway para LLMs (Gemini, OpenAI)
- `ai-usage.ts` — Tracking de uso de IA e débito de tokens
- `tokens.ts` — Gerenciamento de tokens
- `format-schemas.ts` — Schemas de formato (tweet, thread, carousel, etc.)
- `format-rules.ts` — Regras de geração por formato
- `content-validator.ts` — Validação de conteúdo gerado
- `knowledge-loader.ts` — Carregamento de knowledge base
- `cors.ts` — Headers CORS padrão

---

## 🔐 Autenticação

Todas as Edge Functions requerem autenticação via Bearer Token, exceto webhooks e callbacks OAuth.

**Header:**
```
Authorization: Bearer <supabase_access_token>
```

**Exemplo:**
```typescript
const { data, error } = await supabase.functions.invoke('kai-simple-chat', {
  body: { 
    messages: [{ role: 'user', content: 'Olá!' }],
    clientId: 'uuid-do-cliente'
  }
});
```

---

## 📊 Limites

- Chamadas por minuto: 60 (por usuário)
- Tamanho máximo de payload: 6MB
- Timeout: 60 segundos (padrão), 300s para geração complexa

---

*Última atualização: Março 2026*
