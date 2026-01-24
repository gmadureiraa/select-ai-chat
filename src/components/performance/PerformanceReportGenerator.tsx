import { FileText, Download, X, Loader2, Sparkles, History, Trash2, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePerformanceReport } from "@/hooks/usePerformanceReport";
import { exportToPDF, downloadFile } from "@/lib/exportConversation";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PerformanceReportGeneratorProps {
  clientId: string;
  platform: string;
  period: string;
  kpis: Record<string, any>;
  previousKpis?: Record<string, any>;
  posts?: any[];
  previousPosts?: any[];
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
  previousKpis,
  posts,
  previousPosts,
  videos,
  metrics,
  open,
  onOpenChange
}: PerformanceReportGeneratorProps) {
  const { 
    generateReport, 
    isGenerating, 
    report, 
    clearReport,
    savedReports,
    isLoadingReports,
    loadReport,
    deleteReport,
    isDeletingReport
  } = usePerformanceReport(clientId);
  
  const [showHistory, setShowHistory] = useState(false);

  const handleGenerate = async () => {
    await generateReport({
      platform,
      period,
      kpis,
      previousKpis,
      posts,
      previousPosts,
      videos,
      metrics
    });
  };

  const handleExportPDF = async () => {
    if (!report) return;

    const content = [
      { role: "assistant", content: report.fullContent, id: "1" }
    ];

    const blob = await exportToPDF(content, platform);
    downloadFile(blob, `analise-${platform.toLowerCase()}-${period.replace(/\s/g, '-')}.pdf`, "application/pdf");
  };

  const handleClose = () => {
    clearReport();
    setShowHistory(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {showHistory ? "Histórico de Análises" : `Análise Estratégica - ${platform}`}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) clearReport();
              }}
              className="text-muted-foreground"
            >
              {showHistory ? (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Nova Análise
                </>
              ) : (
                <>
                  <History className="h-4 w-4 mr-1" />
                  Histórico ({savedReports.length})
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          {showHistory ? (
            <div className="space-y-3 py-4">
              {isLoadingReports ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : savedReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma análise salva ainda.</p>
                </div>
              ) : (
                savedReports.map((savedReport) => (
                  <Card 
                    key={savedReport.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      loadReport(savedReport);
                      setShowHistory(false);
                    }}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {savedReport.platform}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {savedReport.period}
                          </span>
                        </div>
                        <p className="font-medium text-sm">{savedReport.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(savedReport.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteReport(savedReport.id);
                          }}
                          disabled={isDeletingReport}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : !report ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Gerar Análise Estratégica</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Análise completa com KPIs, comparação com período anterior, análise detalhada dos top posts, insights e recomendações estratégicas.
              </p>
              {previousKpis && previousPosts && previousPosts.length > 0 && (
                <Badge variant="secondary" className="mb-4">
                  ✓ Comparação com período anterior disponível
                </Badge>
              )}
              <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando análise...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Análise
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="py-4 px-2 space-y-6">
              {/* Content Recommendations Card */}
              {report.contentRecommendations && report.contentRecommendations.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Ideias de Conteúdo Baseadas no que Funcionou
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {report.contentRecommendations.map((rec, index) => (
                      <div key={index} className="p-3 bg-background rounded-lg border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {rec.format}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{rec.description}</p>
                        <p className="text-xs text-muted-foreground italic">
                          Baseado em: {rec.basedOn}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Full Report */}
              <div className="prose prose-sm dark:prose-invert max-w-none">
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
                  {report.fullContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </ScrollArea>

        {report && !showHistory && (
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
