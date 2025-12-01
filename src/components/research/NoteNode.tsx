import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Trash2, StickyNote, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ResearchItem } from "@/hooks/useResearchItems";
import { useResearchItems } from "@/hooks/useResearchItems";

interface NoteNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  projectId: string;
}

export const NoteNode = memo(({ data }: NodeProps<NoteNodeData>) => {
  const { item, onDelete, projectId } = data;
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

  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-4 min-w-[280px] max-w-[320px] group relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Left} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-gray-400" />

      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 h-8 px-2 rounded-full border-red-200 text-red-600 bg-red-50/80 hover:bg-red-100 hover:text-red-700 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-start gap-3 mb-3">
        <div className="p-2.5 bg-yellow-100 rounded-lg border border-yellow-300">
          <StickyNote className="h-4 w-4 text-yellow-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-200 text-yellow-800 text-xs font-medium mb-2">
            Nota
          </div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Input
            placeholder="Título da nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm bg-white"
          />
          <Textarea
            ref={textareaRef}
            placeholder="Digite suas anotações..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="text-sm resize-none bg-white"
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
          <h3 className="font-semibold text-sm text-gray-900 mb-2">{item.title || "Nota"}</h3>
          <p className="text-xs text-gray-700 line-clamp-5 leading-relaxed whitespace-pre-wrap">
            {item.content}
          </p>
        </div>
      )}
    </div>
  );
});

NoteNode.displayName = "NoteNode";
