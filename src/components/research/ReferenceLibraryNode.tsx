import { memo, useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Library } from "lucide-react";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReferenceLibraryNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
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
  const { item, onDelete } = data;
  const { toast } = useToast();
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
    item.metadata?.selected_reference_id || null
  );

  const { data: allReferences = [], isLoading } = useQuery({
    queryKey: ["all-reference-library"],
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
      // Update item metadata with selected reference
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
          if (error) {
            console.error("Error updating reference library node:", error);
          }
        });
    }
  }, [selectedReferenceId, item.id]);

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Card className="min-w-[320px] max-w-[400px] shadow-lg bg-background/95 backdrop-blur-sm border-indigo-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Library className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-sm">Biblioteca de Referências</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
                <SelectValue placeholder={isLoading ? "Carregando..." : "Escolher referência"} />
              </SelectTrigger>
              <SelectContent>
                {allReferences.map((reference) => (
                  <SelectItem key={reference.id} value={reference.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{reference.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {reference.clients?.name} • {reference.reference_type}
                      </span>
                    </div>
                  </SelectItem>
                ))}
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
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
});

ReferenceLibraryNode.displayName = "ReferenceLibraryNode";
