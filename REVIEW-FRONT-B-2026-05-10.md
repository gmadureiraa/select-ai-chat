# Review Frente B — Performance + Metricool Inbox + Library

**Data:** 2026-05-10
**Escopo:** `src/components/kai/performance-v2/**`, `src/components/metricool/MetricoolInboxPanel.tsx`, `src/components/kai/KaiLibraryTab.tsx`, `src/components/kai/library/**`, `src/components/references/**`, `src/components/clients/ClientReferencesManager.tsx` + hooks relacionados.

---

## Resumo executivo

Auditoria de Performance v2 (Metricool), Inbox unificado e Biblioteca passou. Achei **um bug crítico (P0)** no `KaiLibraryTab` que crasharia em runtime ao trocar de aba: `setSelectedItems(new Set())` era chamado mas a state nunca foi declarada (relíquia de feature de seleção em massa que nunca chegou). Strict mode desligado no `tsconfig` mascarou isso no build. Corrigido removendo a chamada órfã. Aplicada também série de melhorias P1: lazy loading em todas as imagens grandes (Library, ReferenceViewDialog, ContentPreviewDialog, CaseStudyGrid, KaiLibraryTab visuais), fallback `onError` consistente, navegação por setas no lightbox de imagens do `ContentPreviewDialog` (com hooks rule fix — early return depois dos hooks), `stopPropagation` no botão remover de `InboxQuickReplies` (evita disparar pick template ao remover), memoization em `PostsGrid` (sort) e `EngagementHeatmap` (grid 7×24 só rebuildava com posts/metric), e `onOpenChange` adapter em `ReferenceDialog`/`ReferenceViewDialog` pra ESC/click-outside funcionar. Performance v2 tá visualmente sólido — cards opacos, tokens semânticos, `branding.primaryHex` consistente cross-platform, tooltips/skeletons em todo loading state. Inbox header em 2 linhas e altura responsiva (`min(880,max(640,calc(100vh-13rem)))`) tão de pé. Build final: 6.13s, zero erros.

---

## Bugs encontrados

| ID | Sev | Arquivo | Bug | Status |
|----|-----|---------|-----|--------|
| B1 | P0 | `src/components/kai/KaiLibraryTab.tsx:142` | `setSelectedItems(new Set())` chamado em handler `onValueChange` da Tabs sem state declarada — `ReferenceError` em runtime ao trocar de aba | **fixed** — removido call órfão |
| B2 | P1 | `src/components/kai/library/ContentPreviewDialog.tsx` | Imagens sem `loading="lazy"` no carrossel; faltava reset de index ao trocar item; sem nav por seta | **fixed** — `useEffect` com keydown listener + reset, `loading="lazy"` |
| B3 | P1 | `src/components/metricool/InboxQuickReplies.tsx:127` | Botão "remover template" dentro de wrapper clicável: clicar no trash disparava `onPick` (insere template antes de deletar) | **fixed** — `e.stopPropagation()` no onClick |
| B4 | P1 | `src/components/references/ReferenceDialog.tsx`, `ReferenceViewDialog.tsx` | `onOpenChange={onClose}` passa `boolean` pra função sem args — quebra ao fechar via ESC/outside-click em alguns dialogs | **fixed** — adapter `(o) => { if (!o) onClose(); }` |
| B5 | P1 | múltiplos | Imagens grandes sem `loading="lazy"` em ReferenceViewDialog, KaiLibraryTab visuais, ContentCard, CaseStudyGrid | **fixed** — `loading="lazy"` + `onError` opacity-0 |

Nenhum bug visual residual nos cards: `bg-card` opaco, sombras `shadow-card`, badges com `branding.bgSolid` + `iconOnBgClass` pra contraste sempre legível dark/light. `MetricChartHero` usa `hsl(var(--border))` / `hsl(var(--popover))` no Recharts (theme-safe). `EngagementHeatmap` usa `branding.primaryHex` com opacity floor 0.15 (não desaparece em low-eng cells).

---

## Melhorias aplicadas

### Performance
- **`PostsGrid.tsx`** — `sortPosts(safe, sortBy)` agora memoizado via `React.useMemo` (rebuildava todo render externo quando parent invalidava query). Idem `getNetworkBranding(network)`.
- **`EngagementHeatmap.tsx`** — Grid 7×24 + counts + max agregados num único `useMemo([posts, metric])`. Antes rebuildava 168 cells a cada hover/refetch externo.
- **Imagens lazy** — `loading="lazy"` adicionado em: visuais da `KaiLibraryTab`, `ReferenceViewDialog` (3 spots), `ContentPreviewDialog` carrossel, `ContentCard` (medium + large), `CaseStudyGrid` thumbnails.

### a11y
- **`ContentPreviewDialog`** — `ArrowLeft`/`ArrowRight` agora navegam imagens quando `images.length > 1`. Listener montado só se `open && images.length > 1`. Reset index ao trocar `item.id` ou abrir.
- **InboxQuickReplies remove** — `aria-label` já presente; agora `stopPropagation` evita dupla ação.

