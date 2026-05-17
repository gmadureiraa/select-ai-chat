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

> Owner: WRITE/DELETE tools agent. Entregues nesta sessão (2026-05-16).

#### Tools criadas (15 arquivos novos em `api/_lib/kai-chat-tools/`)

**WRITE / EDIT (10):**

| Tool | Arquivo | Resumo |
|---|---|---|
| `editTask` | `editTask.ts` | Edita team_task (title/desc/status/priority/due_date/assignee/labels) |
| `updateWorkflow` | `updateWorkflow.ts` | Edita ai_workflow (nome/cron/config jsonb/is_active) — wrapper de `ai-workflow-update` |
| `addWorkspaceMember` | `addWorkspaceMember.ts` | Cria invite em workspace_invites (email + role + expires_in_days). NÃO envia email — UI dispara |
| `removeWorkspaceMember` | `removeWorkspaceMember.ts` | Remove membership. **AÇÃO DESTRUTIVA** — exige `approved: true` |
| `updateMemberRole` | `updateMemberRole.ts` | Muda role (owner/admin/member). Só owner pode. Não pode rebaixar último owner |
| `updateBrandAssets` | `updateBrandAssets.ts` | Atualiza `clients.brand_assets` jsonb (logo/cores/typography). Merge raso por padrão |
| `updateVoiceProfile` | `updateVoiceProfile.ts` | Atualiza `clients.voice_profile` jsonb (tone/persona/pillars/use/avoid). Merge raso |
| `addReference` | `addReference.ts` | Alias semântico de saveToLibrary com destination='references' fixo |
| `editReference` | `editReference.ts` | Edita row de `client_reference_library` |
| `updateClientSettings` | `updateClientSettings.ts` | Upsert genérico em `client_preferences` (key/value bag) |

**DELETE (5):**

| Tool | Arquivo | Resumo |
|---|---|---|
| `deleteContent` | `deleteContent.ts` | Deleta planning_item. **AÇÃO DESTRUTIVA** — exige `approved`. Se já publicado, exige `force: true` |
| `deleteTask` | `deleteTask.ts` | Deleta team_task. Exige `approved: true` |
| `deletePlanningItem` | `deletePlanningItem.ts` | Alias semântico de deleteContent (framing "card/planejamento" vs "conteúdo") |
| `deleteReference` | `deleteReference.ts` | Deleta row de `client_reference_library`. Exige `approved` |
| `deleteAutomation` | `deleteAutomation.ts` | Deleta `planning_automations`. Exige `approved`. Sugere `toggleAutomation` (pausa) como alternativa no card de confirmação |

#### Padrão de aprovação adotado

> Não usei o `requireApproval()` helper do Approval Flow agent (`api/_lib/approval-flow.ts`)
> porque foi entregue depois deste mapa. Cada tool destrutiva implementa o
> padrão diretamente:
>
> 1. Primeira chamada (sem `approved: true`): retorna card com
>    `status: 'pending_approval'`, `requires_approval: true` e
>    `available_actions` contendo botão `variant: 'danger'` com
>    `tool_call` re-chamando a si própria com `approved: true`.
> 2. Segunda chamada (com `approved: true`): executa a ação e retorna
>    card com `status: 'done'`.
>
> Se quiser unificar com o helper depois, basta substituir o bloco `if (!args.approved) { ... return { card } }` por `requireApproval({ action, preview, params })` em cada tool delete + `removeWorkspaceMember`. Os 6 arquivos afetados são: deleteContent, deleteTask, deletePlanningItem, deleteReference, deleteAutomation, removeWorkspaceMember.

#### Handlers backend criados (9 novos arquivos em `api/_handlers/`)

| Handler | Tabelas | Auth |
|---|---|---|
| `team-tasks-update.ts` | `team_tasks` UPDATE | workspace_members OR super_admin |
| `team-tasks-delete.ts` | `team_tasks` DELETE | workspace_members OR super_admin |
| `planning-items-delete.ts` | `planning_items` DELETE | workspace_members do client OR super_admin. Retorna `was_published` |
| `automations-delete.ts` | `planning_automations` DELETE | workspace_members role owner/admin OR super_admin |
| `workspace-members-add.ts` | `workspace_invites` UPSERT | owner/admin OR super_admin |
| `workspace-members-remove.ts` | `workspace_members` DELETE | owner/admin OR super_admin. Bloqueia remover último owner |
| `workspace-members-update-role.ts` | `workspace_members` UPDATE | só owner OR super_admin. Bloqueia rebaixar último owner |
| `reference-update.ts` | `client_reference_library` UPDATE | workspace_members do client OR super_admin |
| `reference-delete.ts` | `client_reference_library` DELETE | workspace_members do client OR super_admin |

**`updateBrandAssets`, `updateVoiceProfile`, `editReference`(metadata)** — todos reusam o handler `client-update` / `reference-update` já existentes via fetch interno.

**`updateClientSettings`** — usa novo handler `client-settings-update.ts` que faz upsert em `client_preferences`.

#### 🔧 ADICIONAR EM `api/_lib/kai-chat-tools/index.ts`

```ts
// WRITE / EDIT (2026-05-16)
export { editTaskTool } from './editTask.js';
export { updateWorkflowTool } from './updateWorkflow.js';
export { addWorkspaceMemberTool } from './addWorkspaceMember.js';
export { removeWorkspaceMemberTool } from './removeWorkspaceMember.js';
export { updateMemberRoleTool } from './updateMemberRole.js';
export { updateBrandAssetsTool } from './updateBrandAssets.js';
export { updateVoiceProfileTool } from './updateVoiceProfile.js';
export { addReferenceTool } from './addReference.js';
export { editReferenceTool } from './editReference.js';
export { updateClientSettingsTool } from './updateClientSettings.js';

// DELETE (2026-05-16)
export { deleteContentTool } from './deleteContent.js';
export { deleteTaskTool } from './deleteTask.js';
export { deletePlanningItemTool } from './deletePlanningItem.js';
export { deleteReferenceTool } from './deleteReference.js';
export { deleteAutomationTool } from './deleteAutomation.js';
```

