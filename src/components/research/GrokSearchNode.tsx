import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Search, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResearchItem } from "@/hooks/useResearchItems";
import { cn } from "@/lib/utils";

interface GrokSearchNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  isConnected?: boolean;
}

export const GrokSearchNode = memo(({ data }: NodeProps<GrokSearchNodeData>) => {
  const { item, onDelete, isConnected } = data;
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(item.content || "");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;
    
    setIsSearching(true);
    try {
      const { data: searchData, error } = await supabase.functions.invoke("grok-search", {
        body: { query }
      });

      if (error) throw error;
      
      setResult(searchData.result);
      setQuery("");
      
      toast({
        title: "Pesquisa concluída",
        description: "Resultados atualizados",
      });
    } catch (error) {
      console.error("Erro ao pesquisar:", error);
      toast({
        title: "Erro na pesquisa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
  };

  return (
    <div 
      className={cn(
        "bg-card border-2 border-blue-300 dark:border-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all",
        "min-w-[400px] max-w-[400px] h-[500px] flex flex-col group relative",
        "focus:outline-none focus:ring-2 focus:ring-blue-400",
        isConnected && "ring-2 ring-blue-400/50",
        isSearching && "ring-2 ring-blue-500 animate-pulse"
      )}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-400 hover:!bg-blue-500 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-400 hover:!bg-blue-500 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-400 hover:!bg-blue-500 !border-2 !border-background" id="left" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-blue-400 hover:!bg-blue-500 !border-2 !border-background" id="right" />

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive z-10"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-blue-50 dark:bg-blue-900/20">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700">
          <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground">Pesquisa Grok</h3>
          <p className="text-xs text-muted-foreground">Pesquisa em tempo real com IA</p>
        </div>
      </div>

      {/* Results */}
      <div 
        className="flex-1 p-3 overflow-y-auto no-pan no-wheel" 
        onWheel={(e) => e.stopPropagation()}
      >
        {result ? (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs whitespace-pre-wrap text-foreground">{result}</p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-xs">Faça uma pesquisa em tempo real</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border bg-muted/30">
        <div className="flex gap-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pesquisa..."
            className="min-h-[60px] max-h-[60px] resize-none text-xs bg-background"
            disabled={isSearching}
          />
          <Button 
            onClick={handleSearch} 
            disabled={!query.trim() || isSearching} 
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

GrokSearchNode.displayName = "GrokSearchNode";
