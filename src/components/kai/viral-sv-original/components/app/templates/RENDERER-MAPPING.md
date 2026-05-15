# Renderer Template Mapping

Mapeamento entre os `renderer_template` declarados nos specs Camada 2 do vault
(`vault/99 - SISTEMA/format-standards/clients/<cliente>/<formato>.md`) e os
componentes React do KAI 2.0 que efetivamente renderizam o output.

Buckets:

| Bucket | Significado |
|---|---|
| **A. EXISTE_REAL** | Componente React já existente em `templates/`. Mapeia direto. |
| **B. TBD_EXPLICITO** | Lucas/cliente declarou "definir depois" com prefixo `tbd_*`. Sem ação até briefing. |
| **C. PIPELINE_EXTERNO** | Não é renderer SV — é pipeline de email/blog externo (Beehiiv, RD Station). |
| **D. META_LABEL** | Não é template visual — é indicador de tipo de output (texto-puro, vídeo, etc). |
| **E. CONCRETO_FALTANDO** | Era template visual real sem código. Implementado nesta Fase 4. |

## Tabela completa

| renderer_template (spec) | Bucket | Componente React | Alias em carousel-templates.ts | Pipeline alternativo | Notas |
|---|---|---|---|---|---|
| `manifesto` | A | `TemplateManifesto` | `manifesto` | — | Editorial premium cream + preto. |
| `madureira-reflection` | A | `TemplateMadureiraReflection` | `madureira-reflection` | — | 7 layouts via heuristics no body. Madureira IG carrossel. |
| `twitter` | A | `TemplateTwitter` | `twitter` | — | Screenshot de thread. Default fallback no renderer. Madureira x-thread. |
| `text_only` | D | — | — | Pipeline texto-puro (X single, X thread defiverso/lucas/madureira, LI post lucas/madureira) | Não tem renderer visual — o output é apenas string. Processado pelo distribute-output direto na plataforma. Cobre: defiverso/x-single, defiverso/x-thread, lucas-amendola/linkedin-post, lucas-amendola/x-single, madureira/linkedin-post, madureira/x-single. |
| `null` | D | — | — | Pipeline texto-puro | DSEC blog-longform, DSEC LI post, DSEC X single, DSEC X thread. DSEC nunca preencheu — equivale a `text_only`. Trata como D. |
| `text_only_with_images_mid` | D | — | — | Pipeline thread c/ mídia inline | Lucas x-thread. Não é template visual — sinaliza que o pipeline de Twitter precisa intercalar imagens nas posições do meio. |
| `roteiro_markdown_only` | D | — | — | Markdown export pra editor | Defiverso ig-reels. Roteiro de reels não vai pra renderer — vai direto pro markdown que o editor consome. |
| `video_export` | D | — | — | Pipeline export vídeo | Madureira ig-reels. Indicador "isso é vídeo, não slide" — output é arquivo .mp4 do CapCut/Descript, não do template engine. |
| `face_cam_with_burned_caption` | D | — | — | Pipeline edição vídeo manual | Lucas ig-reels. Indicador de formato de vídeo (face-cam + caption queimada no editor). Sem renderer. |
| `foto_crua_com_overlay` | D | — | — | Stories template manual | Lucas ig-story. Indicador "foto da câmera + overlay texto no IG Story editor". Sem renderer. |
| `tbd_lucas_template` | B | — | — | — | Lucas IG carrossel. Decisão visual pendente — Lucas precisa briefing pra definir paleta/tipografia próprias. Bloqueador. |
| `tbd_executive_serif` | B | — | — | — | Lucas LI carrossel. Mesma situação — placeholder declarado, sem decisão de design. Bloqueador. |
| `beehiiv-defiverso` | C | — | — | `scripts/send-defiverso-newsletter.ts` (a criar) → Beehiiv API | Defiverso newsletter. Output HTML/MD vai pra Beehiiv direto, não passa por renderer React do SV. |
| `rd_station` | C | — | — | RD Station API / Resend (existe template lá) | DSEC newsletter. Pipeline via RD Station — output do KAI vira email no RD Marketing. |
| `defiverso-ig-story-html` | C | — | — | HTML→PNG via Puppeteer dedicado (a criar) | Defiverso IG story 1080x1920. Aspect 9:16 diferente do canvas SV (4:5 1080x1350) — precisa template próprio fora do SV, não cabe no `TemplateRenderer`. Out of scope da Fase 4. |
| `dsec_design_system_dark` | E → A | **`TemplateDsecDark`** | `dsec-dark` | — | **IMPLEMENTADO nesta Fase 4.** DSEC LI carrossel. Dark bg + Inter 900 + Bitcoin orange accent + JetBrains Mono + verde elétrico pra dados. 4 variantes: cover/inner/quote/cta. Alias `dsec_design_system_dark` → `dsec-dark` em `normalizeDesignTemplate()`. |
| `defiverso-ig-carrossel-html` | E → A | **`TemplateDefiversoCarrossel`** | `defiverso-carrossel` | — | **IMPLEMENTADO nesta Fase 4.** Defiverso IG carrossel 1080x1350. Verde profundo + cream + accent amarelo (dados) + verde alien (bold). 3 variantes: cover/inner/cta. Body suporta prefixos `EYEBROW: <pilar>` e `FONTE: <nome>` pra eyebrow no topo e rodapé "Fonte: X". Alias `defiverso-ig-carrossel-html` → `defiverso-carrossel`. |

