
# Plano: Melhorar Dashboard de Performance

## Visão Geral
Você solicitou várias melhorias no dashboard de Performance do Instagram:
1. **Remover ContentLearningsCard** - substituir pelo botão de "Gerar Análise" no topo
2. **Melhorar o relatório AI** - comparar com período anterior, explicar por que os top 3 posts performaram bem
3. **Simplificar "Métricas de Postagens"** - remover "melhor post de cada métrica", deixar só os dados comparados
4. **Top 3 Posts** - remover medalhas e entender por que "ganho de seguidores" não aparece nos posts

---

## Fase 1: Reorganizar Header - Botão "Gerar Análise" no Topo

### 1.1 Remover ContentLearningsCard
**Arquivo:** `src/components/performance/InstagramDashboard.tsx`

Remover a seção que usa `ContentLearningsCard` (linhas 815-821):
```typescript
// REMOVER:
{filteredPosts.length >= 5 && (
  <ContentLearningsCard
    clientId={clientId}
    posts={filteredPosts}
  />
)}
```

### 1.2 Mover Botão "Gerar Análise" para Header
No header (linha ~646-655), substituir "Relatório IA" por "Gerar Análise" com destaque visual:

```typescript
// De:
<Button 
  variant="outline" 
  className="border-border/50"
  onClick={() => setShowReportGenerator(true)}
>
  <FileText className="h-4 w-4 mr-2" />
  Relatório IA
</Button>

// Para:
<Button 
  onClick={() => setShowReportGenerator(true)}
  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
>
  <Sparkles className="h-4 w-4" />
  Gerar Análise
</Button>
```

---

## Fase 2: Melhorar Relatório de Performance

### 2.1 Atualizar Hook com Comparação de Período
**Arquivo:** `src/hooks/usePerformanceReport.ts`

Adicionar dados do período anterior ao prompt e melhorar a estrutura:

```typescript
interface ReportData {
  platform: string;
  period: string;
  kpis: Record<string, any>;
  previousKpis?: Record<string, any>; // NOVO
  posts?: any[];
  previousPosts?: any[]; // NOVO
  videos?: any[];
  metrics?: any[];
}
```

### 2.2 Atualizar buildReportPrompt para Incluir Comparação
Modificar o prompt para:
1. Incluir métricas do período anterior
2. Calcular variações percentuais
3. Pedir análise detalhada do motivo de cada top post performar bem

```typescript
// Adicionar ao prompt:
## COMPARAÇÃO COM PERÍODO ANTERIOR
- Alcance: ${current} vs ${previous} (${change}%)
- Engajamento: ${current}% vs ${previous}% (${change}%)
- Seguidores ganhos: ${current} vs ${previous} (${change}%)
...

## ANÁLISE OBRIGATÓRIA DOS TOP 3 POSTS
Para cada post, analise:
1. O tipo/formato do conteúdo
2. Elementos da legenda/copy que engajaram
3. Possíveis motivos do sucesso (timing, tema, formato)
4. Padrões que podem ser replicados
```

### 2.3 Passar Dados do Período Anterior ao Relatório
**Arquivo:** `src/components/performance/InstagramDashboard.tsx`

```typescript
<PerformanceReportGenerator
  clientId={clientId}
  platform="Instagram"
  period={selectedPeriodLabel}
  kpis={kpis}
  previousKpis={previousKpis} // NOVO
  posts={filteredPosts}
  previousPosts={previousPeriodPosts} // NOVO
  metrics={filteredMetrics}
  open={showReportGenerator}
  onOpenChange={setShowReportGenerator}
/>
```

---

## Fase 3: Simplificar "Métricas de Postagens"

### 3.1 Remover "Melhor Post" de Cada Card
**Arquivo:** `src/components/performance/BestPostsByMetric.tsx`

Modificar o componente `MetricCard` para não renderizar o "Melhor post":

