# MCP-SETUP — KAI como servidor MCP

KAI agora expõe **todas** as tools registradas em `api/_lib/kai-chat-tools/index.ts` via [Model Context Protocol](https://modelcontextprotocol.io), pra qualquer client compatível (Claude Code, Cursor, Continue, etc.) consumir.

A descoberta é **automática**: qualquer tool reexportada do barrel `kai-chat-tools/index.ts` aparece em `/api/mcp/tools/list` sem edição manual neste setup.

---

## Endpoints

Todas as URLs assumem `BASE = https://kai.kaleidos.com.br` (ou seu deploy custom).

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `${BASE}/api/mcp` | POST | JSON-RPC 2.0 unificado (`initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `ping`). **Endpoint canônico pra clients MCP.** |
| `${BASE}/api/mcp` | GET | Server info + tool count (discovery casual). |
| `${BASE}/api/mcp/tools/list` | GET/POST | Lista todas as tools no shape MCP `{name, description, inputSchema}`. |
| `${BASE}/api/mcp/tools/call` | POST | Executa uma tool (REST style). |
| `${BASE}/api/mcp/resources/list` | GET/POST | Lista clientes, planning items, library items como resources `kai://...`. |
| `${BASE}/api/mcp/resources/read` | GET/POST | Lê um resource específico por URI. |

> Os endpoints REST aceitam tanto body REST simples quanto JSON-RPC. Use o que for mais conveniente.

---

## 1. Gerar `KAI_MCP_TOKEN`

```bash
# Linux/mac — gera 32 bytes random hex
openssl rand -hex 32

# Ou Bun
bun -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

Setar no Vercel:

```bash
cd code/kai-app
vercel env add KAI_MCP_TOKEN production
# cole o token gerado
```

Pra dev local, adicionar em `.env.local`:

```
KAI_MCP_TOKEN=cole-aqui-o-token
```

### Permissões do token

O `KAI_MCP_TOKEN` é equivalente a **super_admin** — bypassa todos os checks de `workspace_members`. Caso de uso pretendido: Claude Code no mac do Gabriel mexendo no workspace inteiro. **Nunca exponha esse token publicamente.**

Tools que persistem dados pra um user específico (ex: criar planning_item) precisam do header adicional:

```
x-mcp-user-id: <uuid do user>
```

Se você é o único user owner do workspace, basta pegar o `auth.users.id` no Neon Auth e usar fixo.

---

## 2. Configurar Claude Code

Editar `~/.claude/mcp.json` (criar se não existir):

```json
{
  "mcpServers": {
    "kai": {
      "url": "https://kai.kaleidos.com.br/api/mcp",
      "headers": {
        "Authorization": "Bearer ${KAI_MCP_TOKEN}",
        "x-mcp-user-id": "${KAI_USER_ID}"
      }
    }
  }
}
```

E exportar no shell:

```bash
echo 'export KAI_MCP_TOKEN="..."' >> ~/.zshrc
echo 'export KAI_USER_ID="..."' >> ~/.zshrc
source ~/.zshrc
```

Após reiniciar Claude Code, ele lista as tools KAI automaticamente.

---

## 3. Configurar Cursor

Cursor lê `.cursor/mcp.json` no projeto OU `~/.cursor/mcp.json` global:

```json
{
  "mcpServers": {
    "kai": {
      "url": "https://kai.kaleidos.com.br/api/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI",
        "x-mcp-user-id": "SEU_USER_ID_AQUI"
      }
    }
  }
}
```

> Cursor não expande `${VAR}` em headers — cole o token em texto puro (e gitignore o arquivo).

---

## 4. Listar tools disponíveis

A lista é **dinâmica** — qualquer tool nova adicionada ao barrel `kai-chat-tools/index.ts` aparece automaticamente. Pra ver a lista atual:

```bash
curl -s -H "Authorization: Bearer ${KAI_MCP_TOKEN}" \
  https://kai.kaleidos.com.br/api/mcp/tools/list | jq '.tools[].name'
```

Ou via GET na raiz (sem auth, só count):

```bash
curl -s https://kai.kaleidos.com.br/api/mcp | jq '.tools.count'
```

Tools com nomes começando com `delete*`, `remove*`, `drop*`, `destroy*`, `purge*`, ou que publicam (`publish*`) são marcadas `dangerous: true` no descriptor — clients MCP podem renderizar warning antes de aprovar a call.

---

## 5. Exemplos de uso

### Listar clientes

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${KAI_MCP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"listClients","arguments":{"limit":5}}' \
  https://kai.kaleidos.com.br/api/mcp/tools/call | jq
```

### JSON-RPC equivalente

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${KAI_MCP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "listClients",
      "arguments": { "limit": 5 }
    }
  }' \
  https://kai.kaleidos.com.br/api/mcp | jq
```

### Listar resources

```bash
curl -s \
  -H "Authorization: Bearer ${KAI_MCP_TOKEN}" \
  "https://kai.kaleidos.com.br/api/mcp/resources/list?limit=10" | jq
```

### Ler 1 cliente

```bash
curl -s \
  -H "Authorization: Bearer ${KAI_MCP_TOKEN}" \
  "https://kai.kaleidos.com.br/api/mcp/resources/read?uri=kai://client/SEU_UUID" | jq
