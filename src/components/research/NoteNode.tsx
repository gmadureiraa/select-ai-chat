import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Trash2, StickyNote, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useResearchItems } from "@/hooks/useResearchItems";
import { cn } from "@/lib/utils";

interface NoteNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  projectId: string;
  isConnected?: boolean;
}

export const NoteNode = memo(({ data }: NodeProps<NoteNodeData>) => {
  const { item, onDelete, projectId, isConnected } = data;
  const { updateItem } = useResearchItems(projectId);
  const [isEditing, setIsEditing] = useState(!item.content);
  const [title, setTitle] = useState(item.title || "");
  const [content, setContent] = useState(item.content || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

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
        "bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl shadow-md hover:shadow-lg transition-all",
        "p-3 min-w-[280px] max-w-[320px] group relative",
        isConnected && "ring-2 ring-yellow-400/50"
      )}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" id="left" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-yellow-400 hover:!bg-yellow-500 !border-2 !border-background" id="right" />

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg border border-yellow-300 dark:border-yellow-700">
          <StickyNote className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow-200 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-300 text-xs font-medium">
            Nota
          </span>
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Input
            placeholder="Título da nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm bg-white dark:bg-background"
          />
          <Textarea
            ref={textareaRef}
            placeholder="Digite suas anotações..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="text-sm resize-none bg-white dark:bg-background no-pan no-wheel"
            onWheel={(e) => e.stopPropagation()}
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
        <div onClick={() => setIsEditing(true)} className="cursor-pointer">
          <h3 className="font-semibold text-sm text-foreground mb-2">{item.title || "Nota"}</h3>
          <p className="text-xs text-muted-foreground line-clamp-5 leading-relaxed whitespace-pre-wrap">
            {item.content}
          </p>
        </div>
      )}
    </div>
  );
});

NoteNode.displayName = "NoteNode";
