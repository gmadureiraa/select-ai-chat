import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Search, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResearchItem } from "@/hooks/useResearchItems";

interface GrokSearchNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
}

export const GrokSearchNode = memo(({ data }: NodeProps<GrokSearchNodeData>) => {
  const { item, onDelete } = data;
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
      tabIndex={0}
      className="bg-white border-2 border-blue-300 rounded-xl shadow-lg hover:shadow-xl transition-shadow min-w-[400px] max-w-[400px] h-[500px] flex flex-col group relative focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-400" />

      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 h-8 px-2 rounded-full border-red-200 text-red-600 bg-red-50/80 hover:bg-red-100 hover:text-red-700 z-10 flex items-center gap-1"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-center gap-2 p-3 border-b border-blue-200 bg-blue-50">
        <div className="p-2 bg-blue-100 rounded-lg border border-blue-300">
          <Search className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900">
            Pesquisa Grok
          </h3>
          <p className="text-xs text-gray-500">
            Pesquisa em tempo real com IA
          </p>
        </div>
      </div>

      <div 
        className="flex-1 p-3 overflow-y-auto no-pan no-wheel" 
        onWheel={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: 'thin' }}
      >
        {result ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs whitespace-pre-wrap text-gray-900">{result}</p>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-xs">
              Faça uma pesquisa em tempo real
            </p>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua pesquisa..."
            className="min-h-[60px] max-h-[60px] resize-none text-xs bg-white"
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
