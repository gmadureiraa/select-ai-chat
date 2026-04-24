
# Plano: Resolver tudo do fluxo Jornal Cripto → Carrossel Viral → Instagram

Contexto: hoje o pipeline está quase ponta-a-ponta, mas tem 4 problemas críticos visíveis em produção:

1. **Mesma notícia gera 3+ carrosséis duplicados** (11h, 12h, 13h do mesmo "Tether Congela US$ 344M") — o RSS guarda `last_guid` mas a checagem está comparando com a URL da notícia, não com o GUID real do item.
2. **Run das 14h falhou com 503** — `kai-content-agent` deu timeout, sem retry.
3. **Card do Planejamento não mostra o carrossel** — só texto bruto concatenado, não há thumb dos 8 slides nem botão "Editar no Sequência Viral".
4. **Publicar no Instagram** ainda é stub — falta exportar PNGs server-side e disparar LATE.

Além disso, vamos reforçar o layout estilo jornal e simplificar a UX.

---

## Etapa 1 — Dedup de RSS (resolve duplicação na origem)

Inspecionar o branch RSS no `process-automations` e garantir que `last_guid` use o `<guid>` ou `<link>` do **item específico** (já parece guardar isso, mas a query mostra `last_guid` apontando pra URL antiga do "Circle/Aave" enquanto a automação processou "Tether" — isto é, a comparação está falhando).

Mudanças:
- Garantir que a feed entry mais recente seja comparada por `entry.guid || entry.link` exato e que **só dispare se diferente**.
- Adicionar `dedup_window_hours: 24` no `trigger_config` — mesmo que GUID mude, se já houver um `viral_carousel` criado por essa automação nas últimas 24h com `title` muito similar (Levenshtein > 0.85), pular.
- Atualizar `last_guid` **antes** de chamar o gerador (não depois) pra evitar race em runs concorrentes.

## Etapa 2 — Resiliência do gerador (resolve o 503)

- `generate-viral-carousel` já chama `kai-content-agent` sem retry. Adicionar **retry exponencial** (3 tentativas: 0s, 2s, 5s) quando recebe 5xx ou timeout.
- Aumentar timeout do `fetch` interno para 120s.
- Em caso de falha total: marcar a `planning_automation_run` como `failed` mas **não** atualizar `last_guid`, pra que o próximo run reprocesse a mesma notícia automaticamente.

## Etapa 3 — Layout editorial "estilo jornal" no slide 1

O slide 1 já tem `imageAsCover`, mas o usuário pediu "página apenas com a notícia, subtítulo dela e a imagem". Hoje o briefing pede uma manchete única — vamos:

- Adicionar `subtitle` opcional ao `ViralSlide` (apenas usado quando `imageAsCover=true`).
- No prompt do `generate-viral-carousel`, pedir para o slide 1 retornar `{ headline: string, subtitle: string }` em vez de `body` simples.
- No `TwitterSlide`, quando `imageAsCover=true` renderizar:
  - **Topo**: pequeno selo "JORNAL CRIPTO · ANÁLISE" (vem do `client.name`).
  - **Centro/Bottom**: headline em fonte grande (peso 800, ~80px), subtitle em fonte menor (peso 500, ~36px) abaixo.
  - **Rodapé**: atribuição "Foto: domínio do link" (parseado de `imageAttribution`).
- Ajustar `coverTextStyle` defaults: `position=bottom`, `overlay=strong`, gradiente vai do transparente no topo a 95% preto no bottom — garante legibilidade independente da imagem.

## Etapa 4 — Pipeline de imagem mais robusto

Hoje só o slide 1 ganha imagem. Para um carrossel "tipo jornal" do Instagram, ajuda ter imagem em mais slides.

- No `generate-viral-carousel`:
  - Cachear cover image no Storage (já feito) e armazenar `cached_url` no `triggerData` da run pra reaproveitar em runs futuros.
  - **Slide 2** também recebe a mesma imagem cacheada, mas em layout normal (imagem como anexo abaixo do texto, não como cover) — dá continuidade visual.
  - **Slide 8 (CTA)** recebe a imagem em modo `imageAsCover` com overlay forte e o texto do CTA — fecha o carrossel com retorno visual.
  - Demais slides (3-7) ficam só com texto, mais fáceis de ler.
- Se a URL do RSS for inválida/404: fallback SVG continua existindo (já funciona).

## Etapa 5 — Card do Planejamento mostra o carrossel de verdade

Hoje o `planning_items.content` recebe os 8 slides concatenados como texto. Mostrar isso num card é ruim.

- No `PlanningItemCard`: detectar `metadata.viral_carousel_id` e mostrar:
  - **Thumb** do slide 1 (usa o `image.url` salvo no `metadata.viral_carousel_slides[0].image.url`).
  - **Badge azul** "Carrossel Viral · 8 slides".
  - **Headline** do slide 1 truncada.
- No `PlanningItemDialog`: quando carrossel viral, em vez do `RichContentEditor` mostrar:
  - Mini-grid dos 8 slides (re-renderiza `TwitterSlide` em `scale=0.12`).
  - Botão grande **"Editar no Sequência Viral"** → `navigate(/kaleidos?client=X&tab=sequence&carouselId=Y)`.
  - Botão **"Baixar ZIP (1080×1350)"** → chama `exportCarouselAsZip` no client com offscreen render.
  - Botão **"Publicar no Instagram"** → ver Etapa 6.

