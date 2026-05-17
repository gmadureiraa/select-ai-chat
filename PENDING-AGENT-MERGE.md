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
*(pending)*

### WRITE/DELETE TOOLS
*(pending — owner deve marcar quais tools listadas acima foram entregues + aplicar approval flow)*

### MCP LAYER
*(pending)*
