

# Plano Completo: Corrigir Relatório de Performance

## Problemas Identificados

Baseado na minha análise detalhada, identifiquei **4 problemas principais**:

### Problema 1: Relatório exibindo apenas "Ideias de Conteúdo"
O relatório mostra apenas o card de "Ideias de Conteúdo Baseadas no que Funcionou" porque:
- O `report.fullContent` está vazio ou a IA está retornando apenas uma parte do conteúdo
- A função `parseReportResponse()` cria um fallback mínimo quando o parsing falha
- Resultado: O relatório exibe o `contentRecommendations` default, mas não o conteúdo completo

### Problema 2: PDF exporta vazio
- A função `exportToPDF()` foi criada para conversas (chat), não para relatórios
- Ela espera um array de `{role, content}` e renderiza com header "Você/Assistente"
- Não há formatação de título com data do período
- O Markdown não é convertido para formatação PDF

### Problema 3: Relatórios não vão para a Biblioteca
- Os relatórios são salvos na tabela `performance_reports` (separada)
- Não são adicionados à `client_content_library` (que alimenta a aba Biblioteca)
- O usuário quer que ao gerar, vá automaticamente para a Biblioteca

### Problema 4: Falta coluna "Ganho de Seguidores" na tabela de Posts
- A tabela `InstagramPostsTableAdvanced` não tem coluna para seguidores
- **NOTA:** Esta é uma métrica de perfil, não de post individual
- O Instagram não fornece "seguidores ganhos por post"
- Porém, podemos mostrar uma coluna informativa ou badge

---

## Fase 1: Corrigir Geração do Relatório

### 1.1 Melhorar a chamada à IA
**Arquivo:** `src/hooks/usePerformanceReport.ts`

O problema está na resposta da edge function. Vamos:
1. Adicionar melhor logging para debug
2. Verificar se `result?.content` está vindo corretamente
3. Adicionar fallback mais robusto

```typescript
// Linha ~173-185
const { data: result, error } = await supabase.functions.invoke("kai-content-agent", {
  body: {
    clientId,
    message: prompt,
    model: "google/gemini-2.5-flash",
    stream: false
  }
});

if (error) throw error;

console.log("[PerformanceReport] AI Response:", result);

const fullContent = result?.content || result?.message || result?.text || "";

if (!fullContent || fullContent.length < 100) {
  throw new Error("Resposta da IA vazia ou muito curta");
}
```

### 1.2 Adicionar Data do Período no Título
**Arquivo:** `src/hooks/usePerformanceReport.ts`

Modificar `parseReportResponse()` para incluir as datas:

```typescript
// Na função parseReportResponse
const today = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
const title = `Análise de Performance - ${data.platform} | ${data.period} | Gerado em ${today}`;
```

---

## Fase 2: Criar Exportador de PDF Dedicado para Relatórios

### 2.1 Novo Utilitário de Exportação
**Novo arquivo:** `src/lib/exportReport.ts`

Criar função especializada para exportar relatórios:

```typescript
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportExportData {
  title: string;
  platform: string;
  period: string;
  content: string;
  generatedAt: string;
}

export async function exportReportToPDF(report: ReportExportData): Promise<Blob> {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Header com logo/título
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`Relatório de Performance`, margin, yPos);
  yPos += 10;
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(report.platform, margin, yPos);
  yPos += 8;

  // Período em destaque
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Período: ${report.period}`, margin, yPos);
  yPos += 6;
  doc.text(`Gerado em: ${report.generatedAt}`, margin, yPos);
  yPos += 10;

  // Separador
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Converter Markdown para texto limpo
  const cleanContent = report.content
    .replace(/#{1,3}\s*/g, '')  // Remove headers markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove bold
    .replace(/\*(.+?)\*/g, '$1')  // Remove italic
    .replace(/[-•]\s*/g, '• ');  // Normaliza bullets

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);

  const lines = doc.splitTextToSize(cleanContent, maxWidth);
  
  for (const line of lines) {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, margin, yPos);
    yPos += 5;
  }

  return doc.output("blob");
}
```

### 2.2 Atualizar Exportação no PerformanceReportGenerator
**Arquivo:** `src/components/performance/PerformanceReportGenerator.tsx`

```typescript
import { exportReportToPDF } from "@/lib/exportReport";

