# Frontend Polish — KAI 2.0

Pass de polish em UX/erros/loading no `combo-viral-integration`.
Build passa, TypeScript clean.

## 1. ErrorBoundary global

### Novo componente
`src/components/ErrorBoundary.tsx` (canônico).

- `componentDidCatch` loga `[ErrorBoundary]` e dispara `onError` opcional.
- Default fallback = tela inteira (botão "Tentar novamente" + "Recarregar página").
- `compact` prop = fallback contido (ideal pra tabs lazy).
- `context` prop = label opcional ("Tab: planning" etc).
- `getDerivedStateFromError` reseta corretamente.
- Já existia `src/components/ui/error-boundary.tsx` — mantido como legado.

### Wrap App
`src/App.tsx` agora envelopa toda a árvore com `<ErrorBoundary>` no topo. Se
qualquer provider/router crashar, o user vê a UI amigável em vez de tela
branca.

### Wrap tabs lazy
`src/pages/Kai.tsx`: o Suspense que renderiza tabs lazy agora vive dentro de
`<ErrorBoundary key={tab} compact context={...}>`. O `key={tab}` faz o boundary
resetar automaticamente ao trocar de tab — um erro num tab não persiste
visualmente ao navegar pra outro, e não derruba a app inteira.

## 2. Empty states ricos

Padronizamos via `EmptyState` (`src/components/ui/empty-state.tsx`, já
existia, com 4 variants ilustradas + ícone + título + descrição + ação).

### Melhorados (8 spots)

1. **`src/components/clients/ClientList.tsx`** — "Nenhum cliente cadastrado"
   agora usa `EmptyState` com ícone Users, descrição contextual sobre o que
   a feature destrava.
2. **`src/components/clients/ClientDocumentsManager.tsx`** — "Nenhum
   documento" agora usa `EmptyState` com ícone FileText e descrição
   explicando como o material vira contexto pra kAI.
3. **`src/components/planning/PlanningAutomations.tsx`** — "Nenhuma
   automação configurada" agora usa `EmptyState` com ação CTA "Criar
   primeira automação" embutida.
4. **`src/components/engagement/OpportunityFeed.tsx`** — "Nenhuma
   oportunidade encontrada" agora usa `EmptyState` com texto explicando o
   workflow (Buscar → kAI cruza palavras-chave → ranqueia).
5. **`src/components/posts/ImageGallery.tsx`** — loading agora é Skeleton
   grid em vez de "Carregando galeria…" texto solto.
6-13. **`src/pages/Kai.tsx`** — 8 placeholders idênticos "Selecione um
   cliente para X" foram consolidados num componente local
   `ClientRequiredEmpty` que usa `EmptyState` com ícone Users e mensagem
   contextual por tab (analytics, assistant, viral, sequence, reels,
   radar, viral-carrossel, viral-reels-page, viral-radar-page,
   client-dependent fallback).

## 3. Toast consistency

Mutations críticas que não tinham `onError` agora avisam o user via
`toast.error()` (sonner). Hooks fixed:

- **`src/hooks/useLinkedInPosts.ts`** — `useUpdateLinkedInPost`,
  `useImportLinkedInExcel` (2 mutations)
- **`src/hooks/useTwitterMetrics.ts`** — `useImportTwitterCSV`,
  `useFetchTwitterApify`, `useUpdateTwitterPost` (3 mutations)
- **`src/hooks/useYouTubeMetrics.ts`** — `useFetchYouTubeMetrics`,
  `useFetchYouTubeApify` (2 mutations)

Total: **7 mutations** agora têm feedback visual de erro além do
`console.error` que já existia.

A maioria dos catch em components já tinha toast — auditados:
`AutomationsTab`, `RSSImporter`, `UnifiedUploader`, `CarouselEditor`,
`PostPreviewCard`, `KaiAssistantTab`, `VoiceProfileEditor`,
`SyncToLibraryDialog`, `SmartCSVUpload`, `InstagramCSVUpload`,
`PostImagesManager`, `useExtractBranding`, `useClientWebsites`,
`useTeamMembers`, `useTeamTasks`, `usePlanningItems`,
`usePerformanceReport`. Tudo OK.

## 4. Skeleton screens

`ImageGallery.tsx` ganhou skeleton grid (6 cards aspect-square) no estado
de loading, em vez do "Carregando galeria…" textual. Outros queries com
loading já usavam Skeleton/spinners adequados (auditados:
`TeamManagement`, `NotificationSettings`, `PlanningItemComments`,
`OpportunityFeed`, `WorkspaceGuard`, `ClientList`, `ClientsListPage`,
etc).

## 5. Loading states em mutations

Auditados — a maioria já tem padrão correto:

- `WebhookSettings.tsx` — botão "Disparar" com `disabled={testing}` +
  texto "Enviando…".
- `TeamManagement.tsx` — botão "Salvar" com `Loader2 animate-spin` +
  texto "Salvando…".
- `BulkContentCreator.tsx` — botão "Gerar" com `Loader2 animate-spin` +
  texto "Gerando…".
- `ImageGallery.tsx` — botão "Gerar variação" com `isGeneratingVariation`
  state.
- `NotificationSettings.tsx` — switches com `disabled={isUpdating}` e
  Loader2 indicator.

## 6. Dark mode

KAI usa `defaultTheme="dark"` (forced, sem system). Auditados imports de
cores hardcoded — únicos `bg-white`/`text-white` encontrados são em
overlays sobre imagens (lightbox, carousel preview, paginadores em
modal escuro), onde é o comportamento correto. Badges/cards usam tokens
semânticos (`bg-card`, `text-foreground`, `bg-muted`) ou pares
`dark:bg-X` explícitos. Sem regressão.

## Critério de pronto

- [x] ErrorBoundary criado em `src/components/ErrorBoundary.tsx`
- [x] Wrap em App + tabs lazy (com key={tab} pra reset por tab)
- [x] 8+ empty states melhorados (8 no Kai.tsx + ClientList +
      ClientDocumentsManager + PlanningAutomations + OpportunityFeed +
      ImageGallery loading)
- [x] 7 mutations com toast.error agora (LinkedIn 2 + Twitter 3 +
      YouTube 2)
- [x] 1 skeleton novo (ImageGallery), demais já estavam OK
- [x] Loading states em mutations: já estavam consistentes em pontos
      auditados
- [x] `bun run build` passa em ~6.5s
- [x] `bunx tsc --noEmit` sem erros
- [x] Nada commitado (`git status` mostra modificações; sem novo
      commit conforme briefing)

## Arquivos modificados

### Novos
- `src/components/ErrorBoundary.tsx`

### Editados
- `src/App.tsx` — wrap ErrorBoundary
- `src/pages/Kai.tsx` — wrap ErrorBoundary nas tabs + ClientRequiredEmpty
- `src/components/clients/ClientList.tsx` — empty state rico
- `src/components/clients/ClientDocumentsManager.tsx` — empty state rico
- `src/components/planning/PlanningAutomations.tsx` — empty state rico + CTA
- `src/components/engagement/OpportunityFeed.tsx` — empty state rico
- `src/components/posts/ImageGallery.tsx` — skeleton grid no loading
- `src/hooks/useLinkedInPosts.ts` — onError + toast em 2 mutations
- `src/hooks/useTwitterMetrics.ts` — onError + toast em 3 mutations
- `src/hooks/useYouTubeMetrics.ts` — onError + toast em 2 mutations
