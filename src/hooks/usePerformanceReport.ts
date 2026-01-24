import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ReportData {
  platform: string;
  period: string;
  kpis: Record<string, any>;
  previousKpis?: Record<string, any>;
  posts?: any[];
  previousPosts?: any[];
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

      // Use kai-content-agent for report generation (replaces execute-agent)
      const { data: result, error } = await supabase.functions.invoke("kai-content-agent", {
        body: {
          clientId,
          message: prompt,
          model: "google/gemini-2.5-flash",
          stream: false
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
        title: "Análise gerada!",
        description: "Relatório estratégico completo com insights de IA."
      });

      return reportWithId;
    } catch (error) {
      console.error("[PerformanceReport] Error:", error);
      toast({
        title: "Erro ao gerar análise",
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
  const { platform, period, kpis, previousKpis, posts, previousPosts, videos } = data;

  // Calculate averages if posts exist
  const totalPosts = posts?.length || 0;
  const avgLikes = totalPosts > 0 ? Math.round((kpis.totalLikes || 0) / totalPosts) : 0;
  const avgComments = totalPosts > 0 ? Math.round((kpis.totalComments || 0) / totalPosts) : 0;
  const avgShares = totalPosts > 0 ? Math.round((kpis.totalShares || 0) / totalPosts) : 0;
  const avgSaves = totalPosts > 0 ? Math.round((kpis.totalSaves || 0) / totalPosts) : 0;
  const avgReach = totalPosts > 0 ? Math.round((kpis.totalReach || 0) / totalPosts) : 0;

  // Calculate percentage changes
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  let prompt = `Você é um analista de marketing digital especializado em redes sociais. Gere um RELATÓRIO ESTRATÉGICO DE PERFORMANCE profissional para ${platform}.

═══════════════════════════════════════════════════════════════
DADOS DO PERÍODO: ${period}
═══════════════════════════════════════════════════════════════

## MÉTRICAS MACRO (KPIs) - PERÍODO ATUAL
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

`;

  // Add comparison with previous period if available
  if (previousKpis && previousPosts && previousPosts.length > 0) {
    const prevTotalPosts = previousPosts.length;
    
    prompt += `## COMPARAÇÃO COM PERÍODO ANTERIOR
| Métrica | Atual | Anterior | Variação |
|---------|-------|----------|----------|
| Posts | ${totalPosts} | ${prevTotalPosts} | ${calcChange(totalPosts, prevTotalPosts).toFixed(1)}% |
| Alcance | ${(kpis.totalReach || 0).toLocaleString()} | ${(previousKpis.totalReach || 0).toLocaleString()} | ${calcChange(kpis.totalReach || 0, previousKpis.totalReach || 0).toFixed(1)}% |
| Visualizações | ${(kpis.totalViews || 0).toLocaleString()} | ${(previousKpis.totalViews || 0).toLocaleString()} | ${calcChange(kpis.totalViews || 0, previousKpis.totalViews || 0).toFixed(1)}% |
| Interações | ${(kpis.totalInteractions || 0).toLocaleString()} | ${(previousKpis.totalInteractions || 0).toLocaleString()} | ${calcChange(kpis.totalInteractions || 0, previousKpis.totalInteractions || 0).toFixed(1)}% |
| Curtidas | ${(kpis.totalLikes || 0).toLocaleString()} | ${(previousKpis.totalLikes || 0).toLocaleString()} | ${calcChange(kpis.totalLikes || 0, previousKpis.totalLikes || 0).toFixed(1)}% |
| Comentários | ${(kpis.totalComments || 0).toLocaleString()} | ${(previousKpis.totalComments || 0).toLocaleString()} | ${calcChange(kpis.totalComments || 0, previousKpis.totalComments || 0).toFixed(1)}% |
| Salvamentos | ${(kpis.totalSaves || 0).toLocaleString()} | ${(previousKpis.totalSaves || 0).toLocaleString()} | ${calcChange(kpis.totalSaves || 0, previousKpis.totalSaves || 0).toFixed(1)}% |
| Compartilhamentos | ${(kpis.totalShares || 0).toLocaleString()} | ${(previousKpis.totalShares || 0).toLocaleString()} | ${calcChange(kpis.totalShares || 0, previousKpis.totalShares || 0).toFixed(1)}% |
| Seguidores ganhos | ${(kpis.followersGained || 0).toLocaleString()} | ${(previousKpis.followersGained || 0).toLocaleString()} | ${calcChange(kpis.followersGained || 0, previousKpis.followersGained || 0).toFixed(1)}% |
| Engajamento médio | ${(kpis.avgEngagement || 0).toFixed(2)}% | ${(previousKpis.avgEngagement || 0).toFixed(2)}% | ${calcChange(kpis.avgEngagement || 0, previousKpis.avgEngagement || 0).toFixed(1)}% |

`;
  }

  prompt += `## MÉDIAS POR POST
- Curtidas/post: ${avgLikes.toLocaleString()}
- Comentários/post: ${avgComments}
- Compartilhamentos/post: ${avgShares}
- Salvamentos/post: ${avgSaves}
- Alcance/post: ${avgReach.toLocaleString()}

`;

  if (posts && posts.length > 0) {
    const topPosts = [...posts]
      .sort((a: any, b: any) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
      .slice(0, 3);
    
    prompt += `## TOP 3 POSTS DO PERÍODO (para análise detalhada)
${topPosts.map((p: any, i: number) => 
  `### Post ${i + 1}: [${p.post_type || 'post'}]
- **Legenda completa:** "${p.caption || 'Sem legenda'}"
- **Métricas:**
  • Curtidas: ${p.likes || 0}
  • Comentários: ${p.comments || 0}
  • Salvamentos: ${p.saves || 0}
  • Compartilhamentos: ${p.shares || 0}
  • Alcance: ${(p.reach || 0).toLocaleString()}
  • Taxa de Engajamento: ${(p.engagement_rate || 0).toFixed(2)}%
- **Data de publicação:** ${p.posted_at ? new Date(p.posted_at).toLocaleDateString('pt-BR') : 'Não informada'}
`
).join('\n')}

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
${previousKpis ? '**Inclua obrigatoriamente:** Comparação explícita com período anterior, destacando as principais variações (positivas e negativas) com percentuais.' : ''}

---

## 2. PERFORMANCE MACRO (KPIs)
Análise detalhada das métricas principais com interpretação:

| Métrica | Valor | ${previousKpis ? 'vs Anterior | ' : ''}Análise |
|---------|-------|${previousKpis ? '------------|' : ''}---------|
| Alcance | [valor] | ${previousKpis ? '[variação%] |' : ''} [breve interpretação] |
| Engajamento | [valor]% | ${previousKpis ? '[variação%] |' : ''} [breve interpretação] |
| Seguidores | [valor] | ${previousKpis ? '[variação%] |' : ''} [breve interpretação] |

**Análise Técnica:** [Parágrafo explicando o que os números significam para a estratégia${previousKpis ? ' e o que as variações indicam' : ''}]

---

## 3. ANÁLISE DE ENGAJAMENTO
- **Total de interações:** [número]${previousKpis ? ' ([variação]% vs anterior)' : ''}
- **Curtidas:** [número] ([porcentagem do total])
- **Comentários:** [número] ([porcentagem do total])
- **Compartilhamentos:** [número] ([porcentagem do total])
- **Salvamentos:** [número] ([porcentagem do total])

**Análise Técnica:** [Explicar qual tipo de engajamento está mais forte e o que isso indica]

---

## 4. ANÁLISE DETALHADA: TOP 3 POSTS DO PERÍODO
**IMPORTANTE:** Para cada post, faça uma análise PROFUNDA do motivo do sucesso.

### 🥇 Post 1 - [Tipo: Reel/Carrossel/Imagem]
**Métricas:** [curtidas] curtidas | [comentários] comentários | [salvamentos] salvamentos | [engajamento]% engajamento

**📝 Análise da Legenda/Copy:**
- [Identifique elementos específicos da copy que funcionaram: gancho inicial, CTAs, storytelling, perguntas, etc.]

**🎯 Por que performou bem:**
1. **Formato:** [Análise do formato escolhido e por que funcionou]
2. **Tema/Assunto:** [Por que esse tema ressoou com a audiência]
3. **Timing:** [Se relevante, comente sobre o momento da publicação]
4. **Elementos de engajamento:** [O que incentivou interações: perguntas, polêmica, identificação, etc.]

**💡 Padrão replicável:** [O que pode ser replicado deste post em futuras publicações]

### 🥈 Post 2 - [Tipo]
[Mesmo formato do Post 1]

### 🥉 Post 3 - [Tipo]
[Mesmo formato do Post 1]

---

## 5. INSIGHTS E PADRÕES IDENTIFICADOS
Liste 3-5 padrões observados nos dados:
- 📊 [Insight 1 com dados específicos${previousKpis ? ' e comparação' : ''}]
- 📈 [Insight 2 com dados específicos]
- 💡 [Insight 3 com dados específicos]
- 🎯 [Insight 4 - padrões de conteúdo que funcionam]
${previousKpis ? '- 📉 [Insight 5 - pontos de atenção baseados na comparação]' : ''}

---

## 6. RECOMENDAÇÕES ESTRATÉGICAS
Liste 3-5 ações concretas baseadas nos dados:
1. **[Ação 1]:** [Justificativa baseada nos dados e análise dos top posts]
2. **[Ação 2]:** [Justificativa baseada nos padrões identificados]
3. **[Ação 3]:** [Justificativa baseada nas métricas${previousKpis ? ' e variações' : ''}]
${previousKpis ? '4. **[Ação 4]:** [Ação para melhorar métricas que caíram vs período anterior]' : ''}

---

## 7. IDEIAS DE CONTEÚDO BASEADAS NO QUE PERFORMOU BEM
Com base nos TOP POSTS analisados, sugira 5 ideias de novos conteúdos:

1. **[Título da Ideia 1]**
   - Formato: [Reels/Carrossel/Stories/Post estático]
   - Descrição: [Breve descrição do conteúdo]
   - Baseado em: [Qual elemento do top post inspirou essa ideia]

2. **[Título da Ideia 2]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência específica]

3. **[Título da Ideia 3]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência específica]

4. **[Título da Ideia 4]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência específica]

5. **[Título da Ideia 5]**
   - Formato: [Formato sugerido]
   - Descrição: [Breve descrição]
   - Baseado em: [Referência específica]

---

REGRAS IMPORTANTES:
- Use APENAS os dados fornecidos, nunca invente números
- Cite valores específicos e porcentagens
- Seja objetivo e prático
- Na seção de TOP 3 POSTS, faça uma análise DETALHADA e específica de cada post - leia a legenda completa e identifique o que funcionou
- As ideias de conteúdo devem ser ESPECÍFICAS e baseadas nos padrões dos posts que performaram bem
- ${previousKpis ? 'Compare SEMPRE com o período anterior quando mencionar métricas' : 'Foque na análise do período atual'}
- Use emojis para facilitar a leitura
- Formate em Markdown válido`;

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
    title: `Análise de Performance - ${data.platform}`,
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
