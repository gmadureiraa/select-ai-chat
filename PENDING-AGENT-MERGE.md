# PENDING-AGENT-MERGE.md

> Coordenação entre agentes paralelos. Cada agente trabalha em uma fatia
> (READ tools, WRITE/DELETE tools, MCP layer, Approval flow) e deixa aqui
> as mudanças que precisam ser aplicadas no `kai-simple-chat.ts` /
> `kai-chat-tools/index.ts` / `kai-chat-tools/registry.ts` (e no system
> prompt) pra serem mergeadas pelo orquestrador no fim.

---

## APPROVAL FLOW

> Owner: Approval Flow agent (este). Infra entregue em `d059eea0` + `a595c5d0`.

### Infra disponível

Helper backend: `api/_lib/approval-flow.ts` exporta:
- `requireApproval(opts) → ApprovalRequest` — gera token + payload pra UI
- `consumeApprovalToken(token, expectedAction) → boolean` — valida single-use
- `isApprovalRequest(value)` — type guard

Stream evento: `delta.approval_request` (novo no protocolo SSE). Runner
detecta automaticamente quando `result.data` é `ApprovalRequest`, emite via
stream e responde ao LLM com `status: 'pending_user_approval'` pra ele não
re-call.

Frontend: `ApprovalDialog` (shadcn AlertDialog) + `useKAISimpleChat`
expõe `{ pendingApproval, confirmApproval, cancelApproval }`.

Doc completa: [`api/_lib/approval-flow.README.md`](api/_lib/approval-flow.README.md)

### Tools que DEVEM usar approval flow

O agente WRITE/DELETE precisa aplicar `requireApproval()` nas tools abaixo
antes de executar a ação destrutiva. Padrão na 1ª chamada: retornar
`{ ok: true, data: requireApproval({...}) }`; na 2ª, validar token com
`consumeApprovalToken()` e executar.

| Tool | `action` string | Preview suggestions | Irreversible |
|---|---|---|---|
| `deleteContent` | `delete_content` | "Deletar conteúdo?" + título do item | sim |
| `deleteTask` | `delete_task` | "Deletar tarefa?" + título | sim |
| `deletePlanningItem` | `delete_planning_item` | "Remover do planejamento?" + título | sim |
| `deleteReference` | `delete_reference` | "Deletar referência?" + título | sim |
| `deleteAutomation` | `delete_automation` | "Desativar e deletar automação?" + nome | sim |
| `removeWorkspaceMember` | `remove_workspace_member` | "Remover X do workspace?" | sim |
| `publishNow` | `publish_now` | "Publicar agora em <platform>?" + preview do conteúdo | não (mas visível externamente) |
| `addWorkspaceMember` | `add_workspace_member` | "Convidar <email> como <role>?" — manda email externo | não |
| `bulkDeleteContent` (futura) | `bulk_delete_content` | "Deletar N itens?" + lista | sim |

**Não precisam de approval:**
- Todas as tools `getXxx`, `searchXxx`, `listXxx` (read-only)
- `editContent`, `editTask`, `editReference` (reversíveis via histórico ou re-edit)
- `addToPlanning`, `saveToLibrary`, `createXxx` (criação, não-destrutiva)
- `scheduleFor` (agendamento é reversível — `cancelScheduled` existe)
- `toggleAutomation` (toggle é trivialmente reversível)
- `updateClient`, `updateMemberRole`, `updateBrandAssets` (edição, reversível)
- `connectAccount` (oauth flow já é confirmação explícita)

### Schema extra que cada tool destrutiva precisa expor

Adicionar nos `parameters.properties` (não em `required`):

```ts
approved: {
  type: 'boolean',
  description:
    'Interno — preenchido pela UI após o usuário confirmar no modal. Não pedir pro usuário.',
},
callbackToken: {
  type: 'string',
  description:
    'Interno — token retornado pela primeira chamada. UI passa de volta na re-call.',
},
```

### Snippet pronto pro handler

```ts
import { requireApproval, consumeApprovalToken } from '../approval-flow.js';

handler: async (args, ctx) => {
  const id = String(args.someId ?? '').trim();
  if (!id) return { ok: false, error: 'someId obrigatório' };

  // Carrega info pro preview (não-destrutiva — pode rodar nas duas chamadas)
  const item = await queryOne<{ id: string; title: string }>(
    'SELECT id, title FROM xyz WHERE id = $1 AND client_id = $2',
    [id, ctx.clientId],
  );
  if (!item) return { ok: false, error: 'Item não encontrado' };

  if (args.approved !== true) {
    return {
      ok: true,
      data: requireApproval({
        action: 'delete_xyz',
        toolName: 'deleteXyz',
        toolArgs: { someId: id },
        preview: {
          title: 'Deletar item?',
          description: `"${item.title}" será removido permanentemente.`,
          impactedItems: [{ id: item.id, label: item.title }],
          irreversible: true,
        },
      }),
    };
  }

  const token = String(args.callbackToken ?? '');
  if (!consumeApprovalToken(token, 'delete_xyz')) {
    return { ok: false, error: 'Token de aprovação inválido ou expirado. Peça de novo.' };
  }

  // ação destrutiva real
  await query('DELETE FROM xyz WHERE id = $1', [id]);
  return { ok: true, data: { deleted: true, id } };
},
```

