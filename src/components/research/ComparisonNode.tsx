import { memo, useState, useEffect } from "react";
import { GitCompare, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Button } from "@/components/ui/button";
import { useResearchItems, ResearchItem } from "@/hooks/useResearchItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface ComparisonNodeProps {
  id: string;
  data: {
    item: ResearchItem;
    onDelete: (id: string) => void;
    projectId: string;
    clientId?: string;
    connectedItems: ResearchItem[];
    isConnected?: boolean;
  };
}

export const ComparisonNode = memo(({ id, data }: ComparisonNodeProps) => {
  const { item, onDelete, projectId, clientId, connectedItems = [], isConnected } = data;
  const { updateItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const hasComparison = item.content && item.content.length > 0;
  const hasConnectedItems = connectedItems.length >= 2;

  const generateComparison = async () => {
    if (connectedItems.length < 2) {
      toast({
        title: "Items insuficientes",
        description: "Conecte pelo menos 2 itens para gerar uma comparação.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Prepare materials for comparison
      const materials = connectedItems.map((connItem, index) => ({
        index: index + 1,
        type: connItem.type,
        title: connItem.title || `Item ${index + 1}`,
        content: connItem.content?.slice(0, 3000) || "Sem conteúdo",
      }));

      const systemPrompt = `Você é um analista especializado em comparar conteúdos e materiais de pesquisa.
Sua tarefa é criar uma análise comparativa clara e estruturada dos materiais fornecidos.

Estruture sua análise em:
1. **Resumo Geral** - Visão geral dos materiais comparados
2. **Pontos em Comum** - Aspectos semelhantes entre os materiais
3. **Diferenças Principais** - Aspectos que distinguem cada material
4. **Análise de Qualidade** - Avalie pontos fortes e fracos de cada um
5. **Conclusão** - Insights principais e recomendações

Use markdown para formatar. Seja objetivo e analítico.`;

      const userPrompt = `Compare os seguintes ${materials.length} materiais:

${materials.map(m => `
### Material ${m.index}: ${m.title} (${m.type})
${m.content}
`).join("\n---\n")}

Gere uma análise comparativa detalhada.`;

      const { data: response, error } = await supabase.functions.invoke("analyze-research", {
        body: {
          message: userPrompt,
          systemPrompt,
          projectId,
          clientId,
        },
      });

      if (error) throw error;

      const comparisonContent = response.message || response.content || "";
      
      await updateItem.mutateAsync({
        id,
        title: `Comparação: ${connectedItems.slice(0, 2).map(i => i.title?.slice(0, 15) || i.type).join(" vs ")}${connectedItems.length > 2 ? " +" + (connectedItems.length - 2) : ""}`,
        content: comparisonContent,
        metadata: {
          comparedItems: connectedItems.map(i => ({ id: i.id, title: i.title, type: i.type })),
          generatedAt: new Date().toISOString(),
        },
        processed: true,
      });

      toast({ title: "Comparação gerada", description: `${connectedItems.length} itens analisados.` });
    } catch (error: any) {
      console.error("Comparison error:", error);
      toast({
        title: "Erro ao gerar comparação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <BaseNode
      id={id}
      onDelete={onDelete}
      icon={GitCompare}
      iconColor="text-amber-500"
      bgColor="bg-amber-500/10"
      borderColor="border-amber-500/30"
      label="Comparação"
      title={item.title || "Comparação de Itens"}
      isConnected={isConnected}
      isProcessing={isAnalyzing}
      className="w-96"
      badge={
        <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-md">
          {connectedItems.length} itens
        </span>
      }
    >
      {/* Connected items preview */}
      <div className="mb-2 flex flex-wrap gap-1">
        {connectedItems.slice(0, 4).map((ci, i) => (
          <span
            key={ci.id}
            className="text-xs px-2 py-0.5 bg-muted rounded-full truncate max-w-[100px]"
            title={ci.title || ci.type}
          >
            {ci.title?.slice(0, 12) || ci.type}
          </span>
        ))}
        {connectedItems.length > 4 && (
          <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
            +{connectedItems.length - 4}
          </span>
        )}
        {connectedItems.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Conecte itens para comparar
          </span>
        )}
      </div>

      {!hasComparison ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={generateComparison}
          disabled={isAnalyzing || !hasConnectedItems}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <GitCompare className="h-4 w-4 mr-2" />
              Gerar Comparação
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Recolher
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Expandir
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateComparison}
              disabled={isAnalyzing || !hasConnectedItems}
              className="h-6 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${isAnalyzing ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {isExpanded && (
            <ScrollArea className="max-h-64 no-pan no-wheel">
              <div className="prose prose-sm dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-p:text-xs prose-ul:text-xs">
                <ReactMarkdown>{item.content || ""}</ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </BaseNode>
  );
});

ComparisonNode.displayName = "ComparisonNode";
