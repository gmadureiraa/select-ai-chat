# 📊 Performance Dashboards - Completo

**Objetivo:** Dashboard completo e funcional para cada plataforma com KPIs prioritários, gráficos e comparações com período anterior.

---

## 🎯 PRINCÍPIOS GERAIS

### Hierarquia de Informação:
1. **KPIs Principais** (Topo) - O que o cliente precisa saber primeiro
2. **Gráficos de Tendência** (Meio) - Evolução ao longo do tempo
3. **Análises Detalhadas** (Baixo) - Informações extras e detalhadas

### Comparações:
- ✅ **Sempre comparar com período anterior** (mesmo tamanho)
- ✅ Mostrar variação percentual clara (+/-)
- ✅ Cores: Verde (positivo), Vermelho (negativo), Cinza (neutro)

### Gráficos:
- ✅ Gráficos que fazem sentido para cada métrica
- ✅ Linha temporal para tendências
- ✅ Barras para comparações
- ✅ Sparklines para KPIs (mini gráficos)

---

## 📸 INSTAGRAM DASHBOARD

### 🎯 KPIs PRINCIPAIS (Topo - Prioridade Máxima)

#### Card 1: Seguidores
```
📊 Valor: 12.5K
📈 Variação: +3.2% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Gráfico:** Sparkline pequeno no card

#### Card 2: Engajamento
```
📊 Valor: 4.2%
📈 Variação: +0.5% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Fórmula:** (Likes + Comentários + Salvos + Compartilhamentos) / Impressões × 100

#### Card 3: Alcance
```
📊 Valor: 45.2K
📈 Variação: +12.1% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 4: Impressões
```
📊 Valor: 67.8K
📈 Variação: +8.3% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

---

### 📈 GRÁFICOS DE TENDÊNCIA (Meio - Prioridade Alta)

#### Gráfico 1: Engajamento ao Longo do Tempo (Area Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Porcentagem (%)
**Linhas:**
- Engajamento Total (linha principal, cor primária)
- Likes Rate (linha secundária, cor suave)
- Comentários Rate (linha secundária, cor suave)

**Comparação:** Linha pontilhada mostrando período anterior (mesmo tamanho)

#### Gráfico 2: Alcance e Impressões (Dual Axis Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y Esquerdo:** Alcance (milhares)
**Eixo Y Direito:** Impressões (milhares)
**Barras:** Alcance (azul)
**Linha:** Impressões (laranja)

**Comparação:** Overlay mostrando período anterior (transparência 50%)

#### Gráfico 3: Tipos de Interação (Stacked Bar Chart)
**Eixo X:** Datas (últimos 7 dias)
**Eixo Y:** Quantidade
**Stacks:**
- Likes (verde)
- Comentários (azul)
- Salvos (roxo)
- Compartilhamentos (laranja)

---

### 📋 ANÁLISES DETALHADAS (Baixo - Informações Extras)

#### Seção 1: Posts Top Performers
**Tabela com:**
- Preview da imagem
- Data de publicação
- Engajamento (%)
- Alcance
- Impressões
- Likes, Comentários, Salvos, Compartilhamentos
- Comparação com média do período

**Ordenação:** Por engajamento (descendente)

#### Seção 2: Análise de Hashtags
- Hashtags mais usadas
- Performance por hashtag
- Gráfico de barras horizontal

#### Seção 3: Horários de Melhor Performance
- Gráfico de calor (heatmap)
- Dias da semana × Horários
- Cores indicando nível de engajamento

---

## 🎥 YOUTUBE DASHBOARD

### 🎯 KPIs PRINCIPAIS (Topo)

#### Card 1: Inscritos
```
📊 Valor: 8.7K
📈 Variação: +15.2% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 2: Visualizações Totais
```
📊 Valor: 125.4K
📈 Variação: +22.1% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 3: Horas Assistidas
```
📊 Valor: 2.8K horas
📈 Variação: +18.5% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 4: Taxa de Retenção Média
```
📊 Valor: 45.2%
📈 Variação: +2.3% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Fórmula:** Tempo médio de visualização / Duração total do vídeo

---

### 📈 GRÁFICOS DE TENDÊNCIA (Meio)

#### Gráfico 1: Visualizações e Horas Assistidas (Dual Axis)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y Esquerdo:** Visualizações (milhares)
**Eixo Y Direito:** Horas Assistidas
**Barras:** Visualizações (azul)
**Linha:** Horas Assistidas (verde)

**Comparação:** Overlay período anterior

#### Gráfico 2: Engajamento (Area Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Quantidade
**Áreas empilhadas:**
- Likes (verde)
- Comentários (azul)
- Compartilhamentos (laranja)
- Inscritos ganhos (roxo)

#### Gráfico 3: CTR (Click-Through Rate) - Line Chart
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Porcentagem (%)
**Linha:** CTR médio (azul)
**Comparação:** Linha pontilhada período anterior (cinza)

---

### 📋 ANÁLISES DETALHADAS (Baixo)

