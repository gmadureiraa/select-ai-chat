import { memo, useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Library } from "lucide-react";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ReferenceLibraryNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  clientId?: string;
  isConnected?: boolean;
}

interface ReferenceItem {
  id: string;
  title: string;
  content: string;
  reference_type: string;
  source_url: string | null;
  client_id: string;
  clients: { name: string };
}

export const ReferenceLibraryNode = memo(({ data }: { data: ReferenceLibraryNodeData }) => {
  const { item, onDelete, clientId, isConnected } = data;
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
    item.metadata?.selected_reference_id || null
  );

  const { data: allReferences = [], isLoading } = useQuery({
    queryKey: ["reference-library-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_reference_library")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ReferenceItem[];
    },
  });

  const selectedReference = allReferences.find((r) => r.id === selectedReferenceId);

  useEffect(() => {
    if (selectedReferenceId && item.id) {
      supabase
        .from("research_items")
        .update({ 
          metadata: { 
            ...item.metadata, 
            selected_reference_id: selectedReferenceId,
            reference_type: selectedReference?.reference_type,
            client_name: selectedReference?.clients?.name
          },
          title: selectedReference?.title || item.title,
          content: selectedReference?.content || null,
          source_url: selectedReference?.source_url || null
        })
        .eq("id", item.id)
        .then(({ error }) => {
          if (error) console.error("Error updating reference library node:", error);
        });
    }
  }, [selectedReferenceId, item.id]);

  return (
    <div 
      className={cn(
        "bg-card border-2 border-indigo-200 dark:border-indigo-800 rounded-xl shadow-md hover:shadow-lg transition-all",
        "min-w-[320px] max-w-[400px] group relative",
        isConnected && "ring-2 ring-indigo-400/50"
      )}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-400 hover:!bg-indigo-500 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-400 hover:!bg-indigo-500 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-400 hover:!bg-indigo-500 !border-2 !border-background" id="left" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-400 hover:!bg-indigo-500 !border-2 !border-background" id="right" />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <Library className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">Biblioteca de Referências</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Selecione uma referência
          </label>
          <Select
            value={selectedReferenceId || ""}
            onValueChange={setSelectedReferenceId}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoading ? "Carregando..." : allReferences.length === 0 ? "Nenhuma referência disponível" : "Escolher referência"} />
            </SelectTrigger>
            <SelectContent>
              {allReferences.length === 0 ? (
                <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                  Nenhuma referência disponível
                </div>
              ) : (
                allReferences.map((reference) => (
                  <SelectItem key={reference.id} value={reference.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{reference.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {reference.clients?.name} • {reference.reference_type}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedReference && (
          <div className="p-3 bg-muted/50 rounded-md border border-border">
            <p className="text-xs font-medium mb-1">{selectedReference.title}</p>
            {selectedReference.source_url && (
              <a 
                href={selectedReference.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline block mb-1"
              >
                {selectedReference.source_url}
              </a>
            )}
            <p className="text-xs text-muted-foreground line-clamp-3">
              {selectedReference.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

ReferenceLibraryNode.displayName = "ReferenceLibraryNode";
