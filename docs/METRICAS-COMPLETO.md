# 📊 Sistema de Métricas - Completo

**Objetivo:** Sistema completo de métricas reorganizado com duas tabs: uma focada no cliente e outra com todas as métricas detalhadas, incluindo benchmark de mercado, estrutura detalhada e regras para geração de insights.

**Data:** Janeiro 2025

---

## 🎯 VISÃO GERAL

O sistema de métricas será reorganizado em **duas tabs principais**:

1. **Tab "Visão do Cliente"** - Dashboard focado no que o cliente precisa saber
2. **Tab "Análise Completa"** - Todas as métricas com planilha filtrada e insights gerados

---

## 📚 BENCHMARK DE MERCADO

### O Que Clientes de Agências de Conteúdo Querem Ver:

#### 1. **KPIs de Alto Nível (Prioridade Máxima)**
- ✅ **Crescimento de Seguidores/Inscritos** - O mais importante para clientes
- ✅ **Engajamento** - Taxa de engajamento e tendência
- ✅ **Alcance/Impressões** - Visibilidade do conteúdo
- ✅ **Conversões** - Se aplicável (cliques, vendas, leads)

#### 2. **Metas e Objetivos**
- ✅ **Metas Criadas vs Batidas** - Visualização clara de progresso
- ✅ **Percentual de Conclusão** - Quanto falta para bater a meta
- ✅ **Tendência** - Está no caminho certo?

#### 3. **Melhores Conteúdos**
- ✅ **Top 5-10 Conteúdos** - O que funcionou melhor
- ✅ **Análise de Por Que Funcionou** - Insights sobre sucesso
- ✅ **Comparação com Média** - Contexto de performance

#### 4. **O Que Está Dando Certo ou Errado**
- ✅ **Tendências Positivas** - O que está melhorando
- ✅ **Tendências Negativas** - O que precisa atenção
- ✅ **Recomendações Ações** - O que fazer para melhorar

#### 5. **Comparações Temporais**
- ✅ **Sempre comparar com período anterior** - Essencial para contexto
- ✅ **Variação percentual clara** - Fácil de entender
- ✅ **Tendências visuais** - Gráficos que mostram evolução

### Referências de Mercado:

**Dashboards de Sucesso (Hootsuite, Sprout Social, Buffer):**
- KPIs principais no topo (4-6 cards)
- Gráficos de tendência (linha temporal)
- Tabela de top performers
- Insights automáticos
- Comparação com período anterior sempre presente

**Dashboards Internos vs Cliente:**
- **Cliente:** Foco em resultados, metas, o que está funcionando
- **Interno:** Todas as métricas, filtros avançados, análise profunda

---

## 🎨 TAB 1: VISÃO DO CLIENTE

### Objetivo:
Dashboard limpo e focado no que o cliente precisa saber para tomar decisões e entender o ROI do trabalho da agência.

### Estrutura:

```
┌─────────────────────────────────────────────────────────┐
│ 📊 KPIs PRINCIPAIS (4-6 cards)                         │
│ [Seguidores] [Engajamento] [Alcance] [Impressões]     │
│ Cada card: Valor + Variação + Sparkline + Meta         │
├─────────────────────────────────────────────────────────┤
│ 🎯 METAS E OBJETIVOS                                    │
│ [Meta 1: Progresso] [Meta 2: Progresso] [Meta 3: ...]  │
│ Gauge charts mostrando % de conclusão                  │
├─────────────────────────────────────────────────────────┤
│ 📈 GRÁFICO PRINCIPAL DE TENDÊNCIA                       │
│ [Gráfico de linha/área - Últimos 30 dias]              │
│ Mostrando métrica principal + comparação período anterior│
├─────────────────────────────────────────────────────────┤
│ 🏆 MELHORES CONTEÚDOS (Top 5-10)                        │
│ [Tabela com preview + métricas principais]             │
│ Ordenado por engajamento ou métrica principal           │
├─────────────────────────────────────────────────────────┤
│ 💡 INSIGHTS AUTOMÁTICOS                                 │
│ [Card com análise gerada por IA]                       │
│ O que está dando certo, o que precisa atenção           │
└─────────────────────────────────────────────────────────┘
```

