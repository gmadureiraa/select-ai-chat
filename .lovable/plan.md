## Contexto

A API Late virou **Zernio** e tem muito mais do que usamos hoje. O `late-post` atual só publica feed + threads + carrossel Instagram. Vamos cobrir o universo completo de publicação Instagram (Feed/Story/Reel/Carousel + Trial Reels) e deixar a porta aberta pra novas plataformas e Inbox.

A imagem que você mandou é exatamente a UI que vamos replicar dentro do `PlanningItemDialog`: tabs **Feed / Story / Reel / Carousel** por plataforma + campos contextuais (trial reel, collaborators, first comment, custom thumbnail, custom caption).

---

## Fase 1 — Stories, Reels, Trial Reels e campos avançados Instagram (foco agora)

### 1.1 `late-post` (edge function)
Aceitar novo bloco `platformOptions` por plataforma. Para Instagram:

```ts
platformOptions: {
  instagram: {
    contentType: 'feed' | 'story' | 'reel' | 'carousel',
    shareToFeed?: boolean,         // Reel
    trialReel?: 'off' | 'manual' | 'auto',  // off=normal | manual=MANUAL | auto=SS_PERFORMANCE
    collaborators?: string[],       // até 3, sem @
    userTags?: { username, x, y, mediaIndex? }[],
    firstComment?: string,
    instagramThumbnail?: string,    // URL JPEG/PNG
    thumbOffset?: number,
    audioName?: string,
    customCaption?: string,         // override do content principal
  },
  facebook: { contentType: 'feed' | 'story' | 'reel', firstComment?: string },
  // outras plataformas escaláveis depois
}
```

Mapear pra `platformSpecificData.trialParams.graduationStrategy = "MANUAL" | "SS_PERFORMANCE"` quando `trialReel !== 'off'`. Validações:
- Story: 1 mídia, sem collaborators, sem firstComment
- Reel: vídeo 9:16, ≤90s
- Trial Reel: só permitido em Reel
- Carousel: 2-10 mídias

### 1.2 UI no `PlanningItemDialog`
Replicar layout da imagem:
- Tabs **Feed / Story / Reel / Carousel** por plataforma marcada
- Painel contextual abaixo:
  - **Reel:** dropdown "Trial Reel" (Off (regular) / Manual / Auto-graduate), input collaborators (max 3), first comment, upload de thumbnail, custom caption
  - **Story:** thumbnail opcional, custom caption (mesmo Stories ignorando texto, mantemos pro registro interno)
  - **Carousel:** collaborators, first comment, custom caption
  - **Feed:** collaborators, first comment, custom caption

Persistir tudo em `planning_items.metadata.platform_options` (jsonb, sem migration).

### 1.3 Indicador visual no card
Badge no Kanban/Calendar mostrando o tipo (📷 Feed / ⭕ Story / 🎬 Reel / 🎞 Carousel) e selo "🧪 Trial Reel" quando for o caso.

### 1.4 Chat KAI + MCP
- `publishContent` aceita `platformOptions`
- Novo MCP tool `publish_story` (atalho semântico)
- KAI entende: "agenda como story", "posta esse reel como trial pro Madureira", "publica o reel só no aba reels (não compartilha no feed)"
- Atualizar prompt do agente (camada de capabilities) com a nova matriz de tipos

### 1.5 `publish-viral-carousel`
Aceitar `contentType: 'story'` para publicar a sequência viral como Stories sequenciais (1 story por slide).

---

## Fase 2 — Plataformas novas (Bluesky, Pinterest, Snapchat) — opcional já

Cada plataforma adicional exige:
- Adicionar à enum `ALLOWED_PLATFORMS`
- OAuth via `late-oauth-start` (Zernio cuida do flow)
- Card de conexão na `SocialIntegrationsTab`
- `platformOptions` específico (ex: Pinterest precisa `boardId`, Snapchat tem `story / saved_story / spotlight`)

**Recomendação:** ativar **Bluesky + Pinterest** agora (custo zero), Snapchat sob demanda.

Reddit, WhatsApp, Telegram, Discord, Google Business — Fase 4 se você pedir.

---

## Fase 3 — Recursos avançados extras

- **LinkedIn documents (PDF)** — postar carrossel-doc
- **Twitter polls** — `poll: { options, durationMinutes }`
- **TikTok privacy + duet/stitch**
- **YouTube Shorts vs vídeo longo + visibility + playlist**
- **Threads reply controls**

Tudo via mesmo `platformOptions`, expansão incremental.

---

## Fase 4 — Inbox unificado (DMs + comentários)

Add-on pago da Zernio (~$10/mês). Permite responder DMs do Instagram, FB, X, LinkedIn dentro do kAI, plugado no `EngagementHub`. Webhooks `comment.received` e `message.received` viram notificações Telegram + bell. Fica pendente sua aprovação por causa do custo.

---

## Fase 5 — Analytics expandidos

`fetch-late-metrics` atual já roda; vamos somar:
- Reach, saves, profile clicks
- Instagram Account Insights + Follower History + Demographics
- YouTube demographics (idade/gênero/país)
- Google Business Performance (impressões, calls, directions) — útil se algum cliente tiver loja física

---

## Detalhes técnicos

**Arquivos principais a editar (Fase 1):**
- `supabase/functions/late-post/index.ts` — aceitar `platformOptions`, mapear `trialParams`, validar requisitos
- `supabase/functions/publish-viral-carousel/index.ts` — opção Stories
- `supabase/functions/kai-simple-chat/tools/publishContent.ts` — passar `platformOptions`
- `supabase/functions/mcp-reader/index.ts` — novo `publish_story` + parâmetros expandidos no `create_viral_carousel`
- `src/components/planning/PlanningItemDialog.tsx` — tabs por plataforma + painel contextual (espelha a UI da imagem)
- `src/components/planning/PlanningItemCard.tsx` — badge de tipo + selo Trial Reel
- `src/hooks/useClientPlatformStatus.ts` — flags `supportsStories`/`supportsReels`/`supportsTrialReels`

**Sem migrations** — tudo em `metadata.platform_options` (jsonb).

**Compatibilidade:** ausência de `platformOptions` mantém comportamento atual (feed). Zero risco para publicações existentes ou automações em curso.

**Memória do projeto:** vou atualizar `mem://features/publication/late-api-status-and-multi-platform` para refletir Zernio + matriz de tipos por plataforma.

---

## O que entra agora

Vou implementar **Fase 1 inteira** (Stories + Reels + Trial Reels + collaborators + first comment + custom thumbnail/caption + UI espelhada da imagem + chat + MCP + viral carousel como Story). É o que cobre 100% do uso pro Madureira.

Posso já incluir **Bluesky + Pinterest** (Fase 2) no mesmo pacote sem custo extra de complexidade — me avisa se quer.