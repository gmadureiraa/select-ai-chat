# Automação de Performance — Coleta automática de métricas

## Situação atual

Já existe infra parcial:
- Tabela `platform_metrics` (likes, comments, shares, views, engagement, subscribers) com upsert único por `(client_id, platform, metric_date)`.
- Edge functions Apify já rodando: `fetch-instagram-metrics`, `fetch-twitter-apify`, `fetch-youtube-apify`, `extract-instagram`, `batch-sync-posts`.
- Tokens Apify configurados: `APIFY_API_TOKEN`, `APIFY_API_TOKEN_2`, `APIFY_API_KEY`, `APIFY_API_KEY_INSTAGRAM`.
- Padrão de cron via `pg_cron` + Vault (`cron_service_role_key`, `project_url`) já em uso (process-push-queue).

**O que falta:** disparo automático recorrente. Hoje é tudo manual via botão na UI. Não existe TikTok nem LinkedIn público scraper, nem orquestrador único.

---

## O que fica gratuito vs pago

### Gratuito (APIs oficiais públicas)
- **YouTube Data API v3** — 10.000 unidades/dia grátis. Cobre estatísticas de canal e vídeos públicos sem custo. Já temos `fetch-youtube-metrics` (oficial) além do Apify. **Recomendação: priorizar a oficial, Apify só como fallback.**
- **RSS / oEmbed** — útil para Threads/Beehiiv (já usado).

### Sem alternativa gratuita confiável (precisa scraper/Apify)
- **Instagram** — não há API pública para perfis de terceiros. Graph API só funciona com conta business conectada via OAuth do dono. Para dados públicos: Apify é o caminho.
- **TikTok** — API oficial exige aprovação demorada e só dá dados do dono autenticado. Públicos: Apify.
- **X (Twitter)** — API oficial v2 é paga (Basic US$ 200/mês). Para dados públicos: Apify (já temos).
- **LinkedIn** — API oficial não permite scraping de perfis/empresas de terceiros. Apify é a única via prática (e com mais risco de bloqueio).

### Estimativa de custo Apify (plano Starter US$ 49/mês = US$ 49 em créditos)

Custos médios por actor (preço de mercado em compute units, arredondado):

| Plataforma | Actor recomendado | Custo médio | 1 cliente / dia | 10 clientes / dia | 10 clientes / mês |
|---|---|---|---|---|---|
| Instagram (perfil + últimos 12 posts) | `apify/instagram-scraper` | ~US$ 2,30 / 1.000 itens | ~US$ 0,03 | ~US$ 0,30 | **~US$ 9** |
| TikTok (perfil + últimos 10 vídeos) | `clockworks/tiktok-scraper` | ~US$ 0,30 / 1.000 itens | ~US$ 0,01 | ~US$ 0,10 | **~US$ 3** |
| X (perfil + últimos 20 tweets) | `apidojo/twitter-scraper-lite` | ~US$ 0,40 / 1.000 itens | ~US$ 0,01 | ~US$ 0,10 | **~US$ 3** |
| LinkedIn (empresa/perfil) | `apimaestro/linkedin-profile-scraper` ou `harvestapi/linkedin` | ~US$ 4 / 1.000 perfis | ~US$ 0,02 | ~US$ 0,20 | **~US$ 6** |
| YouTube | API oficial Google | **grátis** | 0 | 0 | **0** |

**Total estimado para 10 clientes, sync diário, 4 plataformas pagas:** **~US$ 21/mês em uso de Apify** — cabe folgado no Free (US$ 5/mês de crédito) se forem 2-3 clientes, ou no Starter US$ 49/mês para escalar até ~20-30 clientes.

Para sync **a cada 6h em vez de diário** multiplique por 4 (~US$ 84/mês para 10 clientes). Recomendo **diário às 6h BRT** + botão de refresh manual já existente.

---

## Plano de implementação

### 1. Novas edge functions (scrapers que faltam)
- `fetch-tiktok-apify` — recebe `client_id`, lê handle TikTok do `clients.tiktok_handle` (criar coluna se não existir), roda `clockworks/tiktok-scraper` async (polling pattern já usado em IG), faz upsert em `platform_metrics` (platform=`tiktok`).
- `fetch-linkedin-apify` — mesmo padrão para LinkedIn (perfil ou company), platform=`linkedin`. Usa `harvestapi/linkedin-profile-scraper`.

### 2. Orquestrador único: `sync-all-metrics`
Edge function que itera sobre todos os `clients` ativos do workspace e dispara em paralelo (com `Promise.allSettled`) as funções de cada plataforma onde o cliente tem handle preenchido. Loga sucesso/erro em `automation_runs` (se existir) ou em `notifications` tipo `automation_completed`.

### 3. Cron diário via pg_cron + Vault
Migration adicionando job `sync-all-metrics-daily` rodando **06:00 BRT (09:00 UTC)** chamando o orquestrador, no mesmo padrão do `process-push-queue-cron`.

### 4. Schema
- Adicionar colunas em `clients`: `tiktok_handle text`, `linkedin_handle text`, `linkedin_type text` ('person'|'company') — só se não existirem.
- Confirmar `instagram_handle`, `twitter_handle`, `youtube_channel_id` já existem (provável que sim).

### 5. UI
- Em **Performance**, adicionar badge "Última sync automática: há X horas" e indicador por plataforma (verde = ok, amarelo = sem handle, vermelho = falhou).
- Configuração por workspace: toggle "Sync automático diário" + escolha de horário (default 06h BRT).

### 6. Custo / limites visíveis
- Página de **Settings → Cloud & AI balance** já mostra custos. Adicionar nota informando custo estimado mensal Apify por cliente ativo, lendo da tabela `ai_usage_logs` (estendendo para tipo `apify_scrape`).
- Hard cap: se gasto Apify do mês > limite definido, pular sync e notificar via Telegram.

---

## Recomendação final

1. **Começar Free**: ativar sync automático apenas YouTube (oficial, grátis) + IG (Apify, baixo volume).
2. **Adicionar TikTok + X** como segunda fase (custo marginal baixo).
3. **LinkedIn por último** (mais frágil, mais caro, mais risco de bloqueio do actor).
4. **Sync 1x/dia às 06h BRT** — suficiente para reports e dashboard, custo controlado (~US$ 10-25/mês para 10 clientes).
5. **Manter botão manual** para refresh sob demanda quando precisar de dado quente.

## Resposta direta: dá para automatizar tudo?
- **Instagram, TikTok, X, LinkedIn**: sim, via Apify. Gratuito não rola para esses 4 em escala — só YouTube tem API oficial generosa.
- **Custo total realista** para automação completa diária de **10 clientes em 5 plataformas: ~US$ 21/mês**. Para **30 clientes: ~US$ 60/mês**. Cabe no plano Apify Starter US$ 49/mês até ~20 clientes; acima disso, Scale US$ 199/mês.

Posso seguir e implementar tudo (scrapers TikTok/LinkedIn + orquestrador + cron + UI de status)?