### Componentes Detalhados:

#### 1. Cards de KPI (Topo)

**Estrutura de Cada Card:**
```
┌─────────────────────┐
│ 📊 Seguidores       │
│                     │
│ 12.5K               │ ← Valor grande (text-4xl)
│ +3.2% vs anterior   │ ← Variação com cor (verde/vermelho)
│                     │
│ [Sparkline]         │ ← Mini gráfico de tendência
│                     │
│ Meta: 15K (83%)    │ ← Progresso da meta (se houver)
└─────────────────────┘
```

**KPIs por Plataforma:**

**Instagram:**
- Seguidores
- Engajamento (%)
- Alcance
- Impressões

**YouTube:**
- Inscritos
- Visualizações
- Horas Assistidas
- Taxa de Retenção

**Newsletter:**
- Inscritos
- Taxa de Abertura
- Taxa de Cliques
- Taxa de Cancelamento

**Twitter/X:**
- Seguidores
- Impressões
- Engajamentos
- Taxa de Engajamento

**LinkedIn:**
- Seguidores
- Impressões
- Engajamentos
- Taxa de Engajamento

**Design:**
- Padding: `p-6`
- Border radius: `rounded-xl`
- Background: `bg-card`
- Sombra: `shadow-sm hover:shadow-md`
- Valor: `text-4xl font-bold`
- Variação: Badge com ícone (↑ verde, ↓ vermelho)
- Sparkline: Altura ~40px, largura 100%

#### 2. Seção de Metas

**Estrutura:**
```
┌─────────────────────────────────────────┐
│ 🎯 Metas e Objetivos                    │
├─────────────────────────────────────────┤
│ [Gauge] Meta: 15K Seguidores (83%)     │
│ [Gauge] Meta: 5% Engajamento (92%)     │
│ [Gauge] Meta: 50K Alcance (67%)        │
└─────────────────────────────────────────┘
```

**Componente:**
- Gauge chart circular ou linear
- Cor baseada em progresso:
  - Verde: 80-100%
  - Amarelo: 50-79%
  - Vermelho: 0-49%
- Mostrar: Meta, Atual, Progresso (%)

#### 3. Gráfico Principal de Tendência

**Tipo:** Area Chart ou Line Chart

**Estrutura:**
- **Eixo X:** Datas (últimos 30 dias)
- **Eixo Y:** Valor da métrica principal
- **Linha Principal:** Período atual (cor primária, opacidade 100%)
- **Linha Secundária:** Período anterior (cor cinza, opacidade 50%, pontilhada)
- **Tooltip:** Mostrar valores de ambos os períodos ao hover

**Métrica Principal por Plataforma:**
- Instagram: Engajamento (%)
- YouTube: Visualizações
- Newsletter: Taxa de Abertura
- Twitter/X: Impressões
- LinkedIn: Impressões

**Design:**
- Padding: `p-6`
- Altura: `h-[300px]` ou `h-[400px]`
- Responsivo: Adapta em mobile

#### 4. Melhores Conteúdos

**Tabela com:**
- Preview (imagem ou thumbnail)
- Data de publicação
- Métrica principal (engajamento, visualizações, etc)
- Comparação com média do período
- Badge de "Top Performer" se estiver acima da média

**Ordenação:**
- Por padrão: Por métrica principal (descendente)
- Opcional: Filtrar por tipo de conteúdo

**Limite:**
- Mostrar top 5-10 por padrão
- Opção de "Ver mais" para expandir

**Design:**
- Cards ou tabela
- Hover: Destacar linha/card
- Preview: Imagem pequena (64x64px ou similar)

#### 5. Insights Automáticos