#### 🔧 ADICIONAR EM `api/_handlers/kai-simple-chat.ts`

**1. Imports (bloco de imports nomeados de `../_lib/kai-chat-tools/index.js`):**

```ts
// WRITE / EDIT
editTaskTool,
updateWorkflowTool,
addWorkspaceMemberTool,
removeWorkspaceMemberTool,
updateMemberRoleTool,
updateBrandAssetsTool,
updateVoiceProfileTool,
addReferenceTool,
editReferenceTool,
updateClientSettingsTool,
// DELETE
deleteContentTool,
deleteTaskTool,
deletePlanningItemTool,
deleteReferenceTool,
deleteAutomationTool,
```

**2. Registry (logo depois dos READ tools agregadores ~linha 2310):**

```ts
// WRITE / EDIT tools (2026-05-16) — controle pleno sobre tasks, workflows,
// workspace members, brand assets, voice profile e refs.
registry.register(editTaskTool);
registry.register(updateWorkflowTool);
registry.register(addWorkspaceMemberTool);
registry.register(removeWorkspaceMemberTool);
registry.register(updateMemberRoleTool);
registry.register(updateBrandAssetsTool);
registry.register(updateVoiceProfileTool);
registry.register(addReferenceTool);
registry.register(editReferenceTool);
registry.register(updateClientSettingsTool);

// DELETE tools (2026-05-16) — TODAS exigem approved=true; primeira chamada
// retorna card status=pending_approval com botão re-chamando approved=true.
registry.register(deleteContentTool);
registry.register(deleteTaskTool);
registry.register(deletePlanningItemTool);
registry.register(deleteReferenceTool);
registry.register(deleteAutomationTool);
```

#### 🔧 ADICIONAR NO SYSTEM PROMPT (`systemInstructionText`, dentro do bloco "Heurísticas de roteamento")

```
### Heurísticas de roteamento (WRITE / EDIT — 2026-05-16):
- "muda status/prazo/título da task X" → `editTask`
- "muda cron/prompt/config do workflow Y" → `updateWorkflow` (ai_workflows). Use `toggleAutomation` pra planning_automations
- "convida fulano@x pro workspace", "adiciona membro" → `addWorkspaceMember` (cria invite)
- "remove o João do workspace", "kicka o membro" → `removeWorkspaceMember` (DESTRUTIVA — sempre pede aprovação)
- "promove pra admin", "rebaixa pra member", "torna owner" → `updateMemberRole` (só owner pode)
- "muda cor primária pra X", "atualiza logo", "troca fonte" → `updateBrandAssets` (merge raso por padrão)
- "muda tom pra mais informal", "adiciona pilar X", "atualiza persona" → `updateVoiceProfile` (merge raso por padrão)
- "adiciona essa ref", "salva esse post como inspiração" → `addReference` (alias mais semântico que saveToLibrary)
- "edita essa ref", "muda título/nota/tags da ref X" → `editReference`
- "muda default de plataforma", "liga notificações", "salva como minha preferência X=Y" → `updateClientSettings`

### Heurísticas de roteamento (DELETE — 2026-05-16):
- "deleta esse carrossel/post", "apaga esse rascunho" → `deleteContent`
- "remove esse card", "tira do kanban/planejamento" → `deletePlanningItem` (mesmo handler, framing diferente)
- "deleta tarefa X" → `deleteTask`
- "remove essa ref da library" → `deleteReference`
- "apaga automação Y" (DESTRUTIVO) → `deleteAutomation`. Pra pausar use `toggleAutomation` (recuperável)

### REGRAS DE APROVAÇÃO (TODAS as tools destrutivas):
Toda chamada inicial a `delete*` ou `removeWorkspaceMember` retorna
`requires_approval: true` + card com status `pending_approval`. O usuário
clica no botão na UI e a UI re-chama a MESMA tool com `approved: true` no
payload — só então a deleção acontece. NÃO chame com `approved: true` no
primeiro turno, mesmo se o user "já confirmou" no texto: a UI precisa
mostrar o card de confirmação primeiro.

### REGRA EXTRA pra deleteContent / deletePlanningItem:
Se o item já tem `status = 'published'` ou `published_at IS NOT NULL`, o
backend exige `force: true` ADICIONAL. O card de confirmação já injeta
`force: true` automaticamente quando detecta item publicado, mas se você
montar tool_call manualmente, lembra de incluir ambos: `approved: true` E
`force: true`.
```

#### 📝 Notas de implementação

- Padrão idêntico às tools existentes: lookup leve via `query` direto, fetch HTTP para handler real (exceto `updateBrandAssets`/`updateVoiceProfile` que ainda usam fetch HTTP pro `client-update` mas fazem merge raso lendo o estado atual via query antes).
- Variant CSS válido é `'danger'` (não `'destructive'` — gotcha). Status válido é `'pending_approval'` (não `'pending'`).
- 9 handlers backend novos — ver `PENDING-MANIFEST.md` pros slugs a adicionar em `handler-manifest.ts`.
- Build limpa: `bunx tsc --noEmit -p tsconfig.json` zero erros; `bun run build` ✓ 6.13s.
- Commits: 2 (handlers backend + tools front).

### MCP LAYER
*(pending)*
