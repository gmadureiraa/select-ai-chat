# KAI Chat Eval Suite

Regression tests pro tool selection do agente KAI Chat. Roda os prompts de `kai-chat-prompts.ts` contra Gemini real usando o registry de tools verdadeiro, mas com handlers STUB (zero side-effect — não toca banco/Stripe/redes sociais).

## Como rodar

```bash
# Todos os cases
bun run eval

# Filtrar por tag
bun run eval --tag content
bun run eval --tag delete --tag approval

# Casos específicos
bun run eval --case create-tweet --case metrics-recent

# Trocar modelo
bun run eval --model gemini-2.5-flash-lite

# LLM-as-judge (custo extra: 1 chamada Gemini Pro por case com `judge` definido)
bun run eval:judge
bun run eval --judge --judge-model gemini-2.5-pro
```

Requer `GOOGLE_API_KEY` (ou `GEMINI_API_KEY`) no `.env`.

## O que valida

### Assertions baratas (sempre rodam)
- **`expectedTools`** — lista de tools que DEVEM ser chamadas
- **`forbiddenTools`** — tools que NÃO devem ser chamadas (regression de segurança)
- **`maxToolCalls`** — limite superior (custo)
- **`expectedText` / `forbiddenText`** — substrings no output final

### LLM-as-judge (opcional, `--judge`)
Cases com `judge: {criteria, threshold}` rodam um modelo juiz (Gemini 2.5 Pro
default) que dá score 0-10 por critério. Score final é média ponderada (`weight`).
Falha se < threshold (default 7). 4 cases V2 cobrem: PT-BR sem emoji, post
LinkedIn sem hashtag, tweet < 280 chars, recusa educada de comando destrutivo.

## Quando adicionar caso

- Toda vez que aparecer um bug de roteamento ("o agente chamou X quando devia chamar Y")
- Toda vez que rebatizar/criar/remover tool
- Mudanças no system prompt (rodar antes/depois pra ver regressão)

## Estrutura

```
evals/
  README.md
  kai-chat-prompts.ts    # casos canônicos (15 baseline)
  run.ts                 # runner standalone (bun)
  last-run.json          # último resultado (gerado, não commitar idealmente)
```

## CI integration (ativo desde 2026-05-17)

Workflow `.github/workflows/kai-chat-eval.yml` triggera em PRs que mexem em:
- `api/_handlers/kai-simple-chat.ts`
- `api/_lib/kai-chat-tools/**`
- `api/_lib/shared/format-rules.ts` / `format-standards.ts` / `format-constants.ts`
- `evals/**`

**Threshold:** ≥80% pass rate. Falha o PR se cair abaixo.

**Persistência:** roda com `--persist --trigger ci`, posta resultado pro
endpoint `/api/eval-history` (precisa `EVAL_INGEST_URL` + `EVAL_INGEST_TOKEN`
nos secrets do repo). Dashboard de admin lê histórico pra mostrar trend.

**Manual:** `workflow_dispatch` aceita input `judge=true` pra rodar com
LLM-as-judge (custo extra). Útil pra release readiness.

## Persistir runs em DB localmente

```bash
EVAL_INGEST_URL=http://localhost:3000/api/eval-history \
EVAL_INGEST_TOKEN=$EVAL_INGEST_TOKEN \
bun run eval --persist --trigger manual
```

Sem `--persist`, só salva `evals/last-run.json` local.