### Estados
- Loading skeletons já cobriam todos os charts (`MetricChartHero` 320px Skeleton, `BestPostHighlight` 260px, `GrowthDelta` 140px, `EngagementHeatmap` 160px, `KPICard` interno, `PostsGrid` 6 cards, `PostsLeaderboard` 5 rows). Empty states presentes com microcopy contextual ("Sem posts no período", "Caixa vazia. Tudo respondido.", "Nenhuma plataforma com dados").
- Filtro ativo no `PostsLeaderboard` mostra `(N ocultos)` + badge `N filtrados` no card title.

### Robustez
- **Hooks rule fix** — `ContentPreviewDialog` tinha `if (!item) return null;` antes de `useEffect` que adicionei. Movi early return pra DEPOIS dos hooks (`images` calculado com optional chaining, hooks rodam sempre).

---

## TODOs P2 (não aplicado nesta passada)

| Item | Onde | Custo | Por quê não agora |
|------|------|-------|-------------------|
| Virtualização da lista do Inbox (`MetricoolInboxPanel`) | left pane usando `<ScrollArea>` direto | médio | `react-window` ou `@tanstack/react-virtual` add-dep — ScrollArea atual aguenta 200-300 items, polling 30s mantém flow leve |
| Virtualização do PostsGrid em `viewMode="list"` | rows compactas de 1 linha cada | médio | Paginação client-side (50/50) já cobre — só vira problema se `period=365d` com `>500` posts |
| Memoizar `decoratedRows` em `CrossPlatformComparison` | já tem `useMemo`, mas dep array tem 7 `*.data` + 7 `*.isLoading` — pesado | baixo | Funciona; refactor pra `Object.values(queries).map(q => q.data)` daria mais elegância |
| Error boundary nos charts (`MetricChartHero`, `CrossPlatformComparison`) | volta erro do `recharts` quando data malformada | baixo | Recharts é resiliente; nunca vimos crash em prod, mas seria bom |
| Dark mode test no `EngagementHeatmap` legend (5 swatches) | swatches `bg-emerald-100..500` no light, mantém saturação | baixo | `branding` quando passado já usa `primaryHex` com opacity — só fallback emerald ainda hardcoded |
| `ContentCard.tsx` cores hardcoded (`text-pink-500` etc) por plataforma | platform = brand color, não tem token semântico | baixo | Brand colors são canônicas — não precisa tokenizar |
| `KaiLibraryTab.tsx` busca interna não pega Visual References quando aba "visuals" — query externa pega só title/desc/type | filtro em `filteredVisualReferences` usa `searchQuery` correto, ok | nenhum | OK |
| Mobile chart hero — `MetricChartHero` em `<480px` aperta o eyebrow + total + delta. Header já é `flex-col md:flex-row` mas seletores ficam grandes | `min-w-0` no eyebrow, usar `text-2xl` no mobile | baixo | Aceitável, escala com responsividade |
| `withConcurrency` no Inbox bulk mark-as-read — só roda 3 paralelo (anti rate-limit) | já implementado — só observação | n/a | OK |

---

## Build final

```
✓ built in 6.13s
KaiLibraryTab-DD_bzfhv.js               68.65 kB │ gzip:  17.71 kB
MetricoolInboxPanel-D7se9VOX.js         24.62 kB │ gzip:   7.62 kB
MetricoolPerformance-0z2QwquM.js        75.96 kB │ gzip:  19.90 kB
```

Zero erros TS, zero warnings novos. Bundle do `KaiLibraryTab` aumentou ~0.4kB (efeitos + lazy image attrs). `MetricoolPerformance` estável.

---

## Arquivos tocados nesta passada

- `src/components/kai/KaiLibraryTab.tsx` — fix B1, lazy + onError no visual refs grid
- `src/components/kai/library/ContentPreviewDialog.tsx` — fix B2 (keyboard nav + reset + lazy + hooks rule)
- `src/components/kai/library/ContentCard.tsx` — lazy em medium e large
- `src/components/kai/library/CaseStudyGrid.tsx` — lazy + onError
- `src/components/metricool/InboxQuickReplies.tsx` — fix B3 (stopPropagation)
- `src/components/references/ReferenceDialog.tsx` — fix B4 (onOpenChange adapter)
- `src/components/references/ReferenceViewDialog.tsx` — fix B4 + lazy em 3 imgs
- `src/components/kai/performance-v2/components/PostsGrid.tsx` — useMemo sort + branding
- `src/components/kai/performance-v2/components/EngagementHeatmap.tsx` — useMemo grid 7×24

Não toquei (fora do escopo ou explicitamente proibido): `src/components/ui/`, `src/components/kai/viral-*-original/`, `src/components/planning/`, `src/components/library/UnifiedUploader.tsx` (subdep), `src/components/library/AttachmentsEditor.tsx`, hooks (`useMetricool*`, `useReferenceLibrary`, etc).