```

---

## 6. Auth modes (resumo)

| Modo | Bearer | Permissões | User context |
|------|--------|------------|--------------|
| `service` | `KAI_MCP_TOKEN` | Global (super_admin equiv) | `x-mcp-user-id` header (opcional pra reads, obrigatório pra writes) |
| `user` | JWT Neon Auth | Limitado a `workspace_members` | `sub` do JWT |

Em **dev** (`KAI_MCP_TOKEN` não setado), o endpoint `tools/list` fica aberto pra discovery. **Sempre configure o token em produção.**

---

## 7. Rate limiting

Cada `tools/call` é classificado num bucket e tem cap de requests por minuto. Buckets isolados por `auth.mode + userId` — service-token e user JWT não compartilham pool.

| Bucket | Limite | Tools que casam |
|--------|--------|-----------------|
| `cheap` | **60/min** | `list*`, `get*`, `search*`, `query*`, `fetch*`, `view*`, `read*`, `describe*`, `find*`, `count*`, `check*`, `ping*`, `echo*` |
| `normal` | **20/min** | `create*` (exceto viral/content), `update*`, `edit*`, `save*`, `add*`, `set*`, `upload*`, `import*`, `schedule*`, `toggle*`, `send*`, `post*`, `publish*`, `mark*`, `move*`, etc. |
| `expensive` | **5/min** | `generate*`, `analyze*`, `transcribe*`, `extract*`, `embed*`, `research*`, `reverse*`, `summari[sz]e*`, `caption*`, `render*`, `voice*`, `brief*`, `scrape*`, `createViralCarousel`, `createContent`, `firecrawl*` |
| `destructive` | **3/min** | `delete*`, `remove*`, `drop*`, `destroy*`, `purge*`, `clear*`, `reset*`, `archive*`, `unlink*` |

Tools desconhecidas caem em `normal`. Pra ajustar limites, mexer em `api/_lib/mcp/rate-limit-policy.ts`.

**Headers de resposta** (sempre setados, mesmo em sucesso):
- `X-RateLimit-Bucket: cheap|normal|expensive|destructive`
- `X-RateLimit-Limit: <n>`
- `X-RateLimit-Remaining: <n>`
- `X-RateLimit-Reset: <epoch-seconds>`

**Erro 429** (REST) ou **JSON-RPC error code -32029**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32029,
    "message": "Rate limit excedido pra tool \"generateContent\" (bucket=expensive, 5/min). Tente em 38s.",
    "data": { "bucket": "expensive", "limit": 5, "retryAfterSec": 38 }
  }
}
```

### Backend: Upstash Redis (distribuído) ou fallback in-memory

Quando `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` estão setadas, o limiter usa Upstash sliding window — funciona cross-instance e sobrevive cold starts. **Modo recomendado em produção.**

Sem essas envs, fallback in-memory per-container — protege contra abuse oportunista do mesmo IP/user mas bypassa via paralelismo em containers distintos.

**Setar no Vercel:**
```bash
# 1. Criar database Upstash via Vercel Marketplace (https://vercel.com/integrations/upstash)
#    OU manualmente: console.upstash.com → Create Database → Redis (free tier OK).
# 2. Pegar REST URL + Token na aba "Details" e setar:
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel deploy --prod
```

---

## 8. Adicionando novas tools

Pra que uma tool nova apareça no MCP server **automaticamente**:

1. Crie `api/_lib/kai-chat-tools/myNewTool.ts` exportando `myNewTool: RegisteredTool`.
2. Adicione `export { myNewTool } from './myNewTool.js'` em `api/_lib/kai-chat-tools/index.ts`.
3. Deploy. A tool aparece em `tools/list` instantaneamente (auto-discovery).

Não há nenhum hardcode no MCP server — o registry itera os exports do barrel.

---

## 9. Troubleshooting

**`Unauthorized — provide KAI_MCP_TOKEN bearer or JWT`**
Token não setado ou Bearer não bate. Confira `vercel env ls | grep KAI_MCP_TOKEN`.

**`MCP service token sem x-mcp-user-id header`**
Tool de write disparada em service mode sem indicar user. Adicione o header.

**Tool não aparece em `tools/list`**
Confira que a tool foi reexportada em `api/_lib/kai-chat-tools/index.ts` E que o objeto tem `definition.name`, `definition.description`, `definition.parameters` (JSON schema), e `handler` (função). O registry filtra com `looksLikeRegisteredTool` em `api/_lib/mcp/registry.ts`.

**Erro `Tool "X" não existe`**
Restart o deploy — o registry cachei tools no escopo do módulo. Cold starts pegam o estado novo automaticamente.

**HTTP 429 / JSON-RPC -32029 inesperado**
Cliente excedeu o cap do bucket (`X-RateLimit-Bucket` mostra qual). Inspecione `X-RateLimit-Reset` pra saber quando libera, ou aumente o cap em `api/_lib/mcp/rate-limit-policy.ts`. Em prod sem `UPSTASH_REDIS_REST_URL`, o limite é per-container — várias instâncias warm podem gerar caps efetivos maiores que o nominal.
