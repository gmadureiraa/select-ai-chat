import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReportData {
  platform: string;
  period: string;
  kpis: Record<string, any>;
  posts?: any[];
  videos?: any[];
  metrics?: any[];
}

interface GeneratedReport {
  title: string;
  summary: string;
  highlights: string[];
  insights: string[];
  recommendations: string[];
  topContent: {
    title: string;
    metric: string;
    value: number;
  }[];
}

export function usePerformanceReport(clientId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const { toast } = useToast();

  const generateReport = async (data: ReportData): Promise<GeneratedReport | null> => {
    if (!clientId) return null;

    setIsGenerating(true);

    try {
      const prompt = buildReportPrompt(data);

      const { data: result, error } = await supabase.functions.invoke("execute-agent", {
        body: {
          agentType: "metrics_analyst",
          prompt,
          clientId,
          includeContext: false
        }
      });

      if (error) throw error;

      // Parse the response into structured report
      const parsedReport = parseReportResponse(result?.content || "", data);
      setReport(parsedReport);

      toast({
        title: "Relatório gerado!",
        description: "Análise de performance concluída com insights de IA."
      });

      return parsedReport;
    } catch (error) {
      console.error("[PerformanceReport] Error:", error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearReport = () => setReport(null);

  return {
    generateReport,
    isGenerating,
    report,
    clearReport
  };
}

function buildReportPrompt(data: ReportData): string {
  const { platform, period, kpis, posts, videos } = data;

  let prompt = `Analise os dados de performance do ${platform} no período de ${period} e gere um relatório executivo.

DADOS DE PERFORMANCE:
${JSON.stringify(kpis, null, 2)}

`;

  if (posts && posts.length > 0) {
    prompt += `TOP 5 POSTS:
${posts.slice(0, 5).map((p: any, i: number) => `${i + 1}. ${p.caption?.slice(0, 50) || 'Sem legenda'} - Engajamento: ${p.engagement_rate || 0}%`).join('\n')}

`;
  }

  if (videos && videos.length > 0) {
    prompt += `TOP 5 VÍDEOS:
${videos.slice(0, 5).map((v: any, i: number) => `${i + 1}. ${v.title?.slice(0, 50) || 'Sem título'} - Views: ${v.views || 0}`).join('\n')}

`;
  }

  prompt += `
FORMATO DA RESPOSTA:
1. RESUMO EXECUTIVO (2-3 frases sobre o desempenho geral)
2. DESTAQUES (3 conquistas ou números importantes)
3. INSIGHTS (3 observações baseadas nos dados)
4. RECOMENDAÇÕES (3 ações concretas para melhorar)
5. MELHOR CONTEÚDO (qual post/vídeo performou melhor e por quê)

Seja direto, use números específicos dos dados fornecidos, e foque em insights acionáveis.`;

  return prompt;
}

function parseReportResponse(content: string, data: ReportData): GeneratedReport {
  // Basic parsing - extract sections from the response
  const sections = content.split(/\d\.\s*(?:RESUMO|DESTAQUES|INSIGHTS|RECOMENDAÇÕES|MELHOR)/i);
  
  // Extract bullet points or numbered items
  const extractItems = (text: string): string[] => {
    const items = text.match(/[-•]\s*(.+?)(?=\n[-•]|\n\n|$)/gs) || [];
    return items.map(item => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean).slice(0, 5);
  };

  const highlights = extractItems(sections[2] || '');
  const insights = extractItems(sections[3] || '');
  const recommendations = extractItems(sections[4] || '');

  return {
    title: `Relatório de Performance - ${data.platform}`,
    summary: sections[1]?.trim() || "Análise do período concluída.",
    highlights: highlights.length > 0 ? highlights : ["Dados coletados com sucesso", "Métricas analisadas", "Tendências identificadas"],
    insights: insights.length > 0 ? insights : ["Continue monitorando as métricas", "Foco em engajamento", "Acompanhe a evolução"],
    recommendations: recommendations.length > 0 ? recommendations : ["Mantenha a consistência", "Experimente novos formatos", "Analise a concorrência"],
    topContent: []
  };
}
