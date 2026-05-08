# Viral Integration — Fase A.2 + B (FRONTEND)

**Branch:** `combo-viral-integration` (NÃO commit ainda — outro agente paralelo trabalha em backend)
**Data:** 2026-05-08
**Escopo:** Pre-fill de cliente nos 3 viral apps + bridge cross-app via Zustand
**Status:** Implementado; build (`bun run build`) verde; tsc sem novos erros

---

## 1. Resumo

Os 3 viral apps (Sequência Viral / Reels Viral / Radar Viral) que vivem como tabs do KAI agora:

1. **Leem o cliente atual** (vindo de `Kai.tsx` via props `{ clientId, client }`).
2. **Pre-fill** tom/persona/refs no form de criação.
3. **Header contextual** mostra "Cliente: NOME · Indústria · tom: editorial" no topo.
4. **Painel de refs** (visuais + top library + concorrentes) durante a criação.
5. **Cross-app bridge** via Zustand: cards do Radar com botões "→ Carrossel" / "→ Reel" disparam navigate para a outra tab + carregam o briefing automaticamente.
6. **Auto-save por cliente** em localStorage (key namespacing `kai-viral-{tab}-draft-{clientId}`).

Estética dos 3 apps preservada — não toquei em CSS dos viral apps. Componentes novos usam Tailwind básico ou inline-styles neutros que funcionam dentro de scope `sv-*` / `rv-*` / `rdv-*`.

---

## 2. Arquivos criados

### `src/store/viral-context.ts`
Zustand store com `pendingBriefing` + `setPendingBriefing` + `consumePendingBriefing` (consume-once, idempotente). Tipos `ViralBridgeSource` (`'radar' | 'reels' | 'sv' | 'manual'`) e `PendingBriefingPayload` ({ source, topic?, briefing?, url?, metadata? }).

### `src/components/kai/viral/lib/use-client-workspace-context.ts`
Hook TanStack Query carregando em paralelo: clients, client_preferences, client_websites, client_documents, client_visual_references, client_content_library (top 50), client_viral_competitors, client_viral_keywords. staleTime 5 min, disabled quando `clientId` é null. Decodifica `client_preferences` key/value para tone (string), pillars (string[]), persona ({age, pain, goal}), brand ({do[], dont[]}).

**Nome diferente** (`useClientWorkspaceContext`) para não colidir com o legacy `useClientContext` em `src/hooks/useClientContext.ts` (usado pelo AIContextTab via apiInvoke). Quando o BACKEND agent definir o nome canônico, basta trocar imports.

### `src/components/kai/viral/CrossAppActions.tsx`
Componente reusável com 3 botões `[→ Carrossel] [→ Reel] [Ideia]` opt-in via props (`showCarrossel`, `showReel`, `showIdea`). Click "Carrossel" / "Reel" → seta `pendingBriefing` no Zustand + navega `?tab=viral-carrossel` ou `?tab=viral-reels-page`. Click "Ideia" → toast (Fase C cria planning_item).

### `src/components/kai/viral/ClientContextHeader.tsx`
Banner fino "Cliente: NAME · Industry · tom: ..." renderizado no topo de cada viral app. Variants `light` (cream paper bg) e `dark` (rec/coral overlay) para combinar com Radar dark sidebar quando aplicável.

### `src/components/kai/viral/ClientReferencesPanel.tsx`
Card minimalista com refs visuais (3 thumbs em grid 3x1), top conteúdos da library (3 itens com content_type prefix) e concorrentes (chips). Skip render se nenhuma das 3 sections tem dados.

---

## 3. Arquivos modificados

### `src/components/kai/viral-reels-original/MainApp.tsx`
- Imports: useClientWorkspaceContext, ClientContextHeader, ClientReferencesPanel, CrossAppActions, useViralContext.
- `useClientWorkspaceContext(clientId)` carrega contexto.
- Pre-fill `nicho` do industry (já existia, mantido) + persona derivada de `client_preferences.persona_*`.
- localStorage `kai-viral-reels-draft-${clientId}` — hidrata e persiste durante step "form"; limpa em "result".
- `useViralContext.getState().consumePendingBriefing()` no useEffect inicial: pega payload de Radar/SV (url IG / topic / briefing → cta).
- Wrap `<ClientContextHeader>` no topo + `<ClientReferencesPanel>` abaixo do form.
- ResultView agora recebe `crossActions={<CrossAppActions source="reels" ... />}` no slot novo (showReel=false porque já está no Reels).

### `src/components/kai/viral-reels-original/components/result-view.tsx`
- Adicionada prop opcional `crossActions?: ReactNode` na top strip de ações. Mantém ResultView agnóstico do KAI (em standalone Reels Viral o slot fica vazio).

