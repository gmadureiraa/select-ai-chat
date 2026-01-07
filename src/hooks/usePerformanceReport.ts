import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ReportData {
  platform: string;
  period: string;
  kpis: Record<string, any>;
  posts?: any[];
  videos?: any[];
  metrics?: any[];
}

interface ContentRecommendation {
  title: string;
  description: string;
  format: string;
  basedOn: string;
}

interface GeneratedReport {
  id?: string;
  title: string;
  summary: string;
  highlights: string[];
  insights: string[];
  recommendations: string[];
  contentRecommendations: ContentRecommendation[];
  topContent: {
    title: string;
    metric: string;
    value: number;
  }[];
  fullContent: string;
  createdAt?: string;
}

interface SavedReport {
  id: string;
  client_id: string;
  platform: string;
  period: string;
  title: string;
  content: string;
  summary: string | null;
  highlights: any;
  insights: any;
  recommendations: any;
  content_recommendations: any;
  top_content: any;
  kpis: any;
  created_at: string;
  created_by: string;
}

export function usePerformanceReport(clientId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch saved reports for this client
  const { data: savedReports = [], isLoading: isLoadingReports } = useQuery({
    queryKey: ["performance-reports", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("performance_reports")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SavedReport[];
    },
    enabled: !!clientId
  });

  // Save report mutation
  const saveReportMutation = useMutation({
    mutationFn: async (reportData: {
      platform: string;
      period: string;
      title: string;
      content: string;
      summary: string;
      highlights: string[];
      insights: string[];
      recommendations: string[];
      contentRecommendations: ContentRecommendation[];
      topContent: any[];
      kpis: Record<string, any>;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      
      if (!userId || !clientId) throw new Error("Missing user or client");

      const insertData = {
        client_id: clientId,
        platform: reportData.platform,
        period: reportData.period,
        title: reportData.title,
        content: reportData.content,
        summary: reportData.summary,
        highlights: reportData.highlights as unknown,
        insights: reportData.insights as unknown,
        recommendations: reportData.recommendations as unknown,
        content_recommendations: reportData.contentRecommendations as unknown,
        top_content: reportData.topContent as unknown,
        kpis: reportData.kpis as unknown,
        created_by: userId
      };

      const { data, error } = await supabase
        .from("performance_reports")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-reports", clientId] });
      toast({
        title: "Relatório salvo!",
        description: "O relatório foi salvo e pode ser acessado no histórico."
      });
    },
    onError: (error) => {
      console.error("[PerformanceReport] Save error:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o relatório.",
        variant: "destructive"
      });
    }
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("performance_reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-reports", clientId] });
      toast({
        title: "Relatório excluído",
        description: "O relatório foi removido do histórico."
      });
    }
  });

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

      const fullContent = result?.content || "";
      
      // Parse the response into structured report
      const parsedReport = parseReportResponse(fullContent, data);
      
      // Save to database
      const savedReport = await saveReportMutation.mutateAsync({
        platform: data.platform,
        period: data.period,
        title: parsedReport.title,
        content: fullContent,
        summary: parsedReport.summary,
        highlights: parsedReport.highlights,
        insights: parsedReport.insights,
        recommendations: parsedReport.recommendations,
        contentRecommendations: parsedReport.contentRecommendations,
        topContent: parsedReport.topContent,
        kpis: data.kpis
      });

      const reportWithId = {
        ...parsedReport,
        id: savedReport.id,
        fullContent,
        createdAt: savedReport.created_at
      };

      setReport(reportWithId);

      toast({
        title: "Relatório gerado e salvo!",
        description: "Análise de performance concluída com insights de IA."
      });

      return reportWithId;
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

  const loadReport = useCallback((savedReport: SavedReport) => {
    const contentRecs = Array.isArray(savedReport.content_recommendations) 
      ? savedReport.content_recommendations 
      : [];
    
    setReport({
      id: savedReport.id,
      title: savedReport.title,
      summary: savedReport.summary || "",
      highlights: Array.isArray(savedReport.highlights) ? savedReport.highlights : [],
      insights: Array.isArray(savedReport.insights) ? savedReport.insights : [],
      recommendations: Array.isArray(savedReport.recommendations) ? savedReport.recommendations : [],
      contentRecommendations: contentRecs,
      topContent: Array.isArray(savedReport.top_content) ? savedReport.top_content : [],
      fullContent: savedReport.content,
      createdAt: savedReport.created_at
    });
  }, []);

  const clearReport = () => setReport(null);

  return {
    generateReport,
    isGenerating,
    report,
    clearReport,
    savedReports,
    isLoadingReports,
    loadReport,
    deleteReport: deleteReportMutation.mutate,
    isDeletingReport: deleteReportMutation.isPending
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

## 7. IDEIAS DE CONTEÚDO BASEADAS NO QUE PERFORMOU BEM
Com base nos posts que mais engajaram, sugira 5 ideias de novos conteúdos:

1. **[Título da Ideia 1]**
   - Formato: [Reels/Carrossel/Stories/Post estático]
   - Descrição: [Breve descrição do conteúdo]
   - Baseado em: [Qual post/padrão inspirou essa ideia]

2. **[Título da Ideia 2]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência]