## Etapa 6 — Publicar no Instagram via LATE (server-side)

O fluxo correto pra `viral_carousel`:

1. Nova edge function `publish-viral-carousel`:
   - Recebe `{ carouselId, scheduledAt? }`.
   - Renderiza os 8 slides como PNG **no servidor** usando `satori` + `resvg-wasm` (ou via puppeteer se Lovable tiver suporte; satori é a opção zero-deps que funciona em Deno).
   - Faz upload de cada PNG no bucket `social-images/instagram-carousel/{carouselId}/slide-{n}.png`.
   - Pega URLs públicas e dispara `late-post` com `platform=instagram`, `mediaUrls=[...]`, `text=<caption gerada do slide 1 + CTA do slide 8>`.
   - Atualiza `planning_items.status='scheduled'` ou `'published'`, salva `late_id` no metadata.
2. Botão **"Publicar no Instagram"** no card do Planejamento e no `ViralSequenceTab` chama essa função.
3. Caption sugerida: headline do slide 1 + 2 linhas do slide 8 (CTA) + atribuição da foto. Sem hashtags por padrão (memória do projeto proíbe em Twitter/Threads, IG é mais permissivo mas vamos manter limpo).

> **Decisão técnica**: server-side rendering com Satori é melhor que disparar puppeteer headless (Lovable Cloud não tem). Satori entende JSX-like e gera SVG → resvg converte pra PNG. Os componentes de slide ficam num módulo `_shared/satori-templates.ts`.

## Etapa 7 — Limpeza e teste

- Limpar todos os `viral_carousels` e `planning_items` duplicados criados hoje (Tether x3, Circle x2).
- Resetar `last_guid` da automação Jornal Cripto pra reprocessar a notícia mais recente.
- Disparar manual run da automação e verificar:
  - Carrossel novo aparece com slide 1 capa + slide 2 imagem anexa + slide 8 CTA cover.
  - Card no Planejamento mostra thumb + badge.
  - Botão "Publicar no Instagram" gera PNGs e dispara LATE (em modo dry-run primeiro).

---

## Detalhes técnicos

### Arquivos novos
```
supabase/functions/publish-viral-carousel/index.ts   # render satori + LATE
supabase/functions/_shared/satori-slide.ts           # template JSX-like
supabase/migrations/<ts>_viral_subtitle_field.sql    # noop (subtitle vai dentro de slides JSONB)
src/components/planning/ViralCarouselCardPreview.tsx # thumb + badge no card
src/components/planning/ViralCarouselDialog.tsx      # mini-grid + ações no dialog
```

### Arquivos editados
```
supabase/functions/process-automations/index.ts
  - Branch RSS: comparar last_guid corretamente, atualizar antes do generate
  - Adicionar dedup_window_hours check antes de disparar viral_carousel
  - Reset last_guid em caso de failed

supabase/functions/generate-viral-carousel/index.ts
  - Retry exponencial em callContentAgent (3 tentativas)
  - Slide 1: prompt pede {headline, subtitle}; mapear pra body com **bold**
  - Slide 2: anexa cover image (modo normal)
  - Slide 8: imageAsCover=true com a mesma cover

src/components/kai/viral-sequence/types.ts
  - ViralSlide ganha campo `subtitle?: string`

src/components/kai/viral-sequence/TwitterSlide.tsx
  - Quando imageAsCover && subtitle: render layout editorial (selo + headline + subtitle + crédito)

src/components/planning/PlanningItemCard.tsx
  - Detecta metadata.viral_carousel_id → renderiza ViralCarouselCardPreview

src/components/planning/PlanningItemDialog.tsx
  - Detecta carrossel → renderiza ViralCarouselDialog em vez do editor padrão
```

### SQL de limpeza (Etapa 7)
```sql
DELETE FROM planning_items 
WHERE metadata->>'content_type' = 'viral_carousel' 
  AND created_at > '2026-04-23';

DELETE FROM viral_carousels 
WHERE source = 'automation' AND created_at > '2026-04-23';

UPDATE planning_automations 
SET trigger_config = trigger_config || jsonb_build_object('last_guid', NULL)
WHERE content_type = 'viral_carousel';
```

### Validação
1. Disparar a automação Jornal Cripto manualmente via `supabase.functions.invoke('process-automations')`.
2. Confirmar que UM novo carrossel foi criado.
3. Abrir o Planejamento e verificar o card com thumb + badge.
4. Clicar em "Editar no Sequência Viral" → ver os 8 slides com slide 1 capa + slide 2 com imagem + slide 8 CTA cover.
5. Clicar em "Publicar no Instagram" em modo dry-run → verificar que os PNGs foram gerados no Storage e a chamada LATE retornou `scheduled_at`.

---

## Resumo do impacto

- **Para de duplicar** carrosséis da mesma notícia.
- **Para de quebrar** quando o agent demora > 30s.
- **Slide 1 vira "capa de jornal" de verdade** (headline + subtitle + imagem + crédito).
- **Card do Planejamento** mostra o carrossel visualmente, não texto solto.
- **Botão único de publicar no Instagram** funciona ponta-a-ponta — gera PNGs server-side e agenda via LATE.

Tudo isso usando o que já existe (Satori roda em Deno, LATE já está integrado, Storage `social-images` já existe). Sem secrets novos.
