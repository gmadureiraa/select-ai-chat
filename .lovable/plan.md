

# Corrigir e proteger o MCP Server

## Problema atual
A function `mcp-reader` está crashando com `TypeError: Cannot read properties of undefined (reading 'inputSchema')`. Motivo: a API do `mcp-lite@0.10.0` mudou — o método `tool()` usa a assinatura `mcp.tool('name', { inputSchema, handler })` com Zod schemas, não `mcp.tool({ name, inputSchema, handler })` com JSON Schema puro.

Além disso, a autenticação atual exige a `service_role` key (que você não tem acesso no Lovable Cloud). A solução: criar um **token mestre MCP** próprio como secret.

## Plano

### 1. Criar secret `MCP_ACCESS_TOKEN`
- Gerar um token único que você define e cola no Claude Code
- Salvar como secret do projeto via ferramenta `add_secret`

### 2. Reescrever `supabase/functions/mcp-reader/index.ts`
- Corrigir a API do `mcp-lite`: usar `mcp.tool('name', { inputSchema: z.object(...), handler })` com Zod
- Adicionar `schemaAdapter` no McpServer
- Autenticação via `MCP_ACCESS_TOKEN` no header (em vez de service_role)
- Internamente continua usando `SUPABASE_SERVICE_ROLE_KEY` (disponível automaticamente dentro da edge function)
- Manter todas as 17 tools (read + write + invoke)

### 3. Configuração no Claude Code
```text
claude mcp add kaleidos -t url \
  https://tkbsjtgrumhvwlxkmojg.supabase.co/functions/v1/mcp-reader \
  --header "Authorization: Bearer SEU_MCP_ACCESS_TOKEN"
```

## Resultado
- MCP funciona sem precisar da service_role key
- Token próprio que só você conhece
- Acesso total (leitura, escrita, invoke de functions)

