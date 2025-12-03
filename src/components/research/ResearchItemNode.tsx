import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Trash2, Youtube, FileText, Link as LinkIcon, Image as ImageIcon, Music, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResearchItem } from "@/hooks/useResearchItems";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CategorySelector } from "./CategorySelector";
import { CategoryBadge } from "./CategoryBadge";
import { getCategoryById } from "@/types/researchCategories";

interface ResearchItemNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: any) => void;
  isConnected?: boolean;
}

const typeConfig: Record<string, { icon: any; color: string; border: string; bg: string; label: string }> = {
  note: { icon: FileText, color: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800", bg: "bg-yellow-100 dark:bg-yellow-900/30", label: "Nota" },
  youtube: { icon: Youtube, color: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-800", bg: "bg-red-100 dark:bg-red-900/30", label: "YouTube" },
  text: { icon: FileText, color: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Texto" },
  link: { icon: LinkIcon, color: "text-green-600 dark:text-green-400", border: "border-green-200 dark:border-green-800", bg: "bg-green-100 dark:bg-green-900/30", label: "Link" },
  image: { icon: ImageIcon, color: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-100 dark:bg-orange-900/30", label: "Imagem" },
  audio: { icon: Music, color: "text-pink-600 dark:text-pink-400", border: "border-pink-200 dark:border-pink-800", bg: "bg-pink-100 dark:bg-pink-900/30", label: "Áudio" },
  pdf: { icon: FileType, color: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-100 dark:bg-orange-900/30", label: "PDF" },
  ai_chat: { icon: FileText, color: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800", bg: "bg-purple-100 dark:bg-purple-900/30", label: "Chat IA" },
};

const defaultConfig = { icon: FileText, color: "text-muted-foreground", border: "border-border", bg: "bg-muted", label: "Item" };

export const ResearchItemNode = memo(({ data }: NodeProps<ResearchItemNodeData>) => {
  const { item, onDelete, onUpdate, isConnected } = data;
  const [showTranscript, setShowTranscript] = useState(false);

  const config = typeConfig[item.type] || defaultConfig;
  const Icon = config.icon;
  const categoryId = (item.metadata as any)?.category;
  const category = getCategoryById(categoryId);

  const handleCategoryChange = (newCategoryId: string | undefined) => {
    if (onUpdate) {
      const currentMetadata = (item.metadata as any) || {};
      onUpdate(item.id, { 
        metadata: { ...currentMetadata, category: newCategoryId } 
      });
    }
  };

  return (
    <>
      <div 
        className={cn(
          "bg-card border-2 rounded-xl shadow-md hover:shadow-lg transition-all",
          "p-3 min-w-[280px] max-w-[320px] group relative cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          config.border,
          isConnected && "ring-2 ring-primary/30"
        )}
        onClick={() => {
          if (item.type === "youtube") {
            setShowTranscript(true);
          }
        }}
      >
        {/* Handles */}
        <Handle type="target" position={Position.Top} className={cn("!w-3 !h-3 !border-2 !border-background", config.color.replace("text-", "!bg-").replace("-600", "-400"))} />
        <Handle type="source" position={Position.Bottom} className={cn("!w-3 !h-3 !border-2 !border-background", config.color.replace("text-", "!bg-").replace("-600", "-400"))} />
        <Handle type="target" position={Position.Left} className={cn("!w-3 !h-3 !border-2 !border-background", config.color.replace("text-", "!bg-").replace("-600", "-400"))} id="left" />
        <Handle type="source" position={Position.Right} className={cn("!w-3 !h-3 !border-2 !border-background", config.color.replace("text-", "!bg-").replace("-600", "-400"))} id="right" />

        {/* Actions */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          {onUpdate && (
            <CategorySelector
              categoryId={categoryId}
              onCategoryChange={handleCategoryChange}
              size="sm"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn("p-2 rounded-lg border", category?.bgClass || config.bg, category?.borderClass || config.border)}>
            <Icon className={cn("h-4 w-4", category?.textClass || config.color)} />
          </div>
          <div className="flex-1 min-w-0 pr-16">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", config.bg, config.color)}>
                {config.label}
              </span>
              {categoryId && <CategoryBadge categoryId={categoryId} size="sm" />}
              {item.processed && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                  Processado
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm text-foreground truncate mt-1">
              {item.title || "Sem título"}
            </h3>
          </div>
        </div>

        {/* Thumbnail */}
        {item.thumbnail_url && (
          <img
            src={item.thumbnail_url}
            alt={item.title || "Thumbnail"}
            className="w-full h-32 object-cover rounded-lg mb-3 border border-border"
          />
        )}

        {/* Content Preview */}
        {item.content && (
          <p className="text-xs text-muted-foreground line-clamp-3 mb-3 leading-relaxed">
            {item.content}
          </p>
        )}

        {/* Source URL */}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline block truncate font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {item.source_url}
          </a>
        )}
      </div>

      {/* Transcript Dialog */}
      <Dialog open={showTranscript} onOpenChange={setShowTranscript}>
        <DialogContent className="max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle className="text-lg font-semibold flex-1">
              {item.title || "Transcrição do Vídeo"}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive"
              onClick={() => {
                onDelete(item.id);
                setShowTranscript(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-4">
              {item.thumbnail_url && (
                <img
                  src={item.thumbnail_url}
                  alt={item.title || "Thumbnail"}
                  className="w-full rounded-lg border border-border shadow-sm"
                />
              )}
              {item.content ? (
                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>
                </div>
              ) : (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-destructive font-medium mb-2">Transcrição não disponível</p>
                  <p className="text-xs text-destructive/80">
                    A transcrição não foi extraída corretamente. Tente remover e adicionar o vídeo novamente.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
});

ResearchItemNode.displayName = "ResearchItemNode";