### Mudanças no `kai-simple-chat.ts` (registry + system prompt)

**Não vou editar `kai-simple-chat.ts` diretamente** — orquestrador final faz isso.
Necessário:

1. **Registry**: registrar as novas tools destrutivas (depois que WRITE/DELETE
   agent terminar) com `registry.register(deleteContentTool)` etc.

2. **System prompt**: adicionar bloco no `systemInstructionText` informando o
   LLM sobre o approval flow. Sugestão de texto:

   > **APPROVAL FLOW (tools destrutivas):** Algumas ferramentas (deleteContent,
   > deleteTask, removeWorkspaceMember, publishNow, etc.) exigem confirmação
   > humana antes de executar. Quando você chama uma delas e o resultado vier
   > como `{ status: 'pending_user_approval', action: '...' }`, NÃO tente
   > chamar de novo. A UI já abriu um modal de confirmação pro usuário. Apenas
   > responda em texto curto, ex: "Te mostrei a confirmação no modal — clica
   > em Confirmar pra eu seguir." Quando o usuário confirma, eu re-chamo a
   > mesma tool automaticamente com `approved: true` (você não precisa fazer
   > nada — esse re-call vem como uma nova mensagem do usuário pra você).

3. **forceTool path**: o handler `forceTool` no `kai-simple-chat.ts:2252-2256`
   já injeta nudge dirigindo o LLM a chamar a tool com args exatos. Funciona
   sem mudança — `confirmApproval` no hook usa exatamente esse path.

---

## (Outros agentes preenchem abaixo)

### READ TOOLS

> Owner: READ tools agent. Entregues nos commits `889dfa5a`, `c9591c6b`, `6faf3f30`.

#### Tools criadas (10 arquivos novos em `api/_lib/kai-chat-tools/`)

| Tool | Arquivo | Resumo |
|---|---|---|
| `getWorkspaceMembers` | `getWorkspaceMembers.ts` | Membros + roles + profiles (filter por role/workspace) |
| `getBrandAssets` | `getBrandAssets.ts` | `clients.brand_assets` JSONB + `client_visual_references` (logos, paletas, style examples) |
| `getVoiceProfile` | `getVoiceProfile.ts` | `voice_profile` estruturado (tone/persona/use/avoid/pillars) + identity_guide + content_guidelines |
| `getIntegrationsStatus` | `getIntegrationsStatus.ts` | `client_social_credentials` (Metricool/Postiz/OAuth) + plataformas faltando |
| `getAuditLog` | `getAuditLog.ts` | `social_credentials_audit_log` — só owner/admin/super-admin |
| `getReferences` | `getReferences.ts` | Lista full paginada de refs com filtros (vs searchRefs que é keyword) |
| `getWorkflows` | `getWorkflows.ts` | `ai_workflows` + agente + last run status (NÃO confunde com `listAutomations` que é `planning_automations`) |
| `getNotifications` | `getNotifications.ts` | `notifications` filtrado pelo user (default unread) |
| `getRecentActivity` | `getRecentActivity.ts` | Feed misto: planning criados/publicados + tasks criadas/completadas (workspace-scoped, 7d default) |
| `getUIState` | `getUIState.ts` | Espelha `ctx.uiState` (snapshot do header `x-kai-ui-state`) |

#### Mudanças cross-cutting já aplicadas

1. **`api/_lib/kai-chat-tools/types.ts`** — `ToolExecutionContext` ganhou campo opcional `uiState?: Record<string, unknown> | null` (commit `889dfa5a`).
2. **`api/_handlers/kai-simple-chat.ts`** — decodificação do header `x-kai-ui-state` (base64-JSON, cap 12KB) e passa pro `toolCtx.uiState` (commit `6faf3f30`). **Apenas no bloco de request-handling — registry/system prompt intactos.**
3. **`src/hooks/useKAISimpleChat.ts`** — accept `getUIState?: () => Record<string, unknown> | null`, encodes em base64 e adiciona header (commit `6faf3f30`).
4. **`src/components/kai/KaiAssistantTab.tsx`** — passa `getUIState` que captura tab/itemId/monthInView/filters da URL (commit `6faf3f30`).

#### 🔧 ADICIONAR EM `api/_lib/kai-chat-tools/index.ts`

```ts
// Adicionar ao bloco de exports nomeados (depois dos existentes):
export { getWorkspaceMembersTool } from './getWorkspaceMembers.js';
export { getBrandAssetsTool } from './getBrandAssets.js';
export { getVoiceProfileTool } from './getVoiceProfile.js';
export { getIntegrationsStatusTool } from './getIntegrationsStatus.js';
export { getAuditLogTool } from './getAuditLog.js';
export { getReferencesTool } from './getReferences.js';
export { getWorkflowsTool } from './getWorkflows.js';
export { getNotificationsTool } from './getNotifications.js';
export { getRecentActivityTool } from './getRecentActivity.js';
export { getUIStateTool } from './getUIState.js';
```

