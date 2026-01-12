import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { BookOpen, X, Search, FileText, Video, Image } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LibraryNodeData } from "../hooks/useCanvasState";
import { useContentLibrary } from "@/hooks/useContentLibrary";
import { useReferenceLibrary } from "@/hooks/useReferenceLibrary";

interface LibraryRefNodeProps extends NodeProps<LibraryNodeData> {
  clientId?: string;
  onUpdateData?: (nodeId: string, data: Partial<LibraryNodeData>) => void;
  onDelete?: (nodeId: string) => void;
}

function LibraryRefNodeComponent({ 
  id, 
  data, 
  selected,
  clientId,
  onUpdateData,
  onDelete 
}: LibraryRefNodeProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(!data.itemId);
  
  const { contents = [] } = useContentLibrary(clientId || "");
  const { references = [] } = useReferenceLibrary(clientId || "");

  const allItems = [
    ...contents.map(c => ({ 
      id: c.id, 
      title: c.title, 
      content: c.content, 
      type: c.content_type,
      source: "content" as const 
    })),
    ...references.map(r => ({ 
      id: r.id, 
      title: r.title, 
      content: r.content, 
      type: r.reference_type,
      source: "reference" as const 
    }))
  ];

  const filteredItems = allItems.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectItem = (item: typeof allItems[0]) => {
    onUpdateData?.(id, {
      itemId: item.id,
      itemTitle: item.title,
      itemContent: item.content,
      itemType: item.type
    });
    setIsOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video":
      case "reel":
        return <Video className="h-3 w-3" />;
      case "image":
      case "carousel":
        return <Image className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  return (
    <Card className={cn(
      "w-[300px] shadow-lg transition-all border-2",
      selected ? "border-primary ring-2 ring-primary/20" : "border-purple-500/50",
      "bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-background"
    )}>
      <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-purple-500 flex items-center justify-center">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-medium text-sm">Biblioteca</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete?.(id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        {isOpen ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar na biblioteca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {filteredItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum item encontrado
                  </p>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="w-full p-2 rounded-md hover:bg-muted/50 transition-colors text-left flex items-start gap-2"
                    >
                      <div className="mt-0.5">
                        {getTypeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {item.content.substring(0, 50)}...
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div 
            className="p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setIsOpen(true)}
          >
            <div className="flex items-center gap-2 mb-1">
              {getTypeIcon(data.itemType || "")}
              <span className="text-xs font-medium truncate">{data.itemTitle}</span>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-2">
              {data.itemContent?.substring(0, 100)}...
            </p>
            <Badge variant="secondary" className="mt-1.5 text-[10px]">
              Clique para trocar
            </Badge>
          </div>
        )}
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
    </Card>
  );
}

export const LibraryRefNode = memo(LibraryRefNodeComponent);
