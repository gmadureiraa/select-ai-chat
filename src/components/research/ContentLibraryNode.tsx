import { memo, useState, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, BookOpen } from "lucide-react";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContentLibraryNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  clientId?: string;
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
  const { item, onDelete, clientId } = data;
  const { toast } = useToast();
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    item.metadata?.selected_content_id || null
  );

  const { data: allContents = [], isLoading } = useQuery({
    queryKey: ["content-library", clientId],
    queryFn: async () => {
      let query = supabase
        .from("client_content_library")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ContentItem[];
    },
  });

  const selectedContent = allContents.find((c) => c.id === selectedContentId);

  useEffect(() => {
    if (selectedContentId && item.id) {
      // Update item metadata with selected content
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
          if (error) {
            console.error("Error updating content library node:", error);
          }
        });
    }
  }, [selectedContentId, item.id]);

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Card className="min-w-[320px] max-w-[400px] shadow-lg bg-background/95 backdrop-blur-sm border-cyan-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-500" />
              <CardTitle className="text-sm">Biblioteca de Conteúdo</CardTitle>
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
              Selecione um conteúdo
            </label>
            <Select
              value={selectedContentId || ""}
              onValueChange={setSelectedContentId}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isLoading ? "Carregando..." : "Escolher conteúdo"} />
              </SelectTrigger>
              <SelectContent>
                {allContents.map((content) => (
                  <SelectItem key={content.id} value={content.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{content.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {content.clients?.name} • {content.content_type}
                      </span>
                    </div>
                  </SelectItem>
                ))}
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
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
});

ContentLibraryNode.displayName = "ContentLibraryNode";
