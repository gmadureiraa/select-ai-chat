

# Plano: kAI 100% Funcional - Diagnóstico e Melhorias

## 1. ANÁLISE DO ESTADO ATUAL

### O que já existe e funciona bem:

#### 1.1 Edge Functions (Backend)
| Função | Propósito | Status |
|--------|-----------|--------|
| `kai-simple-chat` | Chat principal com streaming | ✅ Funcional |
| `kai-content-agent` | Geração de conteúdo com regras de formato | ✅ Funcional |
| `kai-planning-agent` | Sugestões de planejamento | ✅ Funcional |
| `kai-metrics-agent` | Análise de métricas | ✅ Funcional |

#### 1.2 Documentação de Formatos (`docs/formatos/`)
- 11 formatos documentados: Carrossel, Newsletter, Post Instagram, Reels, Thread, LinkedIn, Stories, Tweet, Artigo X, Blog Post, Email Marketing
- Cada formato tem: estrutura obrigatória, regras de ouro, formato de entrega, proibições, boas práticas

#### 1.3 Sistema de Regras (`format-rules.ts`)
- Regras injetadas automaticamente no prompt baseado no formato
- Diretrizes universais (zero emojis, limite de palavras, linguagem direta)
- Checklist de validação antes da entrega

#### 1.4 Sistema de Citações (@mentions)
- Usuário pode citar conteúdo da biblioteca com `@`
- Citações são buscadas no banco e injetadas no contexto
- Suporte a: biblioteca de conteúdo, referências, formatos

#### 1.5 Detecção de Intenções
O `kai-simple-chat` detecta automaticamente:
- Consultas de métricas (`isMetricsQuery`)
- Solicitações de relatório (`isReportRequest`)
- Pesquisa web (`isWebSearchQuery`)
- Queries específicas de conteúdo (`isSpecificContentQuery`)
- Geração de imagem (`isImageGenerationRequest`)
- Comparações de período (`isComparisonQuery`)

---

## 2. PROBLEMAS IDENTIFICADOS

### 2.1 Problemas Críticos

1. **Documentação de Formatos NÃO é carregada automaticamente**
   - Os arquivos em `docs/formatos/*.md` são documentação para desenvolvedores
   - O agente usa apenas `format-rules.ts` (versão reduzida)
   - A documentação completa do Carrossel (348 linhas) não chega ao agente

2. **Falta integração com `kai_documentation` table**
   - A função `fetchCitedContent` tenta buscar formatos em `kai_documentation`
   - Mas essa tabela provavelmente não está populada com os conteúdos de `docs/formatos/`

3. **Top Performers não integrado no kai-simple-chat**
   - O `kai-content-agent` busca top performers (posts com melhor engajamento)
   - O `kai-simple-chat` NÃO faz isso - perde contexto valioso

4. **Detecção de formato não dispara uso do kai-content-agent**
   - O chat simples tenta gerar tudo sozinho
   - Não roteia para agente especializado quando detecta formato

### 2.2 Problemas de UX

1. **Sem feedback visual durante processamento**
   - Usuário não sabe o que está acontecendo
   - Não vê quais fontes de dados estão sendo consultadas

2. **Citações manuais exigem conhecimento prévio**
   - Usuário precisa saber que pode usar `@`
   - Não há sugestão automática de referências relevantes

3. **Histórico de conversa limitado**
   - Apenas últimas 10-15 mensagens no contexto
   - Conversas longas perdem continuidade

---

## 3. ARQUITETURA PROPOSTA

### Fluxo Atual:
```text
Usuário -> kai-simple-chat -> Gemini -> Resposta
```

### Fluxo Otimizado Proposto:
```text
Usuário
   |
   v
[Detecção de Intenção]
   |
   ├── Métricas/Relatório -> kai-metrics-agent -> Resposta estruturada
   |
   ├── Criar Conteúdo (carrossel, newsletter, etc.) 
   |       |
   |       v
   |   [Carregar Formato de docs/formatos/]
   |       |
   |       v
   |   kai-content-agent (com regras completas) -> Conteúdo pronto
   |
   ├── Planejamento -> kai-planning-agent -> Sugestões de pauta
   |
   └── Conversa Geral -> kai-simple-chat -> Resposta
```

---

## 4. MELHORIAS PROPOSTAS

### FASE 1: Fundação (Prioridade Alta)

#### 4.1 Popular tabela `kai_documentation` com formatos
**Arquivo:** Script SQL de migração

Inserir os 11 formatos de `docs/formatos/` na tabela `kai_documentation`:
- `doc_type`: "format"
- `doc_key`: nome do formato (carrossel, newsletter, etc.)
- `content`: conteúdo completo do arquivo .md
- `checklist`: extraído da seção de checklist

**Benefício:** Citações de formato funcionarão corretamente

#### 4.2 Adicionar Top Performers no kai-simple-chat
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Adicionar fetch de top performers (como já existe no kai-content-agent):
```typescript
// Buscar posts com melhor performance para contexto
const { data: topPosts } = await supabase
  .from("instagram_posts")
  .select("caption, post_type, engagement_rate, likes, full_content, video_transcript")
  .eq("client_id", clientId)
  .not("content_synced_at", "is", null)
  .order("engagement_rate", { ascending: false })
  .limit(5);
```

Adicionar na seção de contexto do system prompt.

**Benefício:** Respostas mais alinhadas com o que já funciona para o cliente

#### 4.3 Roteamento inteligente para kai-content-agent
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Quando detectar criação de conteúdo com formato específico, redirecionar para `kai-content-agent`:
```typescript
const contentFormats = ["carrossel", "carousel", "newsletter", "reels", "thread", "post", "stories"];
const isContentCreation = contentFormats.some(f => message.toLowerCase().includes(f)) 
  && /cri(e|ar)|fa(ça|zer)|gere/i.test(message);

if (isContentCreation) {
  // Chamar kai-content-agent em vez de processar localmente
}
```

