# Planning Integrations — 2026-05-10

Integrações cross-feature entre o módulo de Planning e os apps Sequência Viral / Reels Viral / Performance Dashboard / Reference Library, sem tocar nos arquivos do agente em paralelo (PlanningItemCard, VirtualizedKanbanColumn, CalendarView, PlanningBoard, usePlanningKeyboardShortcuts).

## Features novas

### 1. "Gerar Carrossel" a partir de card  ✅
Botão "Gerar Carrossel" no toolbar do `PlanningItemDialog` (cards `idea`/`draft` sem carrossel já gerado). Chama `/api/generate-viral-carousel` com `persistAs='carousel'` (não duplica planning_item — o card atual É o owner). Atualiza `metadata.viral_carousel_id` + `metadata.viral_carousel_slides` do planning_item, e seta backlink `viral_carousels.planning_item_id`. Após sucesso, banner "Editar no Sequência Viral" aparece automaticamente (já existente em `PlanningItemDialog.tsx@613-651`).

### 2. "Adaptar Reel" a partir de card  ✅
Botão "Adaptar Reel" abre o Reels Viral com briefing pré-populado via Zustand bridge (`useViralContext.setPendingBriefing`). Reels Viral só ADAPTA reel-fonte (precisa URL), então não dá pra gerar 1-shot — o user vai colar a URL no app já preenchido. O `MainApp.tsx` do Reels já consome `pendingBriefing` no mount inicial.

### 3. Performance Dashboard deep-link  ✅
Botão "Ver no Performance Dashboard" no `PlanningItemPerformance` (já renderizado no Dialog quando status='published'). Navega `?tab=performance&client=<id>&postId=<id>`. Métricas inline (likes/comments/shares/reach/impressions/saves/eng_rate) já existiam — mantidas intactas.

### 4. Auto-suggest de cliente  ✅
Banner amarelo "Talvez seja [Cliente] (X% match)" abaixo do select Cliente quando: (a) nenhum cliente está selecionado, (b) título tem 10+ chars, (c) score >= 25%. Heurística: tokenização PT-BR + jaccard contra (nome + descrição + context_notes + social handles + títulos das últimas 30 referências). Bonus 40% se nome do cliente aparece literal. Click atribui o cliente sugerido.

### 5. Painel "Inspirado em" (referências linkadas)  ✅
Painel no sidebar direito do Dialog com pílulas das refs em `metadata.related_references[]`. Click na pill abre `ReferencePopup` (existente). Botão "+ Adicionar" abre popover com search da biblioteca do cliente (limit 200 mais recentes). Persiste em `planning_items.metadata`.

### 6. Auto-link bidirectional Carrossel ↔ Planning  ✅ (já existia + reforçado)
- Direção Carrossel→Planning: `/api/generate-viral-carousel` com `persistAs='both'` já criava ambos e setava metadata + FK. Mantido.
- Direção Planning→Carrossel (item 1): minha integração nova preserva o backlink — UPDATE em `planning_items.metadata.viral_carousel_id` e `viral_carousels.planning_item_id`.
- TODO: surface "Origem: Planejamento #N" no header do SV editor (não feito — exige mexer em `viral-sv-original/pages-app/edit.tsx`, fora do escopo de "polish" do prompt).

### 7. Botão "Mover pra Library"  ✅ (já funcionava)
`onMoveToLibrary` em `usePlanningItems.moveToLibrary` (linhas 465-511) cria entry em `client_content_library` com `metadata.from_planning=true` + atualiza `planning_items.added_to_library + content_library_id`. Verificado funcional, sem alterações.

## Arquivos editados

- `src/components/planning/PlanningItemDialog.tsx`
  - linha 13: adicionado imports de ícones `Sparkles, Film, Lightbulb`
  - linhas 32-33: imports `usePlanningViralIntegration` + `useClientSuggestion`
  - linha 39: import `PlanningItemReferencesPanel`
  - linhas 184-191: hooks `usePlanningViralIntegration` + `useClientSuggestion`
  - linhas 619-680: bloco "Transformar em conteúdo viral" (botões Gerar Carrossel + Adaptar Reel)
  - linhas 818-836: banner amarelo de sugestão de cliente
  - linhas 992-1001: `PlanningItemReferencesPanel` no sidebar direito

- `src/components/planning/PlanningItemPerformance.tsx`
  - linha 19: import `LineChart` icon
  - linha 24: import `useNavigate`
  - linha 41: hook `useNavigate()`
  - linhas 180-200: botão "Ver no Performance Dashboard"

## Hooks/utils criados

- `src/hooks/usePlanningViralIntegration.ts` (~165 linhas)
  - `generateCarouselFromPlanning({ item, slideCount? })` — chama `/api/generate-viral-carousel`, persiste link bidirectional, invalida cache, toast com action "Abrir editor".
  - `sendToReelsAdapter({ item, sourceUrl? })` — empurra payload no `useViralContext` Zustand store + navega `?tab=viral-reels-page`.

- `src/hooks/useClientSuggestion.ts` (~115 linhas)
  - `useClientSuggestion(title, alreadySelectedClientId)` — debounce 400ms, jaccard tokens, bonus literal name match, threshold 25%. Cacheia refs de `client_reference_library` por 5min via TanStack Query.

- `src/components/planning/PlanningItemReferencesPanel.tsx` (~195 linhas)
  - Componente standalone que lê `metadata.related_references[]`, busca títulos via batch query, renderiza pílulas com ReferencePopup, picker via Popover com search.

## Wire-up cross-module

- **Planning → Sequência Viral:** API `/api/generate-viral-carousel` (já existente) + URL `/kaleidos?tab=viral-carrossel&client=<id>&carouselId=<id>` (já existente).
- **Planning → Reels Viral:** Zustand store `useViralContext.setPendingBriefing` + URL `/kaleidos?tab=viral-reels-page&client=<id>&url=<url>` (já existente).
- **Planning → Performance Dashboard:** URL `/kaleidos?tab=performance&client=<id>&postId=<id>` (parâmetro postId é novo; dashboard pode ignorar se não souber tratar — fallback puro = abrir tab).
- **Planning ↔ Reference Library:** queries diretas em `client_reference_library` via supabase client; persistência em `planning_items.metadata.related_references[]`.

## TODOs

- [ ] **SV dashboard backlink visual:** mostrar "Origem: planning #N" no header do `viral-sv-original/pages-app/edit.tsx` quando `viral_carousels.planning_item_id` existir. Fora do escopo "polish".
- [ ] **Performance Dashboard:** consumir `?postId=` query param e auto-scrollar pro post correspondente. Hoje só abre a tab.
- [ ] **Suggestion do cliente — UX:** considerar usar a busca direta de embeddings (`embed-client-content`) pra match semântico em vez de jaccard token. Hoje funciona pra títulos descritivos, mas falha em títulos puramente metafóricos.
- [ ] **Reels generation 1-shot:** se o produto do Reels Viral evoluir pra suportar generation a partir de briefing puro (sem reel-fonte), o `sendToReelsAdapter` pode virar `generateReelFromPlanning` e completar o ciclo simétrico do carrossel.

## `bun run build` resultado

```
✓ built in 6.04s
```

Build limpa com warnings só de chunk-size (pré-existentes). 0 erros TS introduzidos pelas mudanças (tsc reporta erros apenas em arquivos pré-existentes não tocados: `SocialIntegrationsTab`, `KaiLibraryTab`, `MetricChartHero`, `InstagramDashboard`, `PlanningBoard`, `AuditLogSettings`).
