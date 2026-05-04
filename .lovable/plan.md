## Objetivo

Três entregas no Planning:

1. **Trial Reel × Feed** — seletor único no editor do card, com regra dura no backend: Trial Reel **nunca** vai para o feed.
2. **Cards coloridos no Board** conforme status (e demais opções já existentes em `colorBy`: cliente, plataforma, prioridade) — hoje a config existe em `Personalizar` mas não chega ao card.
3. **Personalizar realmente controla o card** — todos os toggles funcionam, mais 2 novos: **Responsável (com nome)** e **Formato**.

---

## 1. Seletor único Trial Reel × Feed

### Frontend — `src/components/planning/PlatformOptionsPanel.tsx`

Hoje, dentro de `igType === 'reel'`, há um `Switch` "Mostrar também no Feed" e um `Select` de Trial Reel separados — podem se contradizer. Substituir por **um único `Select` de "Distribuição"** com 4 opções mutuamente exclusivas:

- `feed` — Reel normal (aparece no Feed e em Reels)
- `profile_only` — Só na aba Reels (não vai pro Feed)
- `trial_manual` — Trial Reel: só não-seguidores, você promove depois
- `trial_auto` — Trial Reel: só não-seguidores, auto-promove se performar

Helpers exportados:
```ts
export type ReelDistribution = 'feed' | 'profile_only' | 'trial_manual' | 'trial_auto';
export function getReelDistribution(ig: InstagramOptions): ReelDistribution
export function applyReelDistribution(ig, dist): InstagramOptions
```

`applyReelDistribution` sempre escreve **ambos** os campos (`shareToFeed` e `trialReel`) garantindo consistência. `buildZernioPreview` força `shareToFeed=false` quando `trialReel !== 'off'`.

Aviso visual quando trial ativo: "🧪 Não aparece no Feed em hipótese alguma — só não-seguidores."

### Backend — `supabase/functions/late-post/index.ts` (linhas 451-461)

Guard final: se `igOpts.trialReel && igOpts.trialReel !== 'off'`, **forçar** `platformSpecificData.shareToFeed = false`, ignorando `igOpts.shareToFeed`. Protege cards antigos com config inconsistente.

---

## 2. Board colorido por status

### Tokens de status — `src/index.css` + `tailwind.config.ts`

Adicionar variáveis HSL semânticas (compat dark/light):
```
--status-idea, --status-draft, --status-review, --status-approved,
--status-scheduled, --status-publishing, --status-published, --status-failed
```

Mapear no `tailwind.config.ts` em `colors.status.{idea,draft,...}`.

### Propagação `viewSettings → card`

```text
PlanningBoard (já tem useViewSettings)
   │
   ├─ KanbanView          (nova prop: viewSettings, memberMap)
   │     └─ VirtualizedKanbanColumn
   │           └─ PlanningItemCard
   │
   ├─ CalendarView        (nova prop: viewSettings, memberMap)
   │     └─ PlanningItemCard
   │
   └─ PlanningListRow     (nova prop: viewSettings, memberMap)
```

### `PlanningItemCard.tsx`

Nova prop `viewSettings?: ViewSettings` e `memberMap?: Record<string, {name, avatar}>`.

Calcular `accentColor` a partir de `viewSettings.colorBy`:
- **status**: usa os novos tokens `hsl(var(--status-{item.status}))`
- **platform**: usa `PLATFORM_COLOR_MAP[primaryPlatform]`
- **priority**: high=destructive, medium=amber, low=blue
- **client**: hash determinístico do `client_id` → 1 de 8 hues HSL fixos

Aplicar como **barra lateral esquerda de 4px** no card (`borderLeftColor` inline), preservando o visual ClickUp atual (não conflita com borda superior das thumbs).

---

## 3. Personalizar — toggles funcionais + novos campos

### `ViewSettingsPopover.tsx`

Adicionar a `visibleFields`:
- `assigneeName: boolean` (padrão `false`) — mostra nome do responsável ao lado do avatar
- `format: boolean` (padrão `true`) — controla o badge de content type

Atualizar `defaultSettings` e `fieldLabels` (`assigneeName: 'Nome do responsável'`, `format: 'Formato'`).

### `PlanningItemCard.tsx` — respeitar **todos** os flags

| Flag             | O que controla no card                                  |
|------------------|---------------------------------------------------------|
| `format`         | Badge de content type (linha ~212)                      |
| `platform`       | Badges de plataforma (linha ~233)                       |
| `priority`       | `Flag` de prioridade no footer                          |
| `dueDate`        | Data no footer                                          |
| `client`         | Nome do cliente no footer                               |
| `status`         | `PublicationStatusBadge`                                |
| `autoPublish`    | Modo (auto/manual) dentro da badge de status            |
| `assignee`       | Avatar do responsável                                   |
| `assigneeName`   | Nome curto ao lado do avatar (`João S.`)                |
| `labels`         | Reservado (no-op por enquanto)                          |

Resolver nome via `memberMap` construído **uma vez** no `PlanningBoard` (`useTeamMembers` + `members.find(m => m.user_id === item.assigned_to)?.profile?.full_name`). Evita N queries.

Card mantém `memo()` — `viewSettings` é estável (vem do hook com `useState`), `memberMap` só muda quando membros do workspace mudam.

---

## Detalhes técnicos

- Sem migration de banco; tudo em memória/UI.
- Edge function: 3 linhas defensivas (1 if + 1 atribuição + comentário).
- Tokens novos seguem padrão HSL do design system (Linear dark + light variants).
- Default visual preservado: `format=true`, `assigneeName=false`, `colorBy=status` (já era o default).
- Para `colorBy=client`, hash simples: `Array.from(client_id).reduce((a,c)=>a+c.charCodeAt(0),0) % 8` → índice em paleta de 8 HSL.

## Arquivos alterados

- `src/components/planning/PlatformOptionsPanel.tsx` — seletor único + helpers exportados
- `supabase/functions/late-post/index.ts` — guard `trialReel ⇒ shareToFeed=false`
- `src/components/planning/ViewSettingsPopover.tsx` — novos campos no enum
- `src/components/planning/PlanningBoard.tsx` — passar `viewSettings` + `memberMap`
- `src/components/planning/KanbanView.tsx` — repassar props
- `src/components/planning/VirtualizedKanbanColumn.tsx` — repassar props
- `src/components/planning/CalendarView.tsx` — repassar props
- `src/components/planning/PlanningListRow.tsx` — respeitar `viewSettings`
- `src/components/planning/PlanningItemCard.tsx` — consumir `viewSettings`, `memberMap`, accent lateral
- `src/index.css` + `tailwind.config.ts` — tokens `--status-*`

## Fora de escopo

- Sistema de labels (apenas reservado o flag)
- Edição inline de assignee no card
- Cores customizáveis pelo usuário (paleta fixa por enquanto)
