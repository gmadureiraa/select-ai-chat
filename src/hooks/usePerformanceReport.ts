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

  // Calculate averages if posts exist
  const totalPosts = posts?.length || 0;
  const avgLikes = totalPosts > 0 ? Math.round((kpis.totalLikes || 0) / totalPosts) : 0;
  const avgComments = totalPosts > 0 ? Math.round((kpis.totalComments || 0) / totalPosts) : 0;
  const avgShares = totalPosts > 0 ? Math.round((kpis.totalShares || 0) / totalPosts) : 0;
  const avgSaves = totalPosts > 0 ? Math.round((kpis.totalSaves || 0) / totalPosts) : 0;
  const avgReach = totalPosts > 0 ? Math.round((kpis.totalReach || 0) / totalPosts) : 0;

  let prompt = `Você é um analista de marketing digital especializado em redes sociais. Gere um RELATÓRIO ESTRATÉGICO DE PERFORMANCE profissional para ${platform}.

═══════════════════════════════════════════════════════════════
DADOS DO PERÍODO: ${period}
═══════════════════════════════════════════════════════════════

## MÉTRICAS MACRO (KPIs)
- Total de posts: ${totalPosts}
- Visualizações: ${(kpis.totalViews || 0).toLocaleString()}
- Alcance: ${(kpis.totalReach || 0).toLocaleString()}
- Interações totais: ${(kpis.totalInteractions || 0).toLocaleString()}
- Curtidas: ${(kpis.totalLikes || 0).toLocaleString()}
- Comentários: ${(kpis.totalComments || 0).toLocaleString()}
- Compartilhamentos: ${(kpis.totalShares || 0).toLocaleString()}
- Salvamentos: ${(kpis.totalSaves || 0).toLocaleString()}
- Novos seguidores: ${(kpis.followersGained || 0).toLocaleString()}
- Engajamento médio: ${(kpis.avgEngagement || 0).toFixed(2)}%

## MÉDIAS POR POST
- Curtidas/post: ${avgLikes.toLocaleString()}
- Comentários/post: ${avgComments}
- Compartilhamentos/post: ${avgShares}
- Salvamentos/post: ${avgSaves}
- Alcance/post: ${avgReach.toLocaleString()}

`;

  if (posts && posts.length > 0) {
    const topPosts = [...posts]
      .sort((a: any, b: any) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
      .slice(0, 5);
    
    prompt += `## TOP 5 POSTS (por engajamento)
${topPosts.map((p: any, i: number) => 
  `${i + 1}. [${p.post_type || 'post'}] "${p.caption?.slice(0, 80) || 'Sem legenda'}..."
   • Curtidas: ${p.likes || 0} | Comentários: ${p.comments || 0} | Salvamentos: ${p.saves || 0} | Compartilhamentos: ${p.shares || 0}
   • Alcance: ${(p.reach || 0).toLocaleString()} | Engajamento: ${(p.engagement_rate || 0).toFixed(2)}%`
).join('\n\n')}

`;
  }

  if (videos && videos.length > 0) {
    prompt += `## TOP 5 VÍDEOS (por views)
${videos.slice(0, 5).map((v: any, i: number) => 
  `${i + 1}. "${v.title?.slice(0, 60) || 'Sem título'}..."
   • Views: ${(v.total_views || v.views || 0).toLocaleString()} | Horas assistidas: ${(v.watch_hours || 0).toFixed(1)}h
   • CTR: ${(v.click_rate || 0).toFixed(2)}% | Inscritos ganhos: ${v.subscribers_gained || 0}`
).join('\n\n')}

`;
  }

  prompt += `
═══════════════════════════════════════════════════════════════
FORMATO OBRIGATÓRIO DO RELATÓRIO
═══════════════════════════════════════════════════════════════

Gere o relatório EXATAMENTE neste formato:

# RELATÓRIO ESTRATÉGICO DE PERFORMANCE: ${platform.toUpperCase()}
**Período:** ${period}

---

## 1. RESUMO EXECUTIVO
[2-3 parágrafos com visão geral do desempenho, contextualizando os números principais e a tendência geral do período]

---

## 2. PERFORMANCE MACRO (KPIs)
Análise detalhada das métricas principais com interpretação:

| Métrica | Valor | Análise |
|---------|-------|---------|
| Alcance | [valor] | [breve interpretação] |
| Impressões | [valor] | [breve interpretação] |
| Engajamento | [valor]% | [breve interpretação] |

**Análise Técnica:** [Parágrafo explicando o que os números significam para a estratégia]

---

## 3. ANÁLISE DE ENGAJAMENTO
- **Total de interações:** [número]
- **Curtidas:** [número] ([porcentagem do total])
- **Comentários:** [número] ([porcentagem do total])
- **Compartilhamentos:** [número] ([porcentagem do total])
- **Salvamentos:** [número] ([porcentagem do total])

**Análise Técnica:** [Explicar qual tipo de engajamento está mais forte e o que isso indica]

---

## 4. DESTAQUES: TOP 3 POSTS DO PERÍODO
Para cada post, inclua:
1. **[Título/Tema do post]**
   - Tipo: [tipo]
   - Métricas: [curtidas, comentários, salvamentos]
   - Engajamento: [%]
   - **Por que performou bem:** [análise do que funcionou]

---

## 5. INSIGHTS E PADRÕES IDENTIFICADOS
Liste 3-5 padrões observados nos dados:
- 📊 [Insight 1 com dados específicos]
- 📈 [Insight 2 com dados específicos]
- 💡 [Insight 3 com dados específicos]

---

## 6. RECOMENDAÇÕES ESTRATÉGICAS
Liste 3-5 ações concretas baseadas nos dados:
1. **[Ação 1]:** [Justificativa baseada nos dados]
2. **[Ação 2]:** [Justificativa baseada nos dados]
3. **[Ação 3]:** [Justificativa baseada nos dados]

---

REGRAS IMPORTANTES:
- Use APENAS os dados fornecidos, nunca invente números
- Cite valores específicos e porcentagens
- Seja objetivo e prático
- Destaque tanto pontos fortes quanto oportunidades de melhoria
- Use emojis para facilitar a leitura
- Formate em Markdown válido`;

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
