# Revisão Macro Frente D — Settings + Clients + KAI Assistant + Automations

> Data: 2026-05-10 · escopo recortado pra evitar overlap com Frente A/B/C.

## Status por módulo

### Settings — OK ✓
- `SettingsTab.tsx` faz render correto de todas as 13 sections via switch + lazy fallback pra `profile` quando o user não tem permissão (workspace/members/audit-log/radar-sources são gated).
- `SettingsNavigation.tsx` agrupa em 3 buckets (Conta · Workspace · Sistema) — desktop sidebar vertical, mobile chips horizontais. Permissões controlam visibilidade.
- Mutations OK: `updateProfile` (nome/avatar), `resetPasswordForEmail`, theme via `next-themes`, push permission via `usePushNotifications`, prefs via `useNotificationPreferences`.
- `IntegrationsSettings` é read-only com fallback gracioso quando o edge `get-integrations-status` não existe (não quebra a UI).
- `WebhookSettings` tem 3 sub-tabs (Visão geral / Histórico / Alertas) com filtros + reprocess + test dialog funcionais.
- `AuditLogSettings` lista user_activities com filtros por tipo + busca + paginação 30/page.
- `MCPDocsTab` (importado em `?section=mcp`) tem tokens limpos (`bg-muted`, `text-muted-foreground`).
- A11y: focus-visible nas nav buttons, aria-labels nos selects, sr-only span nos skeletons.

### Clients — OK ✓ (pós-fix)
- `ClientEditDialog` → `ClientEditTabsSimplified` (9 tabs viraram 3 grupos sidebar): `Identidade` (Sobre, Redes, Contexto IA), `Conteúdo` (Referências, Integrações), `Performance & Configs` (Viral, Analytics, Notificações, MCP).
- `ClientEditNavigation` — sidebar 192px desktop / chips horizontais mobile, com `CompletionDot` (verde/âmbar/vermelho) por section.
- Auto-save debounce 2s (signature-based, evita loop de re-render). Status visual no avatar (saving spinner / saved check).
- Lazy render: cada section só monta quando ativa (evita carregar `AIContextTab`/`ClientAnalyticsTab` desnecessariamente).
- `tabCompletion` mapeia corretamente `aiContext` pra chave `"ai-context"` na linha 354.
- `ClientsListPage` (rota `/kaleidos/clients`) — search + grid + onboarding wizard 5 steps + edit dialog + delete confirm OK.
- `ClientViralSettingsTab` continua funcional com 6 sub-tabs (Radar/Carrossel/Reels/Hashtags/Concorrentes/Relatórios). `.rdv-shell` ativa tokens RDV pro ClientSourcesManager sem vazar pra fora.
- Mutations confirmadas: voice profile (`VoiceProfileEditor`), brand colors (via `BrandAssetsEditor` em outras partes), refs (`ClientReferencesManager`), visual refs, identity guide.

**Bug corrigido**: Os "BulletPoints" em `ClientViralSettingsTab` (sub-tabs Carrossel + Reels) referenciavam labels de tabs antigas ("Tab Perfil", "Tab Digital", "Tab Integrações") que não existem mais depois da reorg pra sidebar agrupada. Substituído por novas labels "Identidade → Sobre", "Identidade → Redes", "Conteúdo → Referências", "Conteúdo → Integrações" — match com `ClientEditNavigation.tsx`.

### KAI Assistant — OK ✓
- `KaiAssistantTab.tsx` orquestra `useKAISimpleChat` (streaming SSE via `/api/kai-simple-chat`) + persistência em `kai_chat_conversations` / `kai_chat_messages`.
- `useKAISimpleChat.ts` faz o streaming completo: `onDelta` (texto), `onImage` (imagens geradas), `onActionCard` (cards F0.3b+), `onToolRunning` (tracking de tools longas), reconciliation em caso de stream-drop durante publishing.
- `EnhancedMessageBubble` renderiza markdown, artifacts, ResponseCard, SourcesBadge, ValidationBadge, MessageFeedback, ActionCards. Tokens slate/zinc já corrigidos — usando `bg-muted`, `text-muted-foreground`, `text-primary`, `text-amber-600`, etc.
- `CitationChip` idem — tokens semânticos limpos. `reference_library` usa `bg-muted text-muted-foreground border-border`.
- Auto-prompt via `?prompt=` query param e `location.state.pendingMessage` (deduplicado por refs).
- Export Markdown/PDF + Clear history + tool-calling (`?tools=0` desliga) funcionando.
- A11y: `aria-label` no botão Mais ações, `sr-only` no DialogHeader, scroll-to-bottom suave.

