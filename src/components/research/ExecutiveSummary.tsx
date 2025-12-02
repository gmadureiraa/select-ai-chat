import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ResearchItem, ResearchConnection } from "@/hooks/useResearchItems";
import ReactMarkdown from "react-markdown";

interface ExecutiveSummaryProps {
  items: ResearchItem[];
  connections: ResearchConnection[];
  projectName: string;
  clientId?: string;
}

export const ExecutiveSummary = ({ 
  items, 
  connections, 
  projectName,
  clientId 
}: ExecutiveSummaryProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    setIsGenerating(true);
    try {
      // Prepare context from all items
      const itemsContext = items.map(item => ({
        type: item.type,
        title: item.title,
        content: item.content?.substring(0, 2000), // Limit content size
        source: item.source_url,
      }));

      const connectionsContext = connections.map(conn => {
        const source = items.find(i => i.id === conn.source_id);
        const target = items.find(i => i.id === conn.target_id);
        return {
          from: source?.title,
          to: target?.title,
          label: conn.label,
        };
      });

      const { data, error } = await supabase.functions.invoke("analyze-research", {
        body: {
          projectId: items[0]?.project_id,
          clientId,
          userMessage: `Gere um RESUMO EXECUTIVO completo e estruturado da pesquisa "${projectName}".

O resumo deve incluir:
1. **Visão Geral** - Breve descrição do escopo da pesquisa
2. **Principais Descobertas** - 3-5 insights mais importantes encontrados
3. **Análise de Conexões** - Como os diferentes materiais se relacionam
4. **Padrões Identificados** - Temas recorrentes ou tendências observadas
5. **Recomendações** - 3-5 próximos passos ou ações sugeridas
6. **Conclusão** - Síntese final

CONTEXTO DOS MATERIAIS:
${JSON.stringify(itemsContext, null, 2)}

CONEXÕES ENTRE MATERIAIS:
${JSON.stringify(connectionsContext, null, 2)}

Formate o resumo em Markdown, seja objetivo mas completo.`,
          model: "google/gemini-2.5-flash",
          skipContextSelection: true, // Direct analysis without library lookup
        },
      });

      if (error) throw error;
      
      setSummary(data.response);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar resumo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!summary && items.length > 0) {
      generateSummary();
    }
  };

  const copyToClipboard = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado!", description: "Resumo copiado para a área de transferência." });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 bg-card/95 backdrop-blur-sm"
        onClick={handleOpen}
        disabled={items.length === 0}
      >
        <Sparkles className="h-4 w-4" />
        Resumo Executivo
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Resumo Executivo - {projectName}</span>
              <div className="flex items-center gap-2">
                {summary && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={copyToClipboard}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={generateSummary}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Regenerar
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">
                  Analisando {items.length} itens e {connections.length} conexões...
                </p>
              </div>
            ) : summary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Adicione itens ao canvas para gerar um resumo.</p>
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-xs text-muted-foreground">
              {items.length} itens • {connections.length} conexões
            </span>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
