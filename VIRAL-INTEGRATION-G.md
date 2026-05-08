# Viral Integration — Fase G (UX Polish)

**Branch:** `combo-viral-integration` (não commitada — outro agente cuida do merge)
**Data:** 2026-05-08
**Status:** done

Resumo executivo do que ficou pronto na Fase G — polishing de UX dos viral
tabs (SV/Reels/Radar) com foco em feedback visual de auto-save e drawer
expandido de contexto do cliente.

---

## Arquivos novos

### `src/hooks/useViralAutoSave.ts`

Hook genérico de auto-save pra rascunhos. Substitui os useEffects inline
duplicados em cada MainApp/create-new que persistem
`kai-viral-<tab>-draft-<clientId>` em localStorage.

API:

```ts
const autoSave = useViralAutoSave({
  key: `kai-viral-reels-draft-${clientId}`,
  data: { sourceUrl, tema, cta, persona, nicho, objetivo },
  enabled: !!clientId && step === "form",
  shouldPersist: (d) => d.sourceUrl.length > 0 || d.tema.length > 0,
  delay: 1000,            // default 1s
  storage: "local",       // "session" também aceito
});

// status: 'idle' | 'saving' | 'saved' | 'error'
// lastSavedAt: Date | null
// restore(): T | null   — hidrata on mount
// clear(): void          — limpa após submit success
```

Detalhes:
- Debounce interno (default 1s)
- `shouldPersist` opcional: quando `false`, limpa storage silenciosamente
- Tolerância retrocompat com drafts antigos sem wrapper (`{ data, savedAt }` vs `T` direto)
- `enabled` desliga o save (ex.: só persiste enquanto `step === "form"`)
- Não hidrata sozinho — quem chama decide via `restore()` quando aplicar

### `src/components/kai/viral/AutoSaveIndicator.tsx`

Indicador visual sutil ao lado do botão "Gerar":
- `saving`  → spinner (Loader2) + "Salvando..."
- `saved`   → check verde + "Salvo HH:MM" (some após 2s)
- `error`   → cloud-off vermelho + "Erro ao salvar" (persiste)
- `idle`    → não renderiza

Variant `light`/`dark` pra contraste em backgrounds dos viral apps. Usa
Tailwind básico, sem depender dos tokens dos apps. `role="status"` +
`aria-live="polite"` pra a11y.

### `src/components/kai/viral/ClientContextDrawer.tsx`

Drawer expandido (Sheet do shadcn portalizado pro `<body>`) com 4 tabs:

1. **Visão**     — descrição + persona (idade/dor/quer) + pilares
2. **Voz**       — tom + brand do/dont em colunas (verde/vermelho)
3. **Refs**      — grid 3-col de até 12 thumbs visuais (lightbox via `target=_blank`) + sites + documentos
4. **Histórico** — top 5 conteúdos com engagement_score + concorrentes

Mobile (`< 768px`): `side="bottom"` (bottom sheet 85vh).
Desktop: `side="right"` (right sheet w-md).

Trigger: botão `outline` com avatar pequeno + "Ver contexto" + chevron.
Logo do cliente vem de `client.tags.logo_url` (fallback iniciais).

Animações: `data-[state=active]:animate-in fade-in-50 slide-in-from-bottom-1`
em cada TabsContent.

---

## Arquivos modificados

### `src/components/kai/viral/ClientContextHeader.tsx`

- Avatar do cliente (5x5) substitui ícone Building2 genérico
- Badge de tom com Sparkles (visível só em `md+`)
- Botão "Ver contexto" abre o `ClientContextDrawer`
- Animação de entrada: `animate-in fade-in slide-in-from-top-1 duration-300`
- Responsividade: oculta indústria/tom em telas pequenas pra não quebrar

### `src/components/kai/viral/ClientReferencesPanel.tsx`

