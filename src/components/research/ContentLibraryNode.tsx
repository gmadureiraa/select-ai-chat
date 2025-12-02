import { memo, useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, BookOpen } from "lucide-react";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ContentLibraryNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  clientId?: string;
  isConnected?: boolean;
}

interface ContentItem {
  id: string;
  title: string;
  content: string;
  content_type: string;
  client_id: string;
  clients: { name: string };
}

export const ContentLibraryNode = memo(({ data }: { data: ContentLibraryNodeData }) => {
  const { item, onDelete, clientId, isConnected } = data;
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    item.metadata?.selected_content_id || null
  );

  const { data: allContents = [], isLoading } = useQuery({
    queryKey: ["content-library-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_content_library")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ContentItem[];
    },
  });

  const selectedContent = allContents.find((c) => c.id === selectedContentId);

  useEffect(() => {
    if (selectedContentId && item.id) {
      supabase
        .from("research_items")
        .update({ 
          metadata: { 
            ...item.metadata, 
            selected_content_id: selectedContentId,
            content_type: selectedContent?.content_type,
            client_name: selectedContent?.clients?.name
          },
          title: selectedContent?.title || item.title,
          content: selectedContent?.content || null
        })
        .eq("id", item.id)
        .then(({ error }) => {
          if (error) console.error("Error updating content library node:", error);
        });
    }
  }, [selectedContentId, item.id]);

  return (
    <div 
      className={cn(
        "bg-card border-2 border-cyan-200 dark:border-cyan-800 rounded-xl shadow-md hover:shadow-lg transition-all",
        "min-w-[320px] max-w-[400px] group relative",
        isConnected && "ring-2 ring-cyan-400/50"
      )}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-cyan-400 hover:!bg-cyan-500 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-cyan-400 hover:!bg-cyan-500 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-cyan-400 hover:!bg-cyan-500 !border-2 !border-background" id="left" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-cyan-400 hover:!bg-cyan-500 !border-2 !border-background" id="right" />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
            <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">Biblioteca de Conteúdo</span>
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
            Selecione um conteúdo
          </label>
          <Select
            value={selectedContentId || ""}
            onValueChange={setSelectedContentId}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoading ? "Carregando..." : allContents.length === 0 ? "Nenhum conteúdo disponível" : "Escolher conteúdo"} />
            </SelectTrigger>
            <SelectContent>
              {allContents.length === 0 ? (
                <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                  Nenhum conteúdo disponível
                </div>
              ) : (
                allContents.map((content) => (
                  <SelectItem key={content.id} value={content.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{content.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {content.clients?.name} • {content.content_type}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedContent && (
          <div className="p-3 bg-muted/50 rounded-md border border-border">
            <p className="text-xs font-medium mb-1">{selectedContent.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {selectedContent.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

ContentLibraryNode.displayName = "ContentLibraryNode";
