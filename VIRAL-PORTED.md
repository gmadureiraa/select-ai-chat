# VIRAL-PORTED.md

Estado da integração dos 3 apps virais standalone (Sequência Viral, Reels Viral, Radar Viral) dentro do KAI.

Branch: `combo-viral-integration`. Sem commits novos (regra do agente).

---

## TL;DR

Os 3 tabs do grupo "Viral" no sidebar (`viral-carrossel`, `viral-reels-page`, `viral-radar-page`) **deixaram de ser placeholders** e agora renderizam os tabs reais (`ViralSequenceTab`, `ViralReelsTab`, `ViralRadarTab`) que já existiam em `src/components/kai/` — apontados antes só pelos itens "Cliente" do menu (`sequence`, `reels`, `radar`).

Build OK · TypeScript clean.

## Trabalho que já estava feito (não tocado)

- `src/components/kai/ViralSequenceTab.tsx` — gerador de carrossel estilo Twitter (8 slides + imagens Pexels/IA + export PNG/PDF/ZIP + autosave + mandar pro Planejamento). Stack porta de `code/sequencia-viral/`.
- `src/components/kai/ViralReelsTab.tsx` — engenharia reversa de Reels: cole link IG → análise (porque viralizou + estrutura) + roteiro adaptado cena-a-cena + caption sugerida. Stack porta de `code/reels-viral/`.
- `src/components/kai/ViralRadarTab.tsx` — briefing diário cruzando notícias + YT + posts próprios → narrativas, hot topics, ideias de carrossel, cross-pollination. Stack porta de `code/radar-viral/`.
- `src/components/kai/viral-sequence/`, `viral-radar/`, `viral-hunter/` — submódulos com hooks/templates/utils de cada app.
- API handlers já portados:
  - `api/_handlers/generate-viral-carousel.ts`
  - `api/_handlers/publish-viral-carousel.ts`
  - `api/_handlers/adapt-viral-reel.ts`
  - `api/_handlers/generate-radar-brief.ts`

## O que esta sessão fez

### `src/pages/Kai.tsx`
1. Removidos os 3 imports lazy de placeholders (`ViralCarrosselPlaceholderTab`, `ViralReelsPlaceholderTab`, `ViralRadarPlaceholderTab`).
2. Os 3 cases (`case "viral-carrossel"`, `case "viral-reels-page"`, `case "viral-radar-page"`) agora renderizam respectivamente `ViralSequenceTab`, `ViralReelsTab`, `ViralRadarTab` com a mesma estrutura dos cases `sequence/reels/radar` (envolvido em `<div className="h-full overflow-hidden">`, `key={selectedClient.id}` para remount em troca de cliente, fallback "Selecione um cliente" quando nenhum cliente está ativo).

### Arquivos de placeholder
Renomeados para `.deprecated` (não importados em lugar nenhum, conforme a regra de não deletar antes de ter os tabs reais funcionais):
- `src/components/kai/ViralCarrosselPlaceholderTab.tsx.deprecated`
- `src/components/kai/ViralReelsPlaceholderTab.tsx.deprecated`
- `src/components/kai/ViralRadarPlaceholderTab.tsx.deprecated`

### DB schema
Tudo já estava no Neon — não precisou aplicar migration nova:
- `viral_carousels`, `viral_reels`, `viral_radar_briefs`, `viral_search_cache` — presentes
- Tabelas auxiliares (`client_viral_keywords`, `client_viral_competitors`, `instagram_posts`, `clients`, `kanban_columns`, `planning_items`, `client_content_library`) — presentes

Não foi criada `migrations/0003_viral_full.sql` porque nada estava faltando.

## Sidebar — duplicação intencional

Os items Viral agora aparecem **duas vezes** no sidebar:

- Grupo "**Viral**" (global, mais alto): `viral-library`, `viral-carrossel`, `viral-reels-page`, `viral-radar-page` — atalhos de "topo" pros geradores.
- Grupo "**Cliente**" (precisa workspace): `viral` (Hunter), `sequence`, `reels`, `radar` — items "antigos", gated pelo flag `canUseAssistant`.

Os dois grupos apontam pros mesmos componentes. Próximo passo (não pedido nesta missão) seria consolidar em um só lugar. Por ora os dois funcionam idênticos — o grupo "Viral" usa fallback "Selecione um cliente" se não houver client ativo.

## Completude por app (% do app standalone que foi portado)

| App | % portado | Notas |
|-----|-----------|-------|
| Sequência Viral | ~95% | UI completa (briefing, geração, slides editáveis, templates, export PNG/PDF/ZIP, autosave, save no Supabase, mandar pro Planning, publish IG via LATE). Falta: paywall Stripe (não aplica dentro do KAI) e algumas variações visuais minoritárias. |
| Reels Viral | ~85% | UI completa (input link, briefing, análise, script cena-a-cena, caption, salvar como ideia/library). Sem dashboard de métricas dos próprios reels gerados (existe no app standalone). |
| Radar Viral | ~75% | Dashboard de briefings (narrativas + hot topics + carousel ideas + cross-pollination), botões para virar carrossel/reel direto. Falta: páginas read-only de news/IG/YT/newsletters do app standalone (essas dependem de cron do `radar-viral` populando — ver `MEMORY.md`). O briefing on-demand funciona. |

## Bloqueios / TODOs futuros

- **Cron do Radar**: o app standalone tem cron diário `brief-daily` populando news/IG/YT/newsletters. Aqui no KAI o briefing é gerado on-demand pelo `generate-radar-brief` handler (que faz scrape ao vivo). Se quiser as views read-only do v2 standalone (Dashboard com news + IG + YT cards filtraveis), precisa criar tabelas `viral_news_articles`, `viral_youtube_videos`, etc + cron próprio no Vercel.
- **Sequência Viral imagem IA via Imagen 4**: hoje só tem Pexels + upload. Imagen 4 está implementado no app standalone mas não foi portado (handler `generate-image` do KAI gera com Gemini Imagen mas o stub no `SlideEditor.imageSearch.ts` não usa).
- **Reels Viral storyboard visual**: app standalone tem renderização visual de cada cena. Aqui está como texto estruturado.
- **Consolidação do menu**: sidebar tem dois grupos apontando pros mesmos tabs. Decidir qual manter.

## Critério pronto — checklist

- [x] 3 tabs reais funcionais (não placeholders)
- [x] `bun run build` passa
- [x] TypeScript clean (`bunx tsc --noEmit -p tsconfig.app.json` sem erros)
- [x] Schema viral aplicado no Neon (já estava)
- [x] Doc `VIRAL-PORTED.md` criado
- [x] Sem commits (regra do agente)