## Resumo executivo

**18 valores distintos de `renderer_template`** nos specs (incluindo `null`):

- **A (já existe):** 3 (`manifesto`, `madureira-reflection`, `twitter`)
- **B (TBD bloqueado):** 2 (`tbd_lucas_template`, `tbd_executive_serif`)
- **C (pipeline externo):** 3 (`beehiiv-defiverso`, `rd_station`, `defiverso-ig-story-html`)
- **D (meta-label, não é renderer):** 6 (`text_only` ×6, `null` ×4, `text_only_with_images_mid`, `roteiro_markdown_only`, `video_export`, `face_cam_with_burned_caption`, `foto_crua_com_overlay`)
- **E (implementado Fase 4):** 2 (`dsec_design_system_dark` → `TemplateDsecDark`, `defiverso-ig-carrossel-html` → `TemplateDefiversoCarrossel`)

## Como o loader resolve

```ts
// Em carousel-templates.ts → normalizeDesignTemplate()
// Aliases canônicos dos specs Camada 2 → DesignTemplateId interno:
"dsec_design_system_dark" → "dsec-dark"
"defiverso-ig-carrossel-html" → "defiverso-carrossel"
```

Strings que NÃO mapeiam (bucket B/C/D) caem no fallback `manifesto` quando
passadas pelo helper. Isso é OK porque:

- **Bucket D** (text_only, null, video_export, etc.) não chega ao `TemplateRenderer` —
  o pipeline de distribuição (Resend / Beehiiv / Apify upload / metricool post)
  ignora o renderer e usa diretamente o campo `body`/`script`.
- **Bucket C** (pipelines externos) tem seus próprios handlers via Edge Functions
  (`supabase/functions/process-scheduled-posts/index.ts`) ou n8n workflows
  externos — não passa por `TemplateRenderer`.
- **Bucket B** retorna fallback até Lucas decidir briefing visual.

## Bloqueadores pra produto decidir

1. **`tbd_lucas_template`** — Lucas IG carrossel: precisa briefing visual (paleta, tipografia, mood).
2. **`tbd_executive_serif`** — Lucas LI carrossel: precisa decisão (serif executive ou reaproveita `manifesto`?).
3. **`defiverso-ig-story-html`** — Defiverso IG Story (9:16): canvas diferente do SV, precisa engine própria ou patch no `CANVAS_W/H` por template.
4. **`beehiiv-defiverso` / `rd_station`** — confirmar quem vai operar os pipelines de envio (KAI cron, n8n, ou ação manual semanal?).

---

**Última atualização:** Fase 4 do sistema de padronização de conteúdo. Implementação dos 2 renderers do bucket E que mais clientes usam (DSEC + Defiverso). Lista de specs cobertos: 26 specs Camada 2 totais varridos em `vault/99 - SISTEMA/format-standards/clients/`.
