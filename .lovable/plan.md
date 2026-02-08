

# Plano: Newsletter Inteligente com Pesquisa Gratuita

## Solução Escolhida

Usar **Gemini 2.0 com Grounding** (pesquisa nativa do Google) - **100% gratuito** já incluso na sua chave existente!

O Gemini tem uma feature chamada **"Google Search Grounding"** que permite pesquisar a web em tempo real durante a geração, retornando dados atualizados com citações. Isso elimina a necessidade de pagar por Perplexity, Tavily ou outras APIs de busca.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                     AUTOMAÇÃO TRIGGER                           │
│               (RSS, Schedule, Webhook)                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              FASE 1: DEEP RESEARCH                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  research-newsletter-topic (Nova Edge Function)         │   │
│  │                                                          │   │
│  │  1. Extrai tema do briefing da automação                 │   │
│  │  2. Chama Gemini 2.0 com GROUNDING habilitado            │   │
│  │  3. Pesquisa dados em tempo real:                        │   │
│  │     - Preços de tokens (CoinGecko, etc)                  │   │
│  │     - Métricas on-chain (Glassnode, etc)                 │   │
│  │     - Notícias recentes                                  │   │
│  │  4. Busca newsletters modelo (is_favorite=true)          │   │
│  │  5. Retorna briefing enriquecido com dados reais         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              FASE 2: CONTENT GENERATION                         │
│                                                                 │
│  unified-content-api (existente)                                │
│                                                                 │
│  Recebe:                                                        │
│  - Dados de mercado reais (preços, métricas)                    │
│  - Exemplos de newsletters modelo                               │
│  - Contexto do cliente (identity_guide)                         │
│                                                                 │
│  Gera: Newsletter pronta para publicar                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação Detalhada

### Etapa 1: Criar Edge Function de Research

Nova função `research-newsletter-topic/index.ts`:

- Usa **Gemini 2.0 com Google Search Grounding**
- Faz queries específicas para crypto (preços, métricas on-chain, notícias)
- Busca newsletters favoritas como referência de estilo
- Retorna um briefing estruturado com dados reais

**Estrutura do Research:**

```text
## DADOS DE MERCADO ATUAIS (pesquisados agora)
- Bitcoin: $XX,XXX (24h: +X.X%)
- Ethereum: $X,XXX (24h: +X.X%)
- [Token específico]: $X.XX (24h: +X.X%)

## MÉTRICAS ON-CHAIN
- Supply Shock Ratio: X.XX (tendência: acumulação)
- Exchange Netflow (7d): -XX,XXX BTC
- MVRV Z-Score: X.XX

## CONTEXTO DE MERCADO
- [Notícias e eventos recentes]
- [Sentimento do mercado]

## FONTES CONSULTADAS
[1] coingecko.com - Preços atualizados
[2] glassnode.com - Métricas on-chain
[3] coindesk.com - Notícias
```

### Etapa 2: Modificar process-automations

Quando `content_type === 'newsletter'`:

1. Detectar se precisa de pesquisa (baseado no template)
2. Chamar `research-newsletter-topic` primeiro
3. Passar dados enriquecidos para `unified-content-api`
4. Incluir exemplos das melhores newsletters

### Etapa 3: Marcar Newsletters de Referência

Atualizar as 3-5 melhores newsletters com `is_favorite = true`:

- "Análise detalhada: Cardano" - Excelente estrutura analítica
- "🤯 Essa queda é um sinal?" - Bom gancho emocional
- "Retrospectiva Defiverso 2025" - Formato de resumo

### Etapa 4: Atualizar knowledge-loader

Modificar `getFullContentContext()` para:

- Priorizar `is_favorite = true` ao buscar exemplos
- Retornar até 3 newsletters modelo para o formato newsletter

---

## Por Que Gemini Grounding é a Melhor Opção

| Critério | Gemini Grounding | Perplexity | Tavily |
|----------|------------------|------------|--------|
| Custo | Gratuito | $0.008/req | $0.008/req |
| Limite mensal | Ilimitado | 1000 grátis | 1000 grátis |
| Já configurado | Sim | Não | Não |
| Qualidade | Alta | Alta | Alta |
| Citações | Sim | Sim | Sim |

---

## Arquivos a Serem Criados/Modificados

### Novos Arquivos

1. `supabase/functions/research-newsletter-topic/index.ts`
   - Edge function para pesquisa com Gemini Grounding

### Arquivos Modificados

2. `supabase/functions/process-automations/index.ts`
   - Adicionar chamada ao research antes da geração de newsletters

3. `supabase/functions/_shared/llm.ts`
   - Adicionar função `callLLMWithGrounding()` para pesquisa

4. `supabase/functions/_shared/knowledge-loader.ts`
   - Priorizar newsletters favoritas ao buscar exemplos

### Migrations

5. SQL para marcar newsletters modelo como favoritas

---

## Resultado Esperado

Newsletters geradas pela automação terão:

- Dados de mercado **reais e atualizados** (não inventados)
- Métricas on-chain **específicas** (Supply Shock Ratio, Exchange Netflow, etc)
- **Estilo e profundidade** das melhores edições existentes
- **Prontas para publicar** sem edição manual

---

## Exemplo de Newsletter Gerada

**Antes (genérico):**
> "O Bitcoin teve movimentação interessante esta semana..."

**Depois (com dados reais):**
> "Bitcoin testou $94.800 na madrugada (-2.3% em 24h), mas o Supply Shock Ratio em 4.2 sugere que baleias não estão vendendo. Exchange Netflow mostra saída de 12.400 BTC das exchanges nos últimos 7 dias - historicamente, isso precede rallies de 15-20%..."

---

## Considerações Técnicas

- **Rate Limits:** Gemini Grounding tem 15 requests/minuto no tier gratuito - suficiente para automações
- **Latência:** A pesquisa adiciona ~3-5 segundos ao tempo total de geração
- **Fallback:** Se Grounding falhar, a geração continua sem dados de pesquisa (comportamento atual)