```typescript
// REMOVER do MetricCard (linhas 79-95):
{post && post.thumbnail_url && (
  <div className="mt-3 pt-3 border-t border-border/30">
    <p className="text-xs text-muted-foreground mb-2">Melhor post:</p>
    ...
  </div>
)}

// Também remover o prop `post` de todas as chamadas de MetricCard
```

### 3.2 Resultado Final do BestPostsByMetric
Cada card terá apenas:
- Nome da métrica
- Valor atual
- Comparação com período anterior (△ %)

---

## Fase 4: Remover Medalhas do Top 3 Posts

### 4.1 Atualizar TopPostsGrid
**Arquivo:** `src/components/performance/TopPostsGrid.tsx`

Remover as medalhas (🥇🥈🥉) e usar um design mais limpo:

```typescript
// REMOVER (linhas 31-35):
const rankingColors = [
  { bg: "bg-amber-500", text: "text-amber-950", icon: "🥇" },
  { bg: "bg-slate-400", text: "text-slate-950", icon: "🥈" },
  { bg: "bg-amber-700", text: "text-amber-50", icon: "🥉" },
];

// SUBSTITUIR (linhas 146-151) por número simples:
<div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-xs font-bold">
  {index + 1}
</div>
```

---

## Fase 5: Entender a Métrica de "Ganho de Seguidores"

### Diagnóstico
A métrica de **"Seguidores Ganhos"** (`followersGained`) é calculada a partir da tabela `performance_metrics` (campo `subscribers`), **NÃO dos posts individuais**. Isso é correto porque:

1. **Posts não têm a métrica de seguidores** - O Instagram não fornece "quantos seguidores um post específico gerou"
2. **A métrica é diária/global** - Os seguidores ganhos são importados via CSV de métricas do perfil, não de posts

### Solução
Essa métrica já aparece corretamente nos **KPIs do topo** (linha 731-739):
```typescript
<StatCard
  icon={Users}
  label="Novos Seguidores"
  value={kpis.followersGained}
  change={period !== "all" ? kpis.followersChange : undefined}
  sparklineData={sparklineData.followers}
  color="amber"
/>
```

Se você quer que apareça também no **BestPostsByMetric**, podemos adicionar um card extra:

```typescript
// Adicionar em BestPostsByMetric:
<MetricCard
  icon={Users}
  label="Seguidores ganhos no período"
  value={followersGained} // Do metrics, não posts
  previousValue={prevFollowersGained}
  color="text-primary"
  helpText="Novos seguidores ganhos durante o período (métrica do perfil)"
/>
```

**Nota:** Precisaremos passar essa métrica como prop adicional, já que hoje o componente só recebe `posts`.

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `InstagramDashboard.tsx` | Remover ContentLearningsCard, destacar botão "Gerar Análise", passar previousKpis e previousPosts |
| `usePerformanceReport.ts` | Adicionar comparação com período anterior, melhorar prompt para análise dos top posts |
| `PerformanceReportGenerator.tsx` | Receber props de período anterior |
| `BestPostsByMetric.tsx` | Remover "melhor post" de cada card, adicionar card de seguidores |
| `TopPostsGrid.tsx` | Remover medalhas, usar números simples |

---

## Resultado Esperado

### Header
- ✅ Botão "Gerar Análise" destacado em verde/rosa (primary)
- ✅ Sem o card "Aprendizados de Conteúdo"

### Relatório AI (melhorado)
- ✅ Comparação explícita com período anterior (△ %)
- ✅ Top 3 posts com análise de **por que performou bem**
- ✅ Insights acionáveis baseados em padrões

### Métricas de Postagens
- ✅ Dados totais + comparação com período anterior
- ❌ Sem "melhor post" em cada métrica
- ✅ Card adicional de "Seguidores ganhos no período"

### Top 3 Posts
- ✅ Sem medalhas (🥇🥈🥉)
- ✅ Número simples (1, 2, 3) mais discreto
