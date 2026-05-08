# Viral Reels V2 — Port pro KAI

Port modular do app standalone `code/reels-viral/` (Next 16 + Neon Auth) pro
KAI App Combo (Vite + React 18 + Tailwind v4 + Shadcn). Vive em
`src/components/kai/viral-reels-v2/` em paralelo ao `ViralReelsTab.tsx`
antigo (que NÃO foi tocado — outro agente cuida da substituição).

## Como usar

```tsx
import ViralReelsV2 from "@/components/kai/viral-reels-v2";

<ViralReelsV2 clientId={clientId} client={client} />
```

`clientId` (string) e `client` (Client) são as mesmas props que
`ViralReelsTab.tsx` recebia — drop-in equivalent.

## Estrutura

```
viral-reels-v2/
├── index.tsx                          ← MainPanel (default export ViralReelsV2)
├── types.ts                           ← AdaptBrief, Scene, ReelRow, AdaptResponse
├── hooks/
│   ├── useReelAnalysis.ts             ← runAdapt() via apiInvoke('adapt-viral-reel')
│   └── useReelHistory.ts              ← TanStack Query: list/delete/saveAsIdea/saveToLibrary
├── components/
│   ├── URLInput.tsx                   ← Input link IG + botão "Colar"
│   ├── BriefForm.tsx                  ← Form completo (URL+tema+objetivo+CTA+persona+nicho)
│   ├── LoadingPipeline.tsx            ← 7 stages com timer (Apify→CDN→Gemini→...)
│   ├── AnalysisDisplay.tsx            ← Source card + análise + esqueleto 5 blocos
│   ├── ScriptCard.tsx                 ← Título + Hook + Roteiro + Storyboard + Caption
│   ├── StoryboardScene.tsx            ← Card individual de cena (n + tempo + papel + visual + copy + b-roll)
│   ├── Teleprompter.tsx               ← Overlay full-screen com auto-scroll
│   └── HistorySidebar.tsx             ← Sidebar com lista + status + delete
└── lib/
    ├── utils.ts                       ← extractShortCode, isValidInstagramUrl, formatNumber, formatDuration
    └── export-markdown.ts             ← buildMarkdown + downloadMarkdown
```

## Features cobertas (vs Reels Viral standalone)

- [x] Input link IG/TikTok com botão "Colar" (clipboard) + validação de shortCode
- [x] Form completo: tema, objetivo, CTA, persona, nicho
- [x] Pre-fill de nicho a partir de `client.industry`
- [x] Bridge Radar Viral via `?tema=` e `?briefing=` query params
- [x] Botão "Adaptar reel" → `apiInvoke('adapt-viral-reel', { clientId, ... })`
- [x] Loading pipeline com 7 stages animados (Apify → CDN → Gemini → ...)
- [x] Análise estrutural: resumo, "porque viralizou", esqueleto 5 blocos
      (hook/promessa/demonstração/provaSocial/cta), padrões transferíveis
- [x] Roteiro novo com título + hook destacado + texto corrido
- [x] Storyboard cena por cena (n, tempo, papel, visual, copy, b-roll)
- [x] Teleprompter overlay (play/pause/speed/fontSize/mirror + atalhos)
- [x] Caption sugerida + notas de produção
- [x] Histórico via TanStack Query (lista os reels do client de `viral_reels`)
- [x] Selecionar reel salvo → renderiza análise + script
- [x] Excluir reel
- [x] Salvar como ideia no Planning (`planning_items` insert)
- [x] Salvar na Library (`client_content_library` insert)
- [x] Download markdown completo (`buildMarkdown` + `downloadMarkdown`)
- [x] Copiar Hook / Roteiro / Caption / cada cena
- [x] `trackEvent("reel_analyzed")` mantido
- [x] Toasts via sonner

## Features removidas (não fazem sentido no KAI multi-tenant)

- Login wall (Better Auth), AuthDialog, AuthBar — KAI tem auth global
- Quota/paywall (`/api/quota`, QuotaBlockedModal) — controle de limite no KAI
  é por workspace/plan, não por reel
- Lead capture (`/api/lead`) — fluxo standalone só
- SV bridge (`openSvBridge` "virar carrossel") — KAI já tem ViralSequenceTab
  no mesmo workspace; user pode salvar como ideia e abrir lá manualmente
- Meta Pixel tracking (`trackSubscribe`, `trackCompleteRegistration`) —
  KAI tem analytics próprio
- Referral / Stripe / Cron — endpoints de gestão da conta no app público

## API contract

Handler já existe em `api/_handlers/adapt-viral-reel.ts`. Body esperado:

```ts
{
  clientId: string;       // FK pra clients.id
  sourceUrl: string;      // https://instagram.com/reel/...
  tema: string;
  objetivo: "leads" | "produto" | "seguidores" | "engajamento";
  cta: string;
  persona?: string;
  nicho?: string;
}
```

Response:

```ts
{
  ok: true;
  reelId: string;
  analysis: SourceAnalysis;
  script: AdaptedScript;
  sourceMeta: SourceMeta;
}
```

O handler:
1. Insere row pendente em `viral_reels` (status='processing')
2. Apify scrape → metadata + videoUrl
3. Download MP4 → upload pro Gemini File API
4. Gemini 2.5 Flash analisa + gera roteiro adaptado (JSON schema validado)
5. UPDATE da row com `status='done'`, `analysis`, `script`, `source_meta`,
   `duration_ms`
6. Retorna o JSON pro client

## Conversões Next 16 → Vite

| Next 16                              | Vite + React 18                       |
|--------------------------------------|----------------------------------------|
| `'use client'`                       | (removido)                             |
| `next/navigation useRouter()`        | `react-router-dom useNavigate()`       |
| `next/navigation useSearchParams`    | `react-router-dom useSearchParams`     |
| `next/image`                         | `<img>` (não usado neste port)         |
| `/api/adapt-reel` route (fetch)      | `apiInvoke('adapt-viral-reel')`        |
| `useNeonSession()` Better Auth       | `useAuth()` do KAI (Supabase adapter)  |
| `@neondatabase/serverless` direto    | `supabase.from('viral_reels')`         |
| CSS vars `--color-rv-*`              | Tailwind v4 + tokens KAI (`--primary`) |
| Geist Mono / Plus Jakarta Sans       | Tipografia padrão do KAI               |

## Build / Test

```bash
cd /Users/gabrielmadureira/GOS/code/kai-app-combo
bun run build       # passa ✓
bunx tsc --noEmit -p tsconfig.app.json    # zero erros em viral-reels-v2
```

Lint mostra alguns warnings cosméticos comuns no projeto, mas zero error
nos arquivos de `viral-reels-v2/`.

## Próximos passos (fora do escopo deste agente)

- O agente REPLACE-VIRAL é quem decide se substitui o `ViralReelsTab.tsx`
  pelo `ViralReelsV2` (alterando apenas o ponto de uso, ex.:
  `src/pages/Kai.tsx` ou onde quer que `<ViralReelsTab />` seja chamado)
- Migration de dados não é necessária — ambos leem da mesma tabela
  `viral_reels`