**Card de Insights:**
```
┌─────────────────────────────────────────┐
│ 💡 Análise do Período                  │
├─────────────────────────────────────────┤
│ ✅ O que está dando certo:             │
│ - Engajamento aumentou 12%             │
│ - Alcance cresceu 8%                   │
│                                         │
│ ⚠️ O que precisa atenção:              │
│ - Taxa de engajamento abaixo da meta   │
│ - Posts de segunda-feira com baixa perf.│
│                                         │
│ 💡 Recomendações:                      │
│ - Aumentar frequência de posts         │
│ - Focar em horários de pico            │
└─────────────────────────────────────────┘
```

**Conteúdo:**
- Gerado por agente de IA (ver regras abaixo)
- Atualizado automaticamente ao mudar período
- Sempre comparar com período anterior

---

## 🔬 TAB 2: ANÁLISE COMPLETA

### Objetivo:
Dashboard completo com todas as métricas disponíveis, filtros avançados, ordenação e insights gerados sob demanda.

### Estrutura:

```
┌─────────────────────────────────────────────────────────┐
│ 📅 SELEÇÃO DE PERÍODO                                   │
│ [Dropdown: Últimos 7/14/30/60/90 dias] [Data custom]   │
│ [Plataforma: Instagram/YouTube/Newsletter/...]        │
│ [Botão: Gerar Insights]                                 │
├─────────────────────────────────────────────────────────┤
│ 📊 TODAS AS MÉTRICAS (Planilha)                         │
│ [Filtros] [Ordenação] [Busca] [Exportar]               │
│                                                         │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Data │ Conteúdo │ Alcance │ Engaj. │ Likes │ ... │ │
│ ├───────────────────────────────────────────────────┤ │
│ │ ...  │ ...      │ ...     │ ...    │ ...   │ ... │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ Paginação: [<] 1 2 3 [>]                              │
├─────────────────────────────────────────────────────────┤
│ 📈 GRÁFICOS DETALHADOS                                   │
│ [Tabs: Alcance | Engajamento | Impressões | ...]       │
│ Cada tab mostra gráfico específico da métrica          │
├─────────────────────────────────────────────────────────┤
│ 🤖 INSIGHTS GERADOS                                      │
│ [Card com análise completa do período selecionado]     │
│ Gerado ao clicar em "Gerar Insights"                   │
└─────────────────────────────────────────────────────────┘
```

### Componentes Detalhados:

#### 1. Seletor de Período e Plataforma

**Componentes:**
- **Dropdown de Período:**
  - Últimos 7 dias
  - Últimos 14 dias
  - Últimos 30 dias
  - Últimos 60 dias
  - Últimos 90 dias
  - Personalizado (date picker)

- **Seletor de Plataforma:**
  - Instagram
  - YouTube
  - Newsletter
  - Twitter/X
  - LinkedIn
  - Todas (agregado)

- **Botão "Gerar Insights":**
  - Chama agente de IA
  - Mostra loading state
  - Exibe insights gerados abaixo

#### 2. Planilha de Métricas

**Funcionalidades:**
- **Filtros:**
  - Por tipo de conteúdo
  - Por data (range)
  - Por métrica (acima/abaixo de valor)
  - Por hashtags/palavras-chave

- **Ordenação:**
  - Por qualquer coluna
  - Ascendente/Descendente
  - Múltiplas colunas (shift+click)

- **Busca:**
  - Buscar por texto no conteúdo
  - Buscar por hashtags
  - Buscar por datas

- **Exportar:**
  - CSV
  - Excel
  - PDF (relatório)

**Colunas Disponíveis:**

**Instagram:**
- Data
- Preview
- Tipo (Post, Reels, Stories, Carrossel)
- Alcance
- Impressões
- Engajamento (%)
- Likes
- Comentários
- Salvos
- Compartilhamentos
- Taxa de Salvamento
- Taxa de Compartilhamento
- Hashtags
- Legenda (truncada)