### `src/components/kai/viral-sv-original/MainApp.tsx`
- Imports useClientWorkspaceContext + ClientContextHeader.
- Carrega context + renderiza header acima do `<Suspense>` que monta as pages internas.
- `display: flex; flexDirection: column` no `.sv-root` pra header empilhar acima das pages.

### `src/components/kai/viral-sv-original/pages-app/create-new.tsx`
- Imports useSVClient, useClientWorkspaceContext, ClientReferencesPanel, useViralContext.
- consumePending no useEffect inicial — popula `idea` com merge de topic+briefing+url; toast de origem.
- Pre-fill `tone` mapeando `clientCtx.tone` (preference_value) para o enum local (editorial/informal/direto/provocativo). Override do tone do user profile porque carrossel é PARA o cliente.
- localStorage `kai-viral-sv-draft-${clientId}` — hidrata (idea), persiste (idea trimmed >= 8 chars), limpa em sucesso.
- `<ClientReferencesPanel>` antes do botão "Gerar carrossel".

### `src/components/kai/viral-radar-original/MainApp.tsx`
- Imports useClientWorkspaceContext + ClientContextHeader.
- `RadarShell` recebe `clientId` como prop (antes era ignorado, marcado com `_clientId`).
- Carrega context (informativo só — Radar opera por nicho global) e renderiza header sob o mobile header.

### `src/components/kai/viral-radar-original/components/top-news-section.tsx`
- Import CrossAppActions.
- NewsCard renderiza `<CrossAppActions source="radar" topic={article.title} url={article.link} ... showReel={false}>` ao lado dos botões nativos (abrir/salvar). Reels desabilitado pra news (faz mais sentido carrossel SV).

### `src/components/kai/viral-radar-original/components/top-instagram-section.tsx`
- Import CrossAppActions.
- Removidos os links externos legacy `Carrossel SV` / `Reel RV` que abriam URLs `viral.kaleidos.com.br` / `reels-viral.vercel.app`.
- Substituídos por `<CrossAppActions source="radar" topic={post.caption} url={igUrl} showIdea={false}>` que navega INTRA-KAI via Zustand.

### `src/components/kai/viral-radar-original/components/top-youtube-section.tsx`
- Import CrossAppActions.
- YouTubeCard renderiza `<CrossAppActions source="radar" url={video.link} showReel={false}>` (Reel não faz sentido pra YouTube long-form).

---

## 4. Dependências adicionadas

```json
"zustand": "^5.0.13"  // bun add zustand
```

---

## 5. Build status

- `bun run build`: **verde** (8.5s, sem novos warnings)
- `npx tsc --noEmit`: 30 erros TS pré-existentes em `viral-sv-original/lib/*`, `viral-sv-original/pages-app/login.tsx`, `ViralRadarTab.legacy.tsx` etc. Nenhum erro nas minhas mudanças.

---

## 6. Pendências / handoff

### Para o BACKEND agent:
- O hook ficou em `src/components/kai/viral/lib/use-client-workspace-context.ts` (nome `useClientWorkspaceContext`) para evitar colisão com `src/hooks/useClientContext.ts` (legacy AIContextTab). Quando o BACKEND criar o canônico em `src/hooks/useClientContext.ts` com a mesma shape, basta:
  1. Mover/duplicar o conteúdo lá
  2. Trocar 3 imports nos viral MainApps + create-new.tsx + Radar
  3. Deletar este arquivo
- Os endpoints `generate-viral-carousel` / `adapt-viral-reel` precisam aceitar `clientId` no body e injetar tone/pillars/persona/brand no system prompt do Gemini (Fase A.3 do plano).

### Para Fase C (próximo agente):
- `CrossAppActions` action "Ideia" hoje só dá toast. Trocar por chamada que insira `planning_item { client_id, workspace_id, status: 'idea', content_type: 'other', metadata: { source: 'radar', topic, url, briefing } }`.

### Não implementado (fora do escopo desta sub-task):
- Match de keywords / competitors no Radar feed (Fase E.4) — exige tabelas populadas + filtro server-side.
- Filter por `client_id` OR `is_global` em queries Radar (Fase E) — precisa mudança nos endpoints `/api/radar-data-*`.
- Fase D (knowledge feedback loop com embeddings).

---

## 7. Critérios de pronto (do prompt original)

- [x] 3 viral tabs leem context e fazem pre-fill
- [x] Zustand store + CrossAppActions reusável
- [x] Botões cross-app em cards Radar (news, instagram, youtube) + Reels (result-view via slot crossActions)
- [x] Consumo de pendingBriefing em SV + Reels (useEffect mount)
- [x] ClientContextHeader em todos os 3 tabs
- [x] Auto-save por cliente (localStorage namespaced)
- [x] `bun run build` passa
- [x] Documento (este arquivo)
