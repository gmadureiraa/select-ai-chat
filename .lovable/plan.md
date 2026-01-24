
# Plano: Análise de Métricas Contextual e Inteligente

## Problema Identificado

O kAI Chat recebe apenas um **resumo genérico dos últimos 30 dias**, ignorando:
- O período específico que o usuário perguntou (ex: "dezembro 2025")
- Os posts individuais com todos os dados
- A possibilidade de responder perguntas analíticas específicas

**Resultado**: A IA diz "não tenho acesso" porque o contexto passado não contém os dados necessários.

---

## Solução: Sistema de Análise Contextual em 3 Camadas

### Fase 1: Extração de Período da Mensagem

**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Adicionar função `extractDateRange(message: string)` que detecta:
- Meses específicos: "dezembro", "janeiro", etc.
- Anos: "2025", "2026"
- Períodos relativos: "mês passado", "últimas semanas"
- Ranges: "de novembro a dezembro"

```typescript
function extractDateRange(message: string): { start: string; end: string } | null {
  // Detectar mês + ano: "dezembro de 2025"
  const monthYearMatch = message.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(de\s*)?(\d{4})/i);
  // Calcular range de datas do mês específico
  // Retornar { start: '2025-12-01', end: '2025-12-31' }
}
```

### Fase 2: Busca de Posts Direcionada

**Modificar `fetchMetricsContext`:**

1. Receber parâmetro `dateRange` opcional
2. Se dateRange existir, filtrar posts por `posted_at` no range
3. Incluir **dados completos** de cada post (não truncar caption)
4. Ordenar por métrica relevante (detectar se pergunta é sobre likes, engajamento, reach, etc.)

```typescript
async function fetchMetricsContext(
  supabase: any,
  clientId: string,
  dateRange?: { start: string; end: string },
  metricFocus?: 'likes' | 'engagement' | 'reach' | 'comments'
): Promise<string>
```

**Novo comportamento:**
- Se pergunta sobre "melhor post" + "dezembro" → buscar posts de dezembro, ordenar pelo critério
- Retornar os **5 melhores** com dados completos
- Incluir a legenda completa do #1 para análise posterior

### Fase 3: Detecção de Intenção de Análise

Adicionar detecção de:
- **Perguntas específicas**: "qual foi o melhor", "qual post teve mais"
- **Pedidos de análise profunda**: "por que esse post foi bem", "analise o sucesso"

**Novo padrão de detecção:**
```typescript
function isSpecificContentQuery(message: string): boolean {
  const patterns = [
    /qual\s+(foi\s+)?(o\s+)?(melhor|pior|maior|menor)/i,
    /post\s+(com\s+)?(mais|menos)/i,
    /top\s*\d+/i,
    /ranking/i,
    /conte[uú]do\s+que\s+(mais|menos)/i,
  ];
  return patterns.some(p => p.test(message));
}
```

### Fase 4: Contexto Rico para Análise Profunda

Quando o usuário perguntar "por que esse post foi bem", o sistema deve:

1. Detectar que é um **follow-up de análise**
2. Buscar o post específico mencionado (do histórico ou por referência)
3. Incluir no contexto:
   - Caption completo
   - Todas as métricas (likes, comments, shares, saves, reach)
   - Data e horário de postagem
   - Tipo de post (reel, carousel, imagem)
   - Média de desempenho do período para comparação

**Prompt especializado para análise:**
```
## Análise Detalhada Solicitada
Post: [caption completo]
Performance: 1612 likes (2x acima da média), 44 comentários, 155 shares
Engajamento: 4.57% (média do mês: 3.2%)
Tipo: Carrossel educativo

Analise:
1. Tema e timing
2. Estrutura do conteúdo
3. Copywriting e gatilhos
4. Formato visual
5. Padrões de engajamento
```

---

## Mudanças Específicas no Código

### 1. Nova função `extractDateRange`
- Detecta período mencionado na mensagem
- Mapeia meses em português para números
- Calcula primeiro e último dia do mês

### 2. Modificar `fetchMetricsContext`
- Aceitar dateRange opcional
- Buscar posts no período específico quando fornecido
- Aumentar limite de dados quando for query específica
- Incluir dados completos do melhor post

### 3. Nova função `detectMetricFocus`
- Identifica se pergunta é sobre likes, engajamento, alcance, etc.
- Ordena resultados pela métrica correta

### 4. Modificar fluxo principal
- Extrair dateRange antes de buscar métricas
- Passar dateRange para fetchMetricsContext
- Ajustar prompt baseado no tipo de análise

---

## Fluxo Exemplo

**Usuário pergunta:** "Qual foi o melhor post do Instagram de dezembro de 2025 em likes?"

1. `extractDateRange` → `{ start: '2025-12-01', end: '2025-12-31' }`
2. `detectMetricFocus` → `'likes'`
3. `fetchMetricsContext(clientId, dateRange, 'likes')` → busca posts de dezembro ordenados por likes
4. Contexto inclui:
   ```
   ## Melhor Post de Dezembro 2025 (por likes)
   
   **#1 - 1612 likes** (10/dez/2025)
   Tipo: Carrossel
   Engajamento: 4.57% | Comments: 44 | Shares: 155 | Saves: 91
   Caption: "Sempre que o Bitcoin atinge novos topos, é chamado de bolha..."
   
   Outros top posts:
   #2 - 1130 likes (28/dez) - Pack de memes
   #3 - 1049 likes (18/dez) - Filmes para investidores
   ```
5. IA responde com dados precisos e oferece análise

---

## Resultado Esperado

Após implementação:
- ✅ Responde "qual foi o melhor post de dezembro" com dados exatos
- ✅ Permite follow-up "por que esse post foi tão bem?"
- ✅ Compara performance entre períodos
- ✅ Identifica padrões de conteúdo de sucesso
- ✅ Gera relatórios focados no período solicitado

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/kai-simple-chat/index.ts` | Adicionar extractDateRange, detectMetricFocus, modificar fetchMetricsContext |