#### 🔧 ADICIONAR EM `api/_handlers/kai-simple-chat.ts`

**1. Imports (bloco de imports nomeados de `../_lib/kai-chat-tools/index.js`):**

```ts
getWorkspaceMembersTool,
getBrandAssetsTool,
getVoiceProfileTool,
getIntegrationsStatusTool,
getAuditLogTool,
getReferencesTool,
getWorkflowsTool,
getNotificationsTool,
getRecentActivityTool,
getUIStateTool,
```

**2. Registry (logo depois do `registry.register(getRecentPerformanceTool)` ~linha 2308):**

```ts
// READ tools agregadores (2026-05-16) — workspace, brand, voice, integrações,
// auditoria, refs, workflows, notificações, atividade e UI state.
registry.register(getWorkspaceMembersTool);
registry.register(getBrandAssetsTool);
registry.register(getVoiceProfileTool);
registry.register(getIntegrationsStatusTool);
registry.register(getAuditLogTool);
registry.register(getReferencesTool);
registry.register(getWorkflowsTool);
registry.register(getNotificationsTool);
registry.register(getRecentActivityTool);
registry.register(getUIStateTool);
```

#### 🔧 ADICIONAR NO SYSTEM PROMPT (`systemInstructionText`)

Bloco recomendado pra adicionar no system prompt (entre o bloco de tools de
content/planning e o bloco de approval flow):

```
**LEITURA DE CONTEXTO COMPLETO (READ tools):**

Antes de gerar conteúdo, agendar, publicar ou tomar decisão que dependa de
identidade do cliente / workspace, use as tools de leitura corretas:

- `getClientContext` — quando precisar de overview (nome, descrição, guidelines, social).
- `getVoiceProfile` — pra TOM DE VOZ específico (use/avoid/persona/pillars). Sempre antes de gerar texto novo se a conversa não trouxe a voz.
- `getBrandAssets` — pra cor, logo, tipografia, paleta, refs visuais. Antes de gerar imagem/capa.
- `getIntegrationsStatus` — pra saber que contas estão conectadas antes de propor publicação. Se IG/LinkedIn não tá ligado, oferecer `connectAccount`.
- `getWorkspaceMembers` — quem tem acesso? Quem é owner/admin? Necessário antes de mencionar/atribuir alguém.
- `getReferences` — lista full paginada de refs salvas (com filtros). Use pra "todas as refs", "lista", "quantas".
- `searchRefs` / `searchLibrary` — busca por TERMO. Use só quando o user pediu uma referência específica por palavra-chave.
- `getWorkflows` — automações avançadas (ai_workflows) que rodam em cron. NÃO confunde com `listAutomations` (essa é planning_automations, simples).
- `getNotifications` — só do user logado. "O que tem de novo pra mim?".
- `getRecentActivity` — feed de atividade do workspace (planning criado/publicado, tasks criadas/completadas) nos últimos 7d. Use pra "o que aconteceu?", "essa semana".
- `getAuditLog` — eventos de uso de credenciais. APENAS owners/admins. Use pra "quem acessou", "auditoria".
- `getUIState` — resolve PRONOMES CONTEXTUAIS. Quando o user disser "esse mesmo", "essa aba", "esse item", "esse mês" SEM dar ID/nome explícito, chame `getUIState` primeiro pra saber qual tab/item/mês o user tá olhando. Se `available: false`, peça pro user esclarecer.

REGRA: nunca peça pro user dados que você pode buscar via tool. Se o user
disser "tom da defiverso", chame `getVoiceProfile` em vez de perguntar.
```

#### 📝 Notas de implementação

- Todas as tools READ usam `query` / `queryOne` direto (Neon) — nenhuma faz fetch HTTP de outro handler. Mais rápido, sem cold-start em cascata.
- Workspace resolution pattern: quando `workspace_id` não vier, fazem lookup via `clients.workspace_id` do `ctx.clientId` (igual `listAutomations`).
- `getAuditLog` faz check explícito de role (owner/admin/super_admin) ANTES da query — devolve erro claro pro LLM, não 500 da RLS.
- `getUIState` returns `{ available: false, ... }` quando o header não veio — comportamento esperado pra bot Telegram / dev-test-flows / chamadas via curl.
- O cap de 12KB no header e 8KB no encode client-side evita DoS de tokens longos no Gemini.
- Build limpa: `bunx tsc --noEmit -p .` zero erros, `bun run build` ✓ 6.22s.

### WRITE/DELETE TOOLS
*(pending — owner deve marcar quais tools listadas acima foram entregues + aplicar approval flow)*

### MCP LAYER
*(pending)*