**YouTube:**
- Data
- Thumbnail
- Título
- Visualizações
- Horas Assistidas
- Retenção (%)
- CTR (%)
- Likes
- Comentários
- Compartilhamentos
- Inscritos Ganhos
- Duração

**Newsletter:**
- Data de Envio
- Assunto
- Enviados
- Entregues
- Abertos
- Taxa de Abertura (%)
- Cliques
- Taxa de Cliques (%)
- Cancelamentos
- Taxa de Cancelamento (%)

**Design:**
- Tabela responsiva
- Scroll horizontal em mobile
- Paginação (50 itens por página)
- Loading skeleton
- Empty state quando sem dados

#### 3. Gráficos Detalhados

**Tabs de Métricas:**
- Cada métrica tem seu próprio gráfico
- Tipo de gráfico baseado na métrica:
  - **Tendências:** Line Chart ou Area Chart
  - **Comparações:** Bar Chart
  - **Distribuições:** Pie Chart ou Donut Chart
  - **Correlações:** Scatter Plot

**Gráficos por Métrica:**

**Alcance:**
- Tipo: Area Chart
- Eixo X: Data
- Eixo Y: Alcance (milhares)
- Comparação: Período anterior (linha pontilhada)

**Engajamento:**
- Tipo: Line Chart
- Eixo X: Data
- Eixo Y: Taxa de Engajamento (%)
- Múltiplas linhas: Engajamento Total, Likes Rate, Comentários Rate

**Impressões:**
- Tipo: Bar Chart
- Eixo X: Data
- Eixo Y: Impressões (milhares)
- Comparação: Barras lado a lado (atual vs anterior)

**Tipos de Conteúdo:**
- Tipo: Pie Chart ou Stacked Bar
- Mostrar: Distribuição de performance por tipo

**Horários de Melhor Performance:**
- Tipo: Heatmap
- Eixo X: Dias da semana
- Eixo Y: Horários
- Cor: Intensidade de engajamento

#### 4. Insights Gerados

**Estrutura do Card de Insights:**
```
┌─────────────────────────────────────────┐
│ 🤖 Análise Completa - [Período]        │
├─────────────────────────────────────────┤
│ 📊 Resumo Executivo                     │
│ [Parágrafo com overview geral]         │
│                                         │
│ 📈 Tendências Principais                │
│ - Tendência 1: [descrição]            │
│ - Tendência 2: [descrição]             │
│                                         │
│ 🎯 Metas e Objetivos                    │
│ - Meta 1: [status]                     │
│ - Meta 2: [status]                     │
│                                         │
│ ✅ Pontos Fortes                        │
│ - [Lista de pontos fortes]             │
│                                         │
│ ⚠️ Áreas de Melhoria                    │
│ - [Lista de áreas de melhoria]         │
│                                         │
│ 💡 Recomendações Estratégicas           │
│ - [Lista de recomendações]             │
│                                         │
│ 📊 Comparação com Período Anterior      │
│ [Tabela comparativa]                    │
└─────────────────────────────────────────┘
```

**Conteúdo:**
- Gerado por agente de IA (ver regras abaixo)
- Sempre comparar com período anterior
- Incluir números específicos
- Ações recomendadas

---

## 🤖 REGRAS PARA AGENTE DE INSIGHTS

### Princípios Fundamentais:

1. **SEMPRE comparar com período anterior** (mesmo tamanho)
   - Exemplo: Se período atual é "últimos 30 dias", comparar com "30 dias anteriores"
   - Nunca comparar períodos de tamanhos diferentes

2. **Usar números específicos**
   - Não: "Aumentou significativamente"
   - Sim: "Aumentou 12.3% (de 1.200 para 1.348)"

3. **Contextualizar métricas**
   - Explicar o que a métrica significa
   - Comparar com benchmarks da indústria quando relevante

4. **Identificar padrões**
   - Horários de melhor performance
   - Tipos de conteúdo que funcionam melhor
   - Tendências temporais

