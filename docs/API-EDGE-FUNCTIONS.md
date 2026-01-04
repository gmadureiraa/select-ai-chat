# API Edge Functions - Documentação

Este documento descreve as Edge Functions disponíveis no sistema Kaleidos.

---

## 📋 Índice

1. [Chat & IA](#chat--ia)
2. [Geração de Conteúdo](#geração-de-conteúdo)
3. [Análise & Insights](#análise--insights)
4. [Integrações Sociais](#integrações-sociais)
5. [Métricas](#métricas)
6. [Extração de Dados](#extração-de-dados)
7. [Knowledge Base](#knowledge-base)
8. [Automações](#automações)
9. [Pagamentos](#pagamentos)
10. [Utilitários](#utilitários)

---

## Chat & IA

### `chat`
Endpoint principal para conversas com IA.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "clientId": "uuid",
  "model": "gemini-2.5-flash",
  "conversationId": "uuid (opcional)",
  "templateId": "uuid (opcional)"
}
```

**Resposta:** Stream de texto

---

### `chat-multi-agent`
Conversa com múltiplos agentes em sequência.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "clientId": "uuid",
  "agentIds": ["uuid1", "uuid2"]
}
```

---

### `execute-agent`
Executa um agente específico.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "agentId": "uuid",
  "input": "mensagem do usuário",
  "clientId": "uuid",
  "context": {}
}
```

---

### `orchestrator`
Orquestra múltiplas chamadas de IA.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Geração de Conteúdo

### `generate-content-from-idea`
Gera conteúdo a partir de uma ideia.

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

---

### `generate-ideas-pipeline`
Pipeline de geração de ideias.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "topic": "tema",
  "count": 5
}
```

---

### `generate-image`
Gera imagens com IA.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "prompt": "descrição da imagem",
  "clientId": "uuid",
  "style": "realistic|artistic|cartoon"
}
```

---

### `prepare-image-generation`
Prepara prompts para geração de imagem.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `reverse-engineer`
Analisa conteúdo e extrai estrutura/estilo.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "content": "texto para analisar",
  "clientId": "uuid"
}
```

---

## Análise & Insights

### `analyze-client-onboarding`
Analisa dados do onboarding do cliente.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid"
}
```

---

### `analyze-style`
Analisa estilo de escrita.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "content": "texto para análise",
  "clientId": "uuid"
}
```

---

### `analyze-youtube-sentiment`
Analisa sentimento de comentários do YouTube.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "comments": ["comentário 1", "comentário 2"]
}
```

---

### `generate-performance-insights`
Gera insights de performance.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "period": "7d|30d|90d"
}
```

---

### `grok-search`
Busca usando Grok AI.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "query": "consulta de busca"
}
```

---

## Integrações Sociais

### Instagram

#### `instagram-oauth-start`
Inicia fluxo OAuth do Instagram.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid"
}
```

#### `instagram-oauth-callback`
Callback do OAuth do Instagram.

**Método:** GET  
**Query Params:** `code`, `state`

---

### YouTube

#### `youtube-oauth-start`
Inicia fluxo OAuth do YouTube.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid"
}
```

#### `youtube-oauth-callback`
Callback do OAuth do YouTube.

**Método:** GET  
**Query Params:** `code`, `state`

---

### LinkedIn

#### `linkedin-oauth-start`
Inicia fluxo OAuth do LinkedIn.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "redirectUri": "url"
}
```

#### `linkedin-oauth-callback`
Callback do OAuth do LinkedIn.

**Método:** GET  
**Query Params:** `code`, `state`

#### `linkedin-post`
Publica no LinkedIn.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "content": "texto do post",
  "imageUrl": "url (opcional)"
}
```

---

### Twitter/X

#### `twitter-oauth-start`
Inicia fluxo OAuth do Twitter.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid"
}
```

#### `twitter-oauth-callback`
Callback do OAuth do Twitter.

**Método:** GET  
**Query Params:** `code`, `state`

#### `twitter-post`
Publica no Twitter.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `validate-social-credentials`
Valida credenciais de redes sociais.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "platform": "instagram|youtube|linkedin|twitter"
}
```

---

## Métricas

### `fetch-instagram-metrics`
Busca métricas do Instagram.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "username": "@usuario"
}
```

---

### `fetch-instagram-oauth-metrics`
Busca métricas via OAuth do Instagram.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `fetch-youtube-metrics`
Busca métricas do YouTube.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "channelId": "id do canal"
}
```

---

### `fetch-youtube-analytics`
Busca analytics detalhados do YouTube.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `fetch-beehiiv-metrics`
Busca métricas do Beehiiv.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid"
}
```

---

