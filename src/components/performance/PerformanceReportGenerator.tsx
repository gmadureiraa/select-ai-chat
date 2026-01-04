import { FileText, Download, X, Loader2, Sparkles, TrendingUp, Lightbulb, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePerformanceReport } from "@/hooks/usePerformanceReport";
import { exportToPDF, downloadFile } from "@/lib/exportConversation";

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

    const content = [
      { role: "assistant", content: `# ${report.title}\n\n## Resumo\n${report.summary}`, id: "1" },
      { role: "assistant", content: `## Destaques\n${report.highlights.map(h => `- ${h}`).join('\n')}`, id: "2" },
      { role: "assistant", content: `## Insights\n${report.insights.map(i => `- ${i}`).join('\n')}`, id: "3" },
      { role: "assistant", content: `## Recomendações\n${report.recommendations.map(r => `- ${r}`).join('\n')}`, id: "4" }
    ];

    const blob = await exportToPDF(content, platform);
    downloadFile(blob, `relatorio-${platform}-${period}.pdf`, "application/pdf");
  };

  const handleClose = () => {
    clearReport();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório de Performance - {platform}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          {!report ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Gerar Relatório com IA</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Analise seus dados de performance e receba insights, destaques e recomendações personalizadas.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisando dados...
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
            <div className="space-y-6 py-2">
              {/* Summary */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <h4 className="font-semibold mb-2">Resumo Executivo</h4>
                <p className="text-sm text-foreground/80">{report.summary}</p>
              </div>

              {/* Highlights */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Destaques
                </h4>
                <ul className="space-y-2">
                  {report.highlights.map((highlight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500 mt-0.5">•</span>
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Insights */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Insights
                </h4>
                <ul className="space-y-2">
                  {report.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  Recomendações
                </h4>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500 mt-0.5">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
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