5. **Focar em ações**
   - Não apenas descrever, mas recomendar
   - Priorizar recomendações por impacto

### Estrutura de Análise:

#### 1. Resumo Executivo (1-2 parágrafos)
- Overview geral do período
- Principais destaques (positivos e negativos)
- Comparação com período anterior

#### 2. Tendências Principais (3-5 itens)
- Lista de tendências mais importantes
- Cada tendência com:
  - Descrição
  - Número específico
  - Comparação com período anterior
  - Significado/impacto

#### 3. Metas e Objetivos
- Status de cada meta:
  - ✅ Batida
  - 🟡 Em progresso (X% concluído)
  - ❌ Abaixo do esperado
- Projeção: Se continuar no ritmo atual, baterá a meta?

#### 4. Pontos Fortes (3-5 itens)
- O que está funcionando bem
- Por que está funcionando
- Como manter/ampliar

#### 5. Áreas de Melhoria (3-5 itens)
- O que precisa atenção
- Por que precisa atenção
- Impacto potencial se melhorar

#### 6. Recomendações Estratégicas (3-5 itens)
- Ações específicas e acionáveis
- Priorizadas por impacto esperado
- Com prazo sugerido (curto/médio/longo prazo)

#### 7. Comparação Detalhada
- Tabela comparativa:
  - Métrica | Período Atual | Período Anterior | Variação
- Gráficos comparativos quando relevante

### Exemplo de Prompt para Agente:

```
Analise as métricas do [PLATAFORMA] para o período de [DATA_INICIO] a [DATA_FIM].

REGRAS OBRIGATÓRIAS:
1. Compare SEMPRE com o período anterior de mesmo tamanho ([DATA_INICIO_ANTERIOR] a [DATA_FIM_ANTERIOR])
2. Use números específicos (não genéricos)
3. Identifique padrões e tendências
4. Foque em ações acionáveis
5. Contextualize métricas quando necessário

DADOS DISPONÍVEIS:
[Métricas do período atual]
[Métricas do período anterior]
[Metas configuradas]
[Top conteúdos]

ESTRUTURA DE RESPOSTA:
1. Resumo Executivo
2. Tendências Principais
3. Metas e Objetivos
4. Pontos Fortes
5. Áreas de Melhoria
6. Recomendações Estratégicas
7. Comparação Detalhada (tabela)

TONE:
- Profissional mas acessível
- Direto ao ponto
- Focado em resultados
- Orientado a ações
```

### Validações:

Antes de entregar insights, validar:
- ✅ Comparação com período anterior presente
- ✅ Números específicos (não genéricos)
- ✅ Pelo menos 3 recomendações acionáveis
- ✅ Status de todas as metas mencionado
- ✅ Pontos fortes e áreas de melhoria balanceados

---

## 📐 TIPOS DE GRÁFICOS POR CONTEXTO

### Gráficos de Tendência:
- **Line Chart:** Tendências ao longo do tempo
- **Area Chart:** Volume acumulado ao longo do tempo
- **Dual Axis:** Duas métricas com escalas diferentes

### Gráficos de Comparação:
- **Bar Chart:** Comparar valores entre categorias
- **Stacked Bar:** Comparar totais e componentes
- **Grouped Bar:** Comparar múltiplas séries lado a lado

### Gráficos de Distribuição:
- **Pie Chart:** Proporções de um todo
- **Donut Chart:** Similar ao pie, mas com espaço central
- **Treemap:** Hierarquia e proporções

### Gráficos de Correlação:
- **Scatter Plot:** Relação entre duas variáveis
- **Bubble Chart:** Scatter plot com tamanho adicional

### Gráficos Especiais:
- **Heatmap:** Intensidade em duas dimensões (ex: horários × dias)
- **Sparkline:** Mini gráfico inline (para cards de KPI)
- **Gauge:** Progresso em direção a uma meta

### Regras de Uso:

**Line Chart:**
- Quando: Mostrar tendência ao longo do tempo
- Exemplo: Engajamento diário, Seguidores ao longo do mês

