# Approval Flow — guia rápido

> Infra pra exigir confirmação humana antes de executar tools destrutivas
> ou de efeito visível (deletar, publicar, enviar email, remover membro).

## Quando usar

Use `requireApproval()` em qualquer tool que:

- **Destrói dados** (delete content, delete task, delete reference, remove member)
- **Tem efeito externo irreversível** (publica num feed público, dispara email)
- **Toca dado de terceiros** (notifica membro de workspace, dispara webhook)

Tools de leitura (`getXxx`, `searchXxx`, `listXxx`) **nunca** devem usar approval flow.

Tools reversíveis com efeito interno (`addToPlanning`, `editContent`,
`saveToLibrary`) também **não** precisam — o user já pode desfazer no UI.

## Pattern

Toda tool com approval flow recebe dois args extras opcionais no schema:

```ts
properties: {
  // ...args normais
  approved: {
    type: 'boolean',
    description:
      'Interno — preenchido automaticamente pela UI após o usuário confirmar no modal. Não pedir pro usuário.',
  },
  callbackToken: {
    type: 'string',
    description:
      'Interno — token retornado pela primeira chamada da tool. A UI passa de volta na re-call.',
  },
}
```

Não declare `approved`/`callbackToken` como `required`.

### Implementação do handler

```ts
import { requireApproval, consumeApprovalToken } from '../approval-flow.js';

export const deleteContentTool: RegisteredTool<DeleteArgs, unknown> = {
  definition: {
    name: 'deleteContent',
    description: 'Deleta um planning_item permanentemente.',
    parameters: {
      type: 'object',
      properties: {
        planningItemId: { type: 'string', description: 'UUID do item' },
        approved: {
          type: 'boolean',
          description:
            'Interno — preenchido pela UI após confirmação. Não pedir pro usuário.',
        },
        callbackToken: {
          type: 'string',
          description: 'Interno — token retornado pela 1ª chamada.',
        },
      },
      required: ['planningItemId'],
    },
  },

  handler: async (args, ctx) => {
    const id = String(args.planningItemId ?? '').trim();
    if (!id) return { ok: false, error: 'planningItemId obrigatório' };

    // Carrega preview info antes de pedir aprovação
    const item = await queryOne<{ id: string; title: string }>(
      'SELECT id, title FROM planning_items WHERE id = $1 AND client_id = $2',
      [id, ctx.clientId],
    );
    if (!item) return { ok: false, error: 'Item não encontrado' };

    // 1ª chamada — pede aprovação
    if (args.approved !== true) {
      const approval = requireApproval({
        action: 'delete_content',
        toolName: 'deleteContent',
        toolArgs: { planningItemId: id },
        preview: {
          title: 'Deletar conteúdo?',
          description: `"${item.title}" será removido permanentemente.`,
          impactedItems: [{ id: item.id, label: item.title }],
          irreversible: true,
        },
      });
      return { ok: true, data: approval };
    }

    // 2ª chamada — valida token e executa
    const token = String(args.callbackToken ?? '');
    if (!consumeApprovalToken(token, 'delete_content')) {
      return { ok: false, error: 'Token de aprovação inválido ou expirado. Tente de novo.' };
    }

    await query('DELETE FROM planning_items WHERE id = $1 AND client_id = $2', [
      id,
      ctx.clientId,
    ]);
    return { ok: true, data: { deleted: true, id } };
  },
};
```

## Fluxo end-to-end

1. **Usuário pergunta** "deleta o post X"
2. **LLM chama** `deleteContent({ planningItemId: 'abc' })`
3. **Handler retorna** `data: ApprovalRequest` com `callbackToken: 'appr_xxx'`
4. **Runner** propaga via stream como `delta.approval_request` (não vira ActionCard)
5. **Frontend** detecta `approval_request`, abre o `ApprovalDialog` (modal shadcn)
6. **Usuário clica Confirmar** → frontend re-call `kai-simple-chat` com
   `forceTool: { name: 'deleteContent', args: { planningItemId: 'abc', approved: true, callbackToken: 'appr_xxx' } }`
7. **Handler** valida token, executa deleção, retorna `{ ok: true }`
8. **LLM** dá feedback em texto: "Pronto, deletei."

## Notas técnicas

- Token TTL: **5 minutos**. Após expirar, usuário precisa re-disparar a tool.
- Token é **single-use** — `consumeApprovalToken` remove na primeira leitura.
- Store é **in-memory** por instância de função. Funciona pra MVP (cold starts
  curtos). Se virar problema (multi-region, alta concorrência), migrar pra
  tabela Neon `approval_tokens` com `expires_at`.
- Validação `action`: o token só funciona se a 2ª chamada usar o mesmo `action`
  string da 1ª. Isso impede injection (não dá pra usar token de
  `delete_content` pra executar `publish_now`).

## Tools que devem usar approval flow

Ver lista em [`PENDING-AGENT-MERGE.md`](../../PENDING-AGENT-MERGE.md) seção
"APPROVAL FLOW".
