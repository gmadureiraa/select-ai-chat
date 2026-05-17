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

## CI integration (futuro)

Adicionar workflow GitHub Actions que roda `bun run eval` em PRs que mexem em:
- `api/_handlers/kai-simple-chat.ts`
- `api/_lib/kai-chat-tools/**`
- `api/_lib/shared/format-rules.ts`

Threshold: 100% dos negative-cases (forbiddenTools) e ≥80% dos positive-cases (expectedTools).