const handleExportPDF = async () => {
  if (!report) return;

  const blob = await exportReportToPDF({
    title: report.title,
    platform,
    period,
    content: report.fullContent,
    generatedAt: report.createdAt 
      ? format(new Date(report.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  });
  
  downloadFile(blob, `relatorio-${platform.toLowerCase()}-${period.replace(/\s/g, '-')}.pdf`, "application/pdf");
};
```

---

## Fase 3: Salvar Relatório Automaticamente na Biblioteca

### 3.1 Adicionar à Biblioteca após Geração
**Arquivo:** `src/hooks/usePerformanceReport.ts`

Após salvar na `performance_reports`, também adicionar na `client_content_library`:

```typescript
// Após saveReportMutation (linha ~200)
const savedReport = await saveReportMutation.mutateAsync({...});

// Também salvar na biblioteca de conteúdo
const { error: libraryError } = await supabase
  .from("client_content_library")
  .insert({
    client_id: clientId,
    title: parsedReport.title,
    content_type: 'report',
    content: fullContent,
    metadata: {
      platform: data.platform,
      period: data.period,
      kpis: data.kpis,
      performance_report_id: savedReport.id,
      generated_at: new Date().toISOString()
    }
  });

if (libraryError) {
  console.error("[PerformanceReport] Library save error:", libraryError);
}
```

### 3.2 Atualizar Toast de Confirmação
```typescript
toast({
  title: "Análise gerada!",
  description: "Relatório salvo na Biblioteca de Conteúdo."
});
```

---

## Fase 4: Exibir Período no Modal do Relatório

### 4.1 Mostrar Período no Header do Modal
**Arquivo:** `src/components/performance/PerformanceReportGenerator.tsx`

```typescript
// Linha ~89-93
<DialogTitle className="flex items-center justify-between">
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <Sparkles className="h-5 w-5 text-primary" />
      <span>Análise Estratégica - {platform}</span>
    </div>
    {!showHistory && (
      <span className="text-xs font-normal text-muted-foreground">
        Período: {period}
      </span>
    )}
  </div>
  {/* botão histórico... */}
</DialogTitle>
```

### 4.2 Exibir Data no Relatório Renderizado
Antes do card de "Ideias de Conteúdo", adicionar header com período:

```typescript
{report && !showHistory && (
  <div className="mb-4 p-4 bg-muted/30 rounded-lg border">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="font-semibold">{report.title}</h2>
        <p className="text-sm text-muted-foreground">
          Período: {period} | Gerado em: {report.createdAt 
            ? format(new Date(report.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
            : format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  </div>
)}
```

---

## Fase 5: Sobre a Coluna de "Ganho de Seguidores" nos Posts

### Esclarecimento Técnico
O Instagram **não fornece** métrica de "seguidores ganhos" por post individual. Esta métrica existe apenas a nível de perfil/conta:
- `performance_metrics.subscribers` = seguidores ganhos no dia
- Não há relação direta com posts específicos

### Alternativas Possíveis

**Opção A: Badge Informativo na Tabela**
Mostrar um badge ou tooltip explicando que esta métrica está nos KPIs do topo:

```typescript
// Adicionar coluna informativa (não funcional para ordenação)
{ id: "followers_info" as any, label: "Seguidores", sortable: false, defaultVisible: false, width: "90px" }

// Na renderização:
<TableCell>
  <Badge variant="secondary" className="text-xs">
    Ver KPIs
  </Badge>
</TableCell>
```

**Opção B: Não adicionar coluna (recomendado)**
Manter a métrica apenas nos KPIs do topo, onde está correta. Adicionar uma coluna vazia ou de "N/A" pode confundir usuários.

---

## Fase 6: Debug da Resposta Vazia da IA

### 6.1 Verificar Edge Function kai-content-agent
**Arquivo:** `supabase/functions/kai-content-agent/index.ts`

Verificar se a função está retornando o conteúdo corretamente:
- Conferir se `stream: false` retorna `{ content: string }`
- Adicionar logging para debug

### 6.2 Adicionar Loading State Melhor
Mostrar progresso mais detalhado durante geração:

```typescript
{isGenerating && (
  <div className="text-center py-8">
    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
    <p className="mt-4 text-muted-foreground">Gerando análise estratégica...</p>
    <p className="text-xs text-muted-foreground mt-1">
      Isso pode levar até 30 segundos
    </p>
  </div>
)}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `usePerformanceReport.ts` | Debug da IA, salvar na biblioteca, melhor parsing, incluir datas |
| `PerformanceReportGenerator.tsx` | Exibir período, nova exportação, header com datas |
| `exportReport.ts` | **NOVO** - Exportador de PDF dedicado para relatórios |
| `kai-content-agent/index.ts` | Verificar/debug resposta |

---

## Resultado Esperado

### Relatório Gerado
- Conteúdo completo (não apenas ideias)
- Período exibido no header
- Data de geração visível
- Comparação com período anterior

### Exportação PDF
- Título com plataforma
- Período em destaque
- Data de geração
- Conteúdo formatado corretamente

### Biblioteca
- Relatório salvo automaticamente
- Tipo: "report"
- Acessível na aba Relatórios da Biblioteca

### Tabela de Posts
- Mantém colunas atuais
- Seguidores = métrica de perfil (KPIs do topo)