Expandido de 3 seções (visuals/library/competitors) pra 5:
- **Visuals** — agora com hover scale-105 sutil
- **Top conteúdos** — adicionou badge com `engagement_score` quando existe
- **Concorrentes** — mantido
- **Sites** — NOVO, link externo com ícone Globe
- **Documentos** — NOVO, lista nome + file_type com ícone FileText

Plus: header agora tem botão "Ver contexto" (ClientContextDrawer trigger)
no canto direito. Param `hideDrawerTrigger` pra esconder se necessário.

Animação de entrada: `animate-in fade-in duration-300`.

### `src/components/kai/viral-reels-original/MainApp.tsx`

- Removido bloco inline de auto-save (60 LoC) → substituído por `useViralAutoSave`
- `<AutoSaveIndicator />` adicionado ao lado do botão "Adaptar reel"
- `useMemo` envolve `draft` pra deep-compare estável

### `src/components/kai/viral-sv-original/pages-app/create-new.tsx`

- Removido bloco inline de auto-save (40 LoC) → substituído por `useViralAutoSave`
- `<AutoSaveIndicator />` adicionado ao lado do botão "Gerar carrossel"
- `autoSave.clear()` substitui o `localStorage.removeItem` no submit success

### `src/components/kai/MobileHeader.tsx`

Sem alterações — já mostra `clientName` quando disponível (vem do
`Kai.tsx` que passa `selectedClient?.name`). Indicador de cliente atual já
funciona em mobile sem mudança.

---

## Animações adicionadas

| Componente              | Animação                                                    |
|-------------------------|-------------------------------------------------------------|
| ClientContextHeader     | `animate-in fade-in slide-in-from-top-1 duration-300`       |
| ClientReferencesPanel   | `animate-in fade-in duration-300`                           |
| Visual ref thumbs       | `transition-transform hover:scale-105`                      |
| ClientContextDrawer Tabs| `data-[state=active]:animate-in fade-in-50 slide-in-from-bottom-1` |
| Top content cards       | `hover:bg-muted/50 transition-colors`                       |
| AutoSaveIndicator       | `transition-opacity duration-200`                           |
| Sheet (drawer)          | já vem do shadcn: slide-in/out 300-500ms                    |

Reels result-view + form-view já tinham `motion.section` com fade+y do
framer-motion — preservado.

---

## Mobile UX

- ClientContextDrawer detecta `useIsMobile` (< 768px) e usa `side="bottom"` automaticamente
- Trigger compacto: `<span className="hidden sm:inline">Ver contexto</span>` colapsa pra "Ctx" em mobile
- ClientContextHeader oculta `Cliente:`, indústria e tom em telas pequenas pra não quebrar layout
- Avatar do cliente sempre visível

---

## Build status

```
bun run build → ✓ built in ~9s
```

Sem erros. Sem warnings novos. Bundle do `useViralAutoSave-*.js` saiu em
~6.9KB (gzip 2.4KB) e `ClientContextHeader-*.js` em ~13KB (gzip 3.8KB)
incluindo o ClientContextDrawer.

---

## Próximos passos (não escopo Fase G)

- Fase H mexe em `src/components/kai/home/` — pode adicionar miniatura
  de cliente atual no dashboard usando o mesmo `useClientWorkspaceContext`
- Knowledge feedback loop (Fase I do plano original): o
  `ClientReferencesPanel` já mostra `engagement_score` no top library.
  Quando search-knowledge plugar embeddings, o painel pode ranquear por
  semântica relevante ao briefing.
- Integração com KAI brand-voice settings: `ClientContextDrawer` mostra
  tom/pillars/brand mas é read-only — clicar deveria deep-link pra
  `/clients/<id>/edit#voice`.

---

## NÃO FOI feito (por design)

- Nada em `viral-radar-original/components/ClientSourcesManager.tsx` (Fase E)
- Nada em `src/components/kai/home/*` (Fase H)
- Nada em billing/quotas
- Nenhum commit (deixado pro orchestrator)
