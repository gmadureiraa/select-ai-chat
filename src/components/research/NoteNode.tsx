import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Trash2, StickyNote, Check, X, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useResearchItems } from "@/hooks/useResearchItems";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./RichTextEditor";
import ReactMarkdown from "react-markdown";
import { CategorySelector } from "./CategorySelector";
import { CategoryBadge } from "./CategoryBadge";
import { getCategoryById } from "@/types/researchCategories";

interface NoteNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  projectId: string;
  isConnected?: boolean;
  onUpdate?: (id: string, updates: any) => void;
}

export const NoteNode = memo(({ data }: NodeProps<NoteNodeData>) => {
  const { item, onDelete, projectId, isConnected, onUpdate } = data;
  const { updateItem } = useResearchItems(projectId);
  const [isEditing, setIsEditing] = useState(!item.content);
  const [title, setTitle] = useState(item.title || "");
  const [content, setContent] = useState(item.content || "");
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

  const handleSave = () => {
    if (!content.trim()) return;
    updateItem.mutate({
      id: item.id,
      title: title || "Nota",
      content: content.trim(),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (!item.content) {
      onDelete(item.id);
    } else {
      setTitle(item.title || "");
      setContent(item.content || "");
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
  };

  return (
    <div 
      className={cn(
        "bg-yellow-900/20 border-2 border-yellow-700 rounded-xl shadow-md hover:shadow-lg transition-all",
        "p-3 min-w-[300px] max-w-[380px] group relative",
        isConnected && "ring-2 ring-yellow-400/50"
      )}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" id="left" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" id="right" />

      {/* Actions */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {onUpdate && (
          <CategorySelector
            categoryId={categoryId}
            onCategoryChange={handleCategoryChange}
            size="sm"
          />
        )}
        {!isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
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
        <div className={cn("p-2 rounded-lg border", category?.bgClass || "bg-yellow-800/30", category?.borderClass || "border-yellow-700")}>
          <StickyNote className={cn("h-4 w-4", category?.textClass || "text-yellow-400")} />
        </div>
        <div className="flex-1 min-w-0 pr-16">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow-800/50 text-yellow-300 text-xs font-medium">
              Nota
            </span>
            {categoryId && <CategoryBadge categoryId={categoryId} size="sm" />}
          </div>
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Input
            placeholder="Título da nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm bg-background"
          />
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Digite suas anotações em Markdown..."
            minRows={6}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={!content.trim()} className="flex-1">
              <Check className="h-3.5 w-3.5 mr-1" />
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="cursor-pointer" onClick={() => setIsEditing(true)}>
          <h3 className="font-semibold text-sm text-foreground mb-2">{item.title || "Nota"}</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-muted-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-sm font-bold mb-1">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold mb-1">{children}</h2>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-1">{children}</ol>,
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-yellow-400 pl-2 italic">{children}</blockquote>,
                code: ({ children }) => <code className="bg-muted px-1 rounded text-[10px]">{children}</code>,
              }}
            >
              {item.content?.slice(0, 500) || ""}
            </ReactMarkdown>
            {item.content && item.content.length > 500 && (
              <span className="text-yellow-600">...</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

NoteNode.displayName = "NoteNode";