**Area Chart:**
- Quando: Mostrar volume acumulado ou múltiplas séries empilhadas
- Exemplo: Tipos de engajamento (likes + comentários + salvos)

**Bar Chart:**
- Quando: Comparar valores entre categorias
- Exemplo: Performance por tipo de conteúdo, Top 10 posts

**Pie Chart:**
- Quando: Mostrar proporções de um todo (máximo 5-7 categorias)
- Exemplo: Distribuição de tipos de conteúdo, Fontes de tráfego

**Heatmap:**
- Quando: Mostrar intensidade em duas dimensões
- Exemplo: Engajamento por dia da semana × horário

**Sparkline:**
- Quando: Mostrar tendência em espaço pequeno
- Exemplo: Cards de KPI

---

## 🎨 PADRÕES DE DESIGN

### Cores:

**Status:**
- Verde: Positivo, crescimento, sucesso
- Vermelho: Negativo, queda, atenção necessária
- Amarelo: Neutro, em progresso
- Azul: Informação, dados neutros

**Gráficos:**
- Cor primária: Para série principal
- Cores secundárias: Para séries adicionais
- Cor de comparação: Cinza para período anterior

### Espaçamento:

- Cards: `p-6`
- Gráficos: `p-6`
- Tabelas: `p-4` ou `p-6`
- Seções: `space-y-6` ou `space-y-8`

### Tipografia:

- Títulos: `text-2xl` ou `text-3xl`, `font-bold`
- Valores: `text-4xl`, `font-bold`
- Labels: `text-sm`, `text-muted-foreground`
- Corpo: `text-base`

### Responsividade:

- Mobile: Stack vertical, gráficos adaptados
- Tablet: Grid 2 colunas
- Desktop: Grid 3-4 colunas

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Tab 1: Visão do Cliente
- [ ] Cards de KPI (4-6 por plataforma)
- [ ] Sparklines nos cards
- [ ] Comparação com período anterior
- [ ] Seção de metas com gauges
- [ ] Gráfico principal de tendência
- [ ] Tabela de melhores conteúdos (top 5-10)
- [ ] Card de insights automáticos
- [ ] Responsivo

### Tab 2: Análise Completa
- [ ] Seletor de período (dropdown + custom)
- [ ] Seletor de plataforma
- [ ] Botão "Gerar Insights"
- [ ] Planilha com todas as métricas
- [ ] Filtros avançados
- [ ] Ordenação por coluna
- [ ] Busca
- [ ] Exportar (CSV, Excel, PDF)
- [ ] Paginação
- [ ] Tabs de gráficos detalhados
- [ ] Card de insights gerados
- [ ] Loading states
- [ ] Empty states

### Agente de Insights
- [ ] Integração com agente de IA
- [ ] Regras de comparação implementadas
- [ ] Validações de qualidade
- [ ] Cache de insights (24h)
- [ ] Regeneração sob demanda

---

## 📋 PRÓXIMOS PASSOS

1. **Implementar Tab 1 (Visão do Cliente)**
   - Criar componentes de cards de KPI
   - Implementar seção de metas
   - Criar gráfico principal
   - Tabela de melhores conteúdos
   - Integrar insights automáticos

2. **Implementar Tab 2 (Análise Completa)**
   - Criar planilha de métricas
   - Implementar filtros e ordenação
   - Criar gráficos detalhados
   - Integrar geração de insights

3. **Configurar Agente de Insights**
   - Criar prompt baseado nas regras
   - Implementar validações
   - Testar com dados reais
   - Ajustar baseado em feedback

4. **Testes e Refinamento**
   - Testar com diferentes períodos
   - Validar comparações
   - Ajustar design baseado em uso
   - Otimizar performance

---

**Nota:** Este documento serve como especificação completa para implementação do sistema de métricas reorganizado, com foco em duas experiências distintas: uma para o cliente e outra para análise profunda.

