

# Melhorias no Planejamento: Menções em Comentários + Notificações

## Situação Atual
- **Comentários** funcionam (CRUD ok, FK corrigida), mas usam `Input` simples sem suporte a @menções
- **MentionableInput** já existe e busca membros do workspace via `@` -- mas não é usado nos comentários
- **NotificationBell** já existe no header com popover/sheet e suporte a tipos como `mention`
- **Falta**: quando alguém é mencionado em um comentário, nenhuma notificação é criada no banco

## Mudanças Planejadas

### 1. Substituir Input por MentionableInput nos Comentários
- Em `PlanningItemComments.tsx`, trocar o `<Input>` por `<MentionableInput>` para permitir `@user` nos comentários
- Passar o `clientId` do planning item para que a busca de membros funcione
- Renderizar menções formatadas no corpo do comentário usando `MentionRenderer`

### 2. Criar Notificações ao Mencionar Usuários em Comentários
- No hook `usePlanningComments.ts`, após inserir o comentário, parsear menções do tipo `user` usando `parseMentions()`
- Para cada user mencionado, inserir uma notificação na tabela `notifications` com type `mention`
- Incluir metadata com `planning_item_id` e `comment_id` para navegação

### 3. Melhorar Exibição dos Comentários
- Usar `MentionRenderer` para renderizar o `comment.content` com menções estilizadas (badges clicáveis)
- Adicionar prop `clientId` ao componente `PlanningItemComments`

### 4. Ajustes no Diálogo
- Passar `selectedClientId` do dialog para `PlanningItemComments` via nova prop `clientId`

## Arquivos Modificados
1. **`src/components/planning/PlanningItemComments.tsx`** -- MentionableInput + MentionRenderer
2. **`src/hooks/usePlanningComments.ts`** -- Notificação de menção após insert
3. **`src/components/planning/PlanningItemDialog.tsx`** -- Passar clientId para comments