#### Seção 1: Vídeos Top Performers
**Tabela com:**
- Thumbnail
- Título
- Data de publicação
- Visualizações
- Horas Assistidas
- Retenção (%)
- CTR (%)
- Likes, Comentários, Compartilhamentos
- Comparação com média

**Ordenação:** Por visualizações (descendente)

#### Seção 2: Análise de Demografia
- Gráfico de pizza: Idade
- Gráfico de barras: Gênero
- Gráfico de mapa: Países (top 10)

#### Seção 3: Análise de Tráfego
- Fontes de tráfego (pie chart)
- Dispositivos (bar chart)
- Comparação com período anterior

---

## 📧 NEWSLETTER DASHBOARD

### 🎯 KPIs PRINCIPAIS (Topo)

#### Card 1: Inscritos
```
📊 Valor: 15.2K
📈 Variação: +8.5% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 2: Taxa de Abertura (Open Rate)
```
📊 Valor: 24.5%
📈 Variação: +2.1% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Fórmula:** (Emails abertos / Emails entregues) × 100

#### Card 3: Taxa de Cliques (Click Rate)
```
📊 Valor: 3.8%
📈 Variação: +0.5% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Fórmula:** (Cliques únicos / Emails entregues) × 100

#### Card 4: Taxa de Rejeição (Bounce Rate)
```
📊 Valor: 1.2%
📈 Variação: -0.3% vs período anterior (melhorou)
📉 Sparkline: Tendência dos últimos 14 dias
```

---

### 📈 GRÁFICOS DE TENDÊNCIA (Meio)

#### Gráfico 1: Taxas de Abertura e Cliques (Dual Line Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Porcentagem (%)
**Linha 1:** Open Rate (azul, linha principal)
**Linha 2:** Click Rate (verde, linha secundária)

**Comparação:** Linhas pontilhadas período anterior

#### Gráfico 2: Emails Enviados e Abertos (Stacked Area Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Quantidade
**Áreas:**
- Enviados (cinza claro)
- Entregues (cinza médio)
- Abertos (azul)
- Cliques (verde)

#### Gráfico 3: Crescimento de Inscritos (Area Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Quantidade de inscritos
**Área:** Novos inscritos (verde)
**Linha:** Total de inscritos (azul, linha superior)

**Comparação:** Overlay período anterior

---

### 📋 ANÁLISES DETALHADAS (Baixo)

#### Seção 1: Campanhas Top Performers
**Tabela com:**
- Assunto (subject)
- Data de envio
- Enviados
- Entregues
- Abertos
- Open Rate (%)
- Cliques
- Click Rate (%)
- Comparação com média

**Ordenação:** Por open rate (descendente)

#### Seção 2: Análise de Assuntos
- Assuntos com melhor performance
- Gráfico de barras: Open Rate por assunto
- Palavras-chave mais efetivas

#### Seção 3: Análise de Cancelamentos
- Taxa de cancelamento
- Tendência ao longo do tempo
- Razões principais (se disponível)

---

## 🐦 TWITTER/X DASHBOARD

### 🎯 KPIs PRINCIPAIS (Topo)

#### Card 1: Seguidores
```
📊 Valor: 12.8K
📈 Variação: +5.2% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 2: Impressões
```
📊 Valor: 234.5K
📈 Variação: +18.3% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 3: Engajamentos
```
📊 Valor: 8.7K
📈 Variação: +12.1% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Inclui:** Likes, Retweets, Replies, Clicks