**Benefício:** Conteúdo gerado com regras completas de formato

---

### FASE 2: Experiência (Prioridade Média)

#### 4.4 Sugestão automática de referências relevantes
**Arquivo:** Novo componente `SmartCitationSuggester.tsx`

Quando usuário começa a digitar sobre um tema:
1. Buscar conteúdos relacionados na biblioteca
2. Mostrar badge discreto: "📚 Referências disponíveis: X sobre [tema]"
3. Click expande popover com sugestões

**Benefício:** Usuário descobre referências sem precisar lembrar de usar @

#### 4.5 Indicador de progresso visual
**Arquivo:** Componente do chat

Mostrar durante processamento:
```
🔍 Buscando contexto do cliente...
📊 Analisando performance recente...
✍️ Gerando conteúdo...
```

**Benefício:** Transparência sobre o que está acontecendo

#### 4.6 Memória de conversa expandida
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Implementar resumo de conversa para manter contexto:
- Últimas 15 mensagens completas
- Resumo gerado das 30 anteriores (via chamada AI separada)
- Tópicos-chave extraídos da conversa

**Benefício:** Conversas longas mantêm coerência

---

### FASE 3: Diferenciação (Prioridade Baixa)

#### 4.7 Análise de performance em tempo real
Quando usuário mencionar um post específico, buscar métricas e oferecer análise:
- "Por que esse post foi bem?"
- "O que podemos replicar?"
- Sugestões baseadas em padrões de sucesso

#### 4.8 Templates de prompts rápidos
Atalhos para solicitações comuns:
- `/carrossel [tema]` -> Gera carrossel com regras completas
- `/newsletter [tema]` -> Gera newsletter
- `/analisar [período]` -> Relatório de performance

#### 4.9 Auto-citação inteligente
Quando usuário pedir conteúdo, automaticamente:
1. Buscar conteúdos similares na biblioteca (embedding search)
2. Incluir os mais relevantes como contexto
3. Mostrar ao usuário o que foi usado como referência

---

## 5. REGRAS E CAMINHOS ATUAIS

### 5.1 Como Conteúdo é Gerado Hoje

```text
1. Usuário envia mensagem no chat

2. kai-simple-chat recebe requisição:
   - Valida autenticação
   - Verifica plano (Pro/Enterprise apenas)
   - Detecta intenções (métricas? imagem? comparação?)

3. Coleta de Contexto:
   - identity_guide do cliente (até 8000 chars)
   - Citações manuais (@mentions) até 12000 chars
   - Métricas se detectado (últimos 30 dias)
   - Pesquisa web se detectado

4. Monta System Prompt:
   - Identidade do cliente
   - Guia de tom de voz
   - Métricas/comparações se aplicável
   - Materiais citados

5. Chama Gemini 2.0 Flash via API direta

6. Streaming de resposta para o usuário
```

### 5.2 Regras de Formato (format-rules.ts)

| Formato | Regras Principais |
|---------|-------------------|
| **Carrossel** | Capa max 8 palavras, slides max 30 palavras, zero emojis no corpo |
| **Newsletter** | Assunto max 50 chars, parágrafos 2-3 linhas, CTA obrigatório |
| **Post** | Texto visual max 15 palavras, gancho forte na legenda |
| **Reels** | Gancho 0-3s, ritmo rápido, CTA visual + falado |
| **Thread** | Max 280 chars/tweet, 1 ideia por tweet |
| **LinkedIn** | Primeira linha é gancho, max 3-5 hashtags |
| **Stories** | Max 20 palavras/story, sticker interativo no final |

### 5.3 Diretrizes Universais

1. **Clareza**: 1 ideia por seção, linguagem simples
2. **Emojis**: QUASE ZERO (apenas CTA final)
3. **Linguagem**: Verbos de ação, números específicos
4. **Proibido**: "Entenda", "Aprenda", "Descubra como", "Você sabia que"
5. **Usar**: "Você está perdendo", "O segredo é", "Faça isso agora"

---

## 6. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1 (Esta semana)
- [ ] Script SQL para popular `kai_documentation` com formatos
- [ ] Adicionar top performers no contexto do kai-simple-chat
- [ ] Roteamento para kai-content-agent quando detectar criação de conteúdo

### Fase 2 (Próxima semana)
- [ ] Componente de sugestão de citações
- [ ] Indicador visual de progresso
- [ ] Testes de integração end-to-end

### Fase 3 (Opcional)
- [ ] Templates de prompts rápidos (`/carrossel`, `/newsletter`)
- [ ] Auto-citação inteligente com embeddings
- [ ] Resumo de conversa para memória expandida

---

## 7. ARQUIVOS A MODIFICAR

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Popular `kai_documentation` com conteúdo de `docs/formatos/` |
| `kai-simple-chat/index.ts` | Adicionar top performers, roteamento inteligente |
| `useKAISimpleChat.ts` | Suporte a indicador de progresso |
| Novo: `SmartCitationSuggester.tsx` | Sugestões de referências |
| Novo: `ProgressIndicator.tsx` | Visual de etapas de processamento |

---

## 8. MÉTRICAS DE SUCESSO

1. **Qualidade**: Conteúdo gerado segue 100% das regras de formato
2. **Consistência**: Tom de voz alinhado com identity_guide
3. **Contexto**: Top performers incluídos automaticamente
4. **UX**: Usuário entende o que está acontecendo durante geração
5. **Descoberta**: Usuários utilizam mais referências da biblioteca

