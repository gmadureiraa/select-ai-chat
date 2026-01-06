import { FileText, Download, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePerformanceReport } from "@/hooks/usePerformanceReport";
import { exportToPDF, downloadFile } from "@/lib/exportConversation";
import ReactMarkdown from "react-markdown";

interface PerformanceReportGeneratorProps {
  clientId: string;
  platform: string;
  period: string;
  kpis: Record<string, any>;
  posts?: any[];
  videos?: any[];
  metrics?: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PerformanceReportGenerator({
  clientId,
  platform,
  period,
  kpis,
  posts,
  videos,
  metrics,
  open,
  onOpenChange
}: PerformanceReportGeneratorProps) {
  const { generateReport, isGenerating, report, clearReport } = usePerformanceReport(clientId);

  const handleGenerate = async () => {
    await generateReport({
      platform,
      period,
      kpis,
      posts,
      videos,
      metrics
    });
  };

  const handleExportPDF = async () => {
    if (!report) return;

    // Build markdown content for PDF
    const markdownContent = `# ${report.title}

## Resumo Executivo
${report.summary}

## Destaques
${report.highlights.map(h => `- ${h}`).join('\n')}

## Insights
${report.insights.map(i => `- ${i}`).join('\n')}

## Recomendações
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    const content = [
      { role: "assistant", content: markdownContent, id: "1" }
    ];

    const blob = await exportToPDF(content, platform);
    downloadFile(blob, `relatorio-${platform.toLowerCase()}-${period.replace(/\s/g, '-')}.pdf`, "application/pdf");
  };

  const handleClose = () => {
    clearReport();
    onOpenChange(false);
  };

  // Build full markdown from report sections
  const fullReportMarkdown = report ? `# ${report.title}

${report.summary}

---

## Destaques
${report.highlights.map(h => `- ${h}`).join('\n')}

---

## Insights
${report.insights.map(i => `- ${i}`).join('\n')}

---

## Recomendações
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
` : '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório Estratégico - {platform}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          {!report ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Gerar Relatório Estratégico</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Análise completa com KPIs, insights baseados em dados, top posts e recomendações estratégicas.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando relatório...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Relatório
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none py-4 px-2">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold text-foreground border-b border-border pb-2 mb-4">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-medium text-foreground mt-4 mb-2">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-foreground/90 mb-3 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-1.5 mb-4">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="space-y-2 mb-4 list-decimal list-inside">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm text-foreground/90 flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  hr: () => <hr className="my-4 border-border/50" />,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="w-full text-sm border border-border rounded-lg">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/50">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left font-medium text-foreground border-b border-border">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-foreground/80 border-b border-border/50">{children}</td>
                  ),
                }}
              >
                {fullReportMarkdown}
              </ReactMarkdown>
            </div>
          )}
        </ScrollArea>

        {report && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              <X className="mr-2 h-4 w-4" />
              Fechar
            </Button>
            <Button onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