#### Card 4: Taxa de Engajamento
```
📊 Valor: 3.7%
📈 Variação: +0.4% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Fórmula:** (Engajamentos / Impressões) × 100

---

### 📈 GRÁFICOS DE TENDÊNCIA (Meio)

#### Gráfico 1: Impressões e Engajamentos (Dual Axis)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y Esquerdo:** Impressões (milhares)
**Eixo Y Direito:** Engajamentos (milhares)
**Barras:** Impressões (azul)
**Linha:** Engajamentos (verde)

**Comparação:** Overlay período anterior

#### Gráfico 2: Tipos de Engajamento (Stacked Bar Chart)
**Eixo X:** Datas (últimos 7 dias)
**Eixo Y:** Quantidade
**Stacks:**
- Likes (azul)
- Retweets (verde)
- Replies (laranja)
- Clicks (roxo)

#### Gráfico 3: Taxa de Engajamento (Line Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Porcentagem (%)
**Linha:** Taxa de engajamento (azul)
**Comparação:** Linha pontilhada período anterior

---

### 📋 ANÁLISES DETALHADAS (Baixo)

#### Seção 1: Tweets Top Performers
**Tabela com:**
- Preview do tweet (texto truncado)
- Data de publicação
- Impressões
- Engajamentos
- Taxa de Engajamento (%)
- Likes, Retweets, Replies, Clicks
- Comparação com média

**Ordenação:** Por engajamentos (descendente)

#### Seção 2: Análise de Horários
- Gráfico de calor: Dia da semana × Hora
- Melhores horários para postar
- Comparação com período anterior

#### Seção 3: Análise de Hashtags e Menções
- Hashtags mais usadas
- Performance por hashtag
- Menções mais engajadas

---

## 💼 LINKEDIN DASHBOARD

### 🎯 KPIs PRINCIPAIS (Topo)

#### Card 1: Seguidores
```
📊 Valor: 8.5K
📈 Variação: +4.2% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 2: Impressões
```
📊 Valor: 156.2K
📈 Variação: +15.8% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

#### Card 3: Engajamentos
```
📊 Valor: 6.4K
📈 Variação: +9.3% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```
**Inclui:** Likes, Comentários, Compartilhamentos, Clicks

#### Card 4: Taxa de Engajamento
```
📊 Valor: 4.1%
📈 Variação: +0.3% vs período anterior
📉 Sparkline: Tendência dos últimos 14 dias
```

---

### 📈 GRÁFICOS DE TENDÊNCIA (Meio)

#### Gráfico 1: Alcance e Impressões (Dual Axis)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y Esquerdo:** Alcance (milhares)
**Eixo Y Direito:** Impressões (milhares)
**Barras:** Alcance (azul)
**Linha:** Impressões (laranja)

**Comparação:** Overlay período anterior

#### Gráfico 2: Engajamento por Tipo (Stacked Area Chart)
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Quantidade
**Áreas empilhadas:**
- Likes (azul)
- Comentários (verde)
- Compartilhamentos (laranja)
- Clicks (roxo)

#### Gráfico 3: Visualizações de Perfil
**Eixo X:** Datas (últimos 30 dias)
**Eixo Y:** Quantidade
**Linha:** Visualizações (azul)
**Comparação:** Linha pontilhada período anterior

---

### 📋 ANÁLISES DETALHADAS (Baixo)

#### Seção 1: Posts Top Performers
**Tabela com:**
- Preview do post (texto/imagem)
- Data de publicação
- Alcance
- Impressões
- Engajamentos
- Taxa de Engajamento (%)
- Likes, Comentários, Compartilhamentos
- Comparação com média

**Ordenação:** Por engajamentos (descendente)

#### Seção 2: Análise de Audiência
- Demografia: Setor, Tamanho da empresa, Função
- Gráficos de barras horizontais
- Comparação com período anterior

#### Seção 3: Análise de Conteúdo
- Tipos de post mais efetivos (texto, imagem, vídeo, artigo)
- Performance por tipo
- Gráfico de barras comparativo

---

## 📐 LAYOUT RECOMENDADO

### Estrutura Visual:

```
┌─────────────────────────────────────────┐
│ 📊 KPIs PRINCIPAIS (4 cards)            │
│ [Card] [Card] [Card] [Card]            │
│ (Grid 4 colunas, 1 linha)              │
├─────────────────────────────────────────┤
│ 📈 GRÁFICO PRINCIPAL                    │
│ (Largura total, altura média)          │
│ - Gráfico de tendência mais importante │
├─────────────────────────────────────────┤
│ 📊 GRÁFICOS SECUNDÁRIOS                 │
│ [Gráfico] [Gráfico]                    │
│ (Grid 2 colunas)                       │
├─────────────────────────────────────────┤
│ 📋 TABELA TOP PERFORMERS                │
│ (Largura total)                        │
│ - Primeiros 10 itens                   │
│ - Paginação opcional                   │
├─────────────────────────────────────────┤
│ 📊 ANÁLISES EXTRAS (Colapsáveis)        │
│ - Hashtags, Horários, Demografia, etc  │
│ (Opcional, colapsado por padrão)       │
└─────────────────────────────────────────┘
```

---

## 🎨 PADRÕES DE DESIGN

### Cards de KPI:
- **Tamanho:** Altura fixa, largura flexível
- **Padding:** `p-6`
- **Border radius:** `rounded-xl`
- **Sombra:** `shadow-sm`
- **Layout:**
  - Valor grande (text-3xl ou text-4xl)
  - Label pequeno (text-sm, muted)
  - Variação com ícone (+/-)
  - Sparkline pequeno (altura ~40px)

### Gráficos:
- **Padding:** `p-6`
- **Border radius:** `rounded-xl`
- **Background:** `bg-card`
- **Cores:** Paleta consistente por tipo de métrica
- **Legendas:** Sempre visíveis e claras
- **Tooltips:** Informações detalhadas no hover

### Tabelas:
- **Padding:** `p-6`
- **Header:** Background muted, texto semibold
- **Rows:** Hover state sutil
- **Bordas:** Apenas entre linhas (border-b)

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Para Cada Dashboard:
- [ ] KPIs principais no topo (4 cards)
- [ ] Comparação com período anterior em todos os KPIs
- [ ] Sparklines nos cards de KPI
- [ ] Gráfico principal de tendência
- [ ] Gráficos secundários (2-3 gráficos)
- [ ] Tabela de top performers
- [ ] Análises extras (colapsáveis)
- [ ] Cores consistentes
- [ ] Responsivo (mobile-friendly)
- [ ] Loading states (skeleton)
- [ ] Empty states (quando sem dados)

---

**Nota:** Este documento serve como guia completo para implementar dashboards funcionais e úteis para cada cliente, priorizando as informações mais importantes primeiro.