3. **[Título da Ideia 3]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência]

4. **[Título da Ideia 4]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência]

5. **[Título da Ideia 5]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência]

---

REGRAS IMPORTANTES:
- Use APENAS os dados fornecidos, nunca invente números
- Cite valores específicos e porcentagens
- Seja objetivo e prático
- Destaque tanto pontos fortes quanto oportunidades de melhoria
- Use emojis para facilitar a leitura
- Formate em Markdown válido
- As ideias de conteúdo devem ser ESPECÍFICAS e baseadas nos padrões que funcionaram`;

  return prompt;
}

function parseReportResponse(content: string, data: ReportData): GeneratedReport {
  // Extract sections
  const extractItems = (text: string): string[] => {
    const items = text.match(/[-•]\s*(.+?)(?=\n[-•]|\n\n|$)/gs) || [];
    return items.map(item => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean).slice(0, 5);
  };

  // Extract content recommendations
  const contentRecommendations: ContentRecommendation[] = [];
  const contentIdeasMatch = content.match(/IDEIAS DE CONTEÚDO.*?(?=---|$)/is);
  if (contentIdeasMatch) {
    const ideasSection = contentIdeasMatch[0];
    const ideaMatches = ideasSection.matchAll(/\d+\.\s*\*\*(.+?)\*\*\s*\n\s*-\s*Formato:\s*(.+?)\n\s*-\s*Descrição:\s*(.+?)\n\s*-\s*Baseado em:\s*(.+?)(?=\n\d+\.|\n---|$)/gis);
    
    for (const match of ideaMatches) {
      contentRecommendations.push({
        title: match[1]?.trim() || "",
        format: match[2]?.trim() || "",
        description: match[3]?.trim() || "",
        basedOn: match[4]?.trim() || ""
      });
    }
  }

  // Basic parsing - extract sections from the response
  const sections = content.split(/##\s*\d+\.\s*/i);
  
  const summarySection = sections.find(s => s.toLowerCase().includes('resumo')) || '';
  const insightsSection = sections.find(s => s.toLowerCase().includes('insight') || s.toLowerCase().includes('padrões')) || '';
  const recommendationsSection = sections.find(s => s.toLowerCase().includes('recomendações estratégicas')) || '';
  const highlightsSection = sections.find(s => s.toLowerCase().includes('destaque') || s.toLowerCase().includes('top')) || '';

  const highlights = extractItems(highlightsSection);
  const insights = extractItems(insightsSection);
  const recommendations = extractItems(recommendationsSection);

  return {
    title: `Relatório de Performance - ${data.platform}`,
    summary: summarySection.replace(/resumo executivo/i, '').trim().slice(0, 500) || "Análise do período concluída.",
    highlights: highlights.length > 0 ? highlights : ["Dados coletados com sucesso", "Métricas analisadas", "Tendências identificadas"],
    insights: insights.length > 0 ? insights : ["Continue monitorando as métricas", "Foco em engajamento", "Acompanhe a evolução"],
    recommendations: recommendations.length > 0 ? recommendations : ["Mantenha a consistência", "Experimente novos formatos", "Analise a concorrência"],
    contentRecommendations: contentRecommendations.length > 0 ? contentRecommendations : [
      { title: "Conteúdo baseado no que funcionou", format: "Reels", description: "Crie variações dos posts de maior engajamento", basedOn: "Top posts do período" }
    ],
    topContent: [],
    fullContent: content
  };
}
