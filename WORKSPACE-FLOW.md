# Workspace Flow — UI de gerenciamento

Documentação do fluxo de gerenciamento de workspace do KAI 2.0 (multi-tenant).

## Visão geral

O backend já tinha as tabelas + RPCs (`workspaces`, `workspace_members`, `workspace_invites`,
`workspace_invite_clients`, `accept_pending_invite`, `add_workspace_member_or_invite`,
`get_my_pending_workspace_invites`). Faltava UI completa pro user final.

Esta entrega adiciona:

1. **WorkspaceSettingsTab** — owner edita nome, slug, logo + ve plano/owner + JSON settings.
2. **WorkspaceMembersTab** — owner/admin gerencia membros + convites (com client access granular).
3. **PendingInvitesAlert** — banner global pra aceitar/recusar convites pendentes.
4. **2 tabs novas no Kai.tsx** (`workspace-settings`, `workspace-members`), lazy-loaded.
5. **Sidebar atualizado** com grupo "Workspace" (Settings + Members).
6. **Banner integrado** no topo do `<main>` do `Kai.tsx`.

## Arquivos criados

- `src/components/workspace/WorkspaceSettingsTab.tsx` — tab de Settings
- `src/components/workspace/WorkspaceMembersTab.tsx` — tab de Membros
- `src/components/workspace/PendingInvitesAlert.tsx` — banner global

## Arquivos modificados

- `src/pages/Kai.tsx`
  - Lazy import dos 2 tabs novos
  - Eager import do `PendingInvitesAlert`
  - 2 cases novos no `renderContent` switch + entradas em `toolTabs`
  - Route protection (redirect pra `planning` se sem permissão)
  - `<PendingInvitesAlert />` renderizado no topo do `<main>`
- `src/components/kai/KaiSidebar.tsx`
  - Adicionado grupo "Workspace" (header + 2 itens) entre "Perfis" e "Admin"
  - Item "Configurações" aparece só pra `isOwner`
  - Item "Membros" aparece pra `canManageTeam` (owner ou admin)
  - Import do ícone `Users`
  - Destrutura `isOwner` do `useWorkspace()`

## RPCs / Tabelas usadas

| Operação | Mecanismo |
|----------|-----------|
| Atualizar workspace | `supabase.from('workspaces').update(...)` (RLS owner-only) |
| Ler subscription | `supabase.from('workspace_subscriptions').select(... subscription_plans)` |
| Ler owner profile | `supabase.from('profiles').select(...)` |
| Listar membros | `supabase.from('workspace_members')` + `profiles` (via `useTeamMembers`) |
| Listar invites | `supabase.from('workspace_invites')` (via `useTeamMembers`) |
| Convidar membro | RPC `add_workspace_member_or_invite(p_workspace_id, p_email, p_role, p_invited_by, p_client_ids)` |
| Atualizar role | `supabase.from('workspace_members').update({ role })` |
| Remover membro | `supabase.from('workspace_members').delete()` |
| Cancelar convite | `supabase.from('workspace_invites').delete()` |
| Reenviar email | `apiInvoke('send-invite-email', ...)` (Vercel Function) |
| Listar invites pendentes do user | RPC `get_my_pending_workspace_invites()` |
| Aceitar convite | RPC `accept_pending_invite(p_user_id, p_workspace_id)` |
| Recusar convite | `supabase.from('workspace_invites').delete()` (filtro por email + workspace_id) |

## Notas sobre o brief vs realidade

O brief original mencionava `accept_pending_invite(p_user_id, p_invite_id)`, mas o
schema real do TS types (`src/integrations/supabase/types.ts:4716-4719`) define a
RPC com `(p_user_id, p_workspace_id)`. O `get_my_pending_workspace_invites` também
não retorna `invite_id` — devolve `workspace_id`, `workspace_name`, `workspace_slug`,
`role`, `expires_at`. O componente segue a assinatura real.

Para "recusar convite" não existe RPC dedicada, então fazemos `DELETE` direto na
`workspace_invites` filtrando por `workspace_id + email + accepted_at IS NULL`.
A RLS já permite essa operação pra invites do próprio email.

A função `add_workspace_member_or_invite` retorna `Json` com `status` que pode ser:
- `member_added` — usuário existia, foi adicionado direto
- `invite_created` — não existia, invite criado (precisa email)
- `already_member` — já era membro

O `useTeamMembers.inviteMember` (já existia, foi reusado) trata os 3 casos.

## Permissões / Gating

- **Tab `workspace-settings`** — só `isOwner` consegue abrir (route guard + content guard).
- **Tab `workspace-members`** — `canManageTeam` (owner ou admin).
- **Sidebar grupo "Workspace"** — só aparece se `isOwner || canManageTeam`.
- **Sidebar "Configurações"** — só `isOwner`.
- **Sidebar "Membros"** — `canManageTeam`.
- **Banner PendingInvitesAlert** — independe de role, baseia-se em `get_my_pending_workspace_invites()` (que filtra pelo email do user logado).
- **Promover a `owner`** no dialog de convite — só `isOwner` enxerga essa opção (admin não pode criar outros owners).

## Stack utilizado

- Shadcn/ui: `Card`, `Button`, `Input`, `Label`, `Badge`, `Avatar`, `Dialog`,
  `AlertDialog`, `Select`, `Skeleton`, `Textarea`, `Separator`
- TanStack Query (`useQuery`, `useMutation`, `useQueryClient`)
- `useToast` + `sonner`
- `useAuth`, `useWorkspace`, `useTeamMembers`, `useClients`, `useIsMobile`
- `apiInvoke` pra chamadas de Edge/Vercel functions
- `date-fns/locale/ptBR` pra `formatDistanceToNow`

## Bloqueios encontrados

Nenhum bloqueio fundamental. Detalhes:

- A assinatura de `accept_pending_invite` no banco diverge do brief (usa
  `p_workspace_id`, não `p_invite_id`). Implementação seguiu o que o schema real
  expõe.
- "Recusar convite" não tem RPC, mas DELETE direto funciona via RLS.
- Atualizar `settings` JSON exigiu cast `as never` por causa do tipo `Json`
  recursivo do Supabase TS — comportamento idêntico ao usado em outros pontos
  do codebase.

## Build

`bun run build` passa limpo. `tsc --noEmit -p tsconfig.app.json` sem erros.
Bundle do `Kai-*.js` cresceu ~6KB (esperado, pelos 2 imports lazy + alert eager).

## Critério de pronto — checklist

- [x] WorkspaceSettingsTab criado
- [x] WorkspaceMembersTab criado
- [x] PendingInvitesAlert criado
- [x] 2 tabs lazy registradas em Kai.tsx
- [x] Route protection com redirect quando sem permissão
- [x] Sidebar com grupo "Workspace" (Settings owner-only + Members admin/owner)
- [x] PendingInvitesAlert renderizado no topo do `<main>`
- [x] `bun run build` passa
- [x] TypeScript clean
- [x] WORKSPACE-FLOW.md
- [x] Não tocou em `api/`
- [x] Não modificou RPCs Postgres
- [x] Branch: `combo-viral-integration`, sem commit