### Automations — OK ✓ (pós-fix)
- `AutomationsTab.tsx` quebra os 3 conceitos antigamente misturados: `schedule` (cron-like), `feeds` (RSS + webhooks), `workflows` (Workflows AI Madureira-style com cron próprio).
- `PlanningAutomationsList` (render compartilhado de schedule + feeds): filtros por cliente + tipo (oculto em schedule), stats per-scope, agrupamento por cliente com bulk actions (pausar/ativar todas).
- `AiWorkflowsSection` agrupa workflows por agent, mostra health (healthy/stale/paused), botão Trigger manual + Runs dialog + Edit.
- `AiWorkflowRunsDialog` — runs com status, duração, custo, violations, errors, agregados no header.
- Mutations OK: `toggleAutomation` (Switch), `deleteAutomation` (AlertDialog), `triggerAutomation` (Test), `toggleWorkflow`, `triggerWorkflow`.
- Histórico em `AutomationHistoryDialog` separado.

**Bug corrigido**: Ao trocar entre sub-tabs (`schedule` → `feeds` → `workflows`), o `triggerFilter` ficava preso no valor anterior, causando empty state inesperado. Adicionado reset automático em `onValueChange` do `Tabs` — `setTriggerFilter('all')` antes de `setActiveMainTab`.

## Bugs encontrados + fixes

| # | Onde | Problema | Fix |
|---|------|---------|-----|
| 1 | `ClientViralSettingsTab.tsx` (Carrossel + Reels sub-tabs) | "Onde ajustar cada item" referenciava labels de tabs antigas que não existem mais ("Tab Perfil", "Tab Digital", "Tab Integrações"). Confunde user. | Substituído por path nova: "Identidade → Sobre", "Identidade → Redes", "Conteúdo → Referências", "Conteúdo → Integrações". |
| 2 | `AutomationsTab.tsx` linha ~369 | `triggerFilter` persistia entre sub-tabs (schedule não permite editar; feeds permite). Trocar de feeds com filtro "rss" pra schedule mostrava empty state vazio. | Reset `setTriggerFilter('all')` no `onValueChange` antes de mudar a aba. |

## TODOs (não bloqueantes)

- **P2**: `ClientNotificationsTab` salva prefs workspace-wide hoje (mesmas pra todos os clientes). Quando schema suportar prefs per-client, basta passar `clientId` no `togglePreference` — placeholder UI já está correto.
- **P2**: `IntegrationsSettings` tem `testEdgeFn` apenas declarativo. Adicionar endpoints reais pra Gemini/Apify/Metricool quando útil — hoje botão "Testar" só aparece quando `testEdgeFn` está set, então não há regressão.
- **P3**: `ClientViralSettingsTab` ainda monta 6 sub-tabs como Tabs internas dentro do `viral` da sidebar — funciona mas é "tabs dentro de tabs" leve cognitivo. Considerar segmentar em sections separadas no futuro.
- **P3**: `useKAISimpleChat` não persiste `actionCards` no banco (comentário linha 421-422). Quando user recarregar conversa, cards somem. Plano da F1 já documentado.
- **P3**: Bundle de `SettingsTab` está em ~187 KB (50 KB gzip). Major contributors são `WebhookSettings` (logs viewer com tabela + Pre/Pretty JSON) e `AuditLogSettings`. Lazy splitting por section daria ganho.

## Build

`bun run build` → ✓ verde, 6.08s, sem warnings novos. Bundle stable. Commit per-batch não foi necessário pra este escopo (2 fixes pontuais simples, ambos validados pelo build final).

## Resumo (200 palavras)

A Frente D (Settings + Clients + KAI Assistant + Automations) está com a base sólida pós-reorgs recentes. As 4 áreas funcionam end-to-end: SettingsTab carrega 13 sections via switch com permissões corretas e mutations OK; ClientEditDialog migrou os 9 tabs horizontais pra sidebar com 3 grupos lógicos e `CompletionDot` por section funcionando; KaiAssistantTab faz streaming SSE com reconciliation em caso de drop, ActionCards F0.3b+, tokens semânticos limpos no CitationChip e EnhancedMessageBubble; AutomationsTab divide schedule/feeds/workflows em sub-tabs canônicas e mantém PlanningAutomations + AiWorkflows isolados.

Dois bugs P1 foram corrigidos: (1) `ClientViralSettingsTab` referenciava labels de tabs antigas ("Tab Perfil", "Tab Digital") que não existem mais — substituídas pelos paths corretos da nova nav agrupada; (2) `AutomationsTab` não resetava `triggerFilter` ao trocar de sub-tab, causando empty state vazio em cenários de filtro persistido.

Visual tá consistente: `bg-muted`/`text-muted-foreground`/`text-primary` em todo lugar, sem slate/zinc/gray hardcoded no escopo. Mobile colapsa OK (settings sidebar vira chips, client edit idem). A11y básico cobre focus-visible + aria-labels. Build verde 6.08s. TODOs restantes são P2/P3 (lazy split, persistência de actionCards, prefs per-client schema).