### `fetch-notion-metrics`
Busca métricas do Notion.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "databaseId": "id do database"
}
```

---

### `collect-daily-metrics`
Coleta métricas diárias (cron job).

**Método:** POST  
**Autenticação:** Service Role

---

### `weekly-metrics-update`
Atualização semanal de métricas (cron job).

**Método:** POST  
**Autenticação:** Service Role

---

### `update-client-metrics`
Atualiza métricas do cliente.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `scrape-social-metrics`
Extrai métricas de redes sociais via scraping.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientId": "uuid",
  "platform": "instagram|youtube|tiktok",
  "url": "url do perfil"
}
```

---

## Extração de Dados

### `extract-pdf`
Extrai texto de PDFs.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "fileUrl": "url do arquivo",
  "fileName": "nome.pdf"
}
```

---

### `extract-docx`
Extrai texto de documentos Word.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "fileUrl": "url do arquivo",
  "fileName": "nome.docx"
}
```

---

### `extract-youtube`
Extrai transcrição de vídeos do YouTube.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "url": "url do vídeo"
}
```

---

### `extract-instagram`
Extrai dados de posts do Instagram.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "url": "url do post"
}
```

---

### `extract-branding`
Extrai informações de branding de sites.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "url": "url do site",
  "clientId": "uuid"
}
```

---

### `transcribe-audio`
Transcreve arquivos de áudio.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "audioData": "base64 encoded audio"
}
```

---

### `transcribe-video`
Transcreve vídeos.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "videoUrl": "url do vídeo"
}
```

---

### `transcribe-images`
Transcreve/analisa imagens.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `scrape-website`
Extrai conteúdo de websites.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "url": "url do site",
  "clientId": "uuid"
}
```

---

### `scrape-newsletter`
Extrai conteúdo de newsletters.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `fetch-reference-content`
Busca conteúdo de referências.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `import-beehiiv-newsletters`
Importa newsletters do Beehiiv.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `validate-csv-import`
Valida importação de CSV.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Knowledge Base

### `extract-knowledge`
Extrai conhecimento de arquivos.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "clientFolder": "nome-da-pasta",
  "files": ["arquivo1.txt", "arquivo2.md"]
}
```

---

### `search-knowledge`
Busca na base de conhecimento.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "query": "termo de busca",
  "workspaceId": "uuid",
  "limit": 10
}
```

---

### `process-knowledge`
Processa conhecimento para embeddings.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `analyze-research`
Analisa itens de pesquisa.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `scrape-research-link`
Extrai dados de links de pesquisa.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Automações

### `run-automation`
Executa uma automação.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "automationId": "uuid"
}
```

---

### `execute-workflow`
Executa um workflow de IA.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `process-scheduled-posts`
Processa posts agendados (cron job).

**Método:** POST  
**Autenticação:** Service Role

---

### `process-recurring-content`
Processa conteúdo recorrente (cron job).

**Método:** POST  
**Autenticação:** Service Role

---

### `check-rss-triggers`
Verifica triggers RSS (cron job).

**Método:** POST  
**Autenticação:** Service Role

---

### `test-rss-trigger`
Testa trigger RSS.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `send-publish-reminders`
Envia lembretes de publicação (cron job).

**Método:** POST  
**Autenticação:** Service Role

---

### `n8n-api`
Proxy para API do n8n.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "action": "list_workflows|get_workflow|execute_workflow|...",
  "workspaceId": "uuid",
  "workflowId": "id (quando aplicável)"
}
```

---

## Pagamentos

### `create-checkout`
Cria sessão de checkout Stripe.

**Método:** POST  
**Autenticação:** Bearer Token  
**Body:**
```json
{
  "planType": "starter|pro"
}
```

---

### `check-subscription`
Verifica status da assinatura.

**Método:** POST  
**Autenticação:** Bearer Token

---

### `customer-portal`
Abre portal do cliente Stripe.

**Método:** POST  
**Autenticação:** Bearer Token

---

## Utilitários

### `_shared/`
Pasta com código compartilhado:
- `ai-usage.ts` - Tracking de uso de IA
- `tokens.ts` - Gerenciamento de tokens

---

## 🔐 Autenticação

Todas as Edge Functions requerem autenticação via Bearer Token, exceto webhooks e callbacks OAuth.

**Header:**
```
Authorization: Bearer <supabase_access_token>
```

**Exemplo de chamada:**
```typescript
const { data, error } = await supabase.functions.invoke('chat', {
  body: { 
    messages: [{ role: 'user', content: 'Olá!' }],
    clientId: 'uuid-do-cliente'
  }
});
```

---

## 📊 Limites e Rate Limiting

- Chamadas por minuto: 60 (por usuário)
- Tamanho máximo de payload: 6MB
- Timeout: 60 segundos (padrão)

---

## 🐛 Troubleshooting

### Erros comuns:

| Código | Descrição | Solução |
|--------|-----------|---------|
| 401 | Não autenticado | Verificar token de acesso |
| 403 | Sem permissão | Verificar RLS policies |
| 429 | Rate limit | Aguardar e tentar novamente |
| 500 | Erro interno | Verificar logs da função |

### Logs

Acesse os logs das Edge Functions via Lovable Cloud para debug.

---

*Última atualização: Janeiro 2025*
