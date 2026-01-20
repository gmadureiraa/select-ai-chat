import { memo, useState, useRef, useEffect, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2, Bold, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TextNodeData {
  type: "text";
  content: string;
  fontSize: 12 | 16 | 24 | 32 | 48;
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
  color: string;
}

interface TextNodeProps extends NodeProps<TextNodeData> {
  onUpdateData: (id: string, data: Partial<TextNodeData>) => void;
  onDelete: (id: string) => void;
}

const FONT_SIZES = [12, 16, 24, 32, 48] as const;

function TextNodeComponent({ id, data, selected, onUpdateData, onDelete }: TextNodeProps) {
  const [isEditing, setIsEditing] = useState(!data.content);
  const [showToolbar, setShowToolbar] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdateData(id, { content: e.target.value });
    },
    [id, onUpdateData]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsEditing(false);
      }
      // Prevent node deletion when typing
      e.stopPropagation();
    },
    []
  );

  const toggleBold = useCallback(() => {
    onUpdateData(id, { fontWeight: data.fontWeight === "bold" ? "normal" : "bold" });
  }, [id, data.fontWeight, onUpdateData]);

  const setAlignment = useCallback(
    (align: "left" | "center" | "right") => {
      onUpdateData(id, { textAlign: align });
    },
    [id, onUpdateData]
  );

  const cycleFontSize = useCallback(() => {
    const currentIndex = FONT_SIZES.indexOf(data.fontSize);
    const nextIndex = (currentIndex + 1) % FONT_SIZES.length;
    onUpdateData(id, { fontSize: FONT_SIZES[nextIndex] });
  }, [id, data.fontSize, onUpdateData]);

  return (
    <div
      className={cn(
        "group relative min-w-[100px] min-h-[40px]",
        selected && "ring-2 ring-primary ring-offset-2 rounded"
      )}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-primary" />

      {/* Floating toolbar */}
      {(showToolbar || selected) && !isEditing && (
        <div className="absolute -top-10 left-0 flex items-center gap-1 bg-background border shadow-lg rounded-lg p-1 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleBold}
          >
            <Bold size={14} className={data.fontWeight === "bold" ? "text-primary" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAlignment("left")}
          >
            <AlignLeft size={14} className={data.textAlign === "left" ? "text-primary" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAlignment("center")}
          >
            <AlignCenter size={14} className={data.textAlign === "center" ? "text-primary" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAlignment("right")}
          >
            <AlignRight size={14} className={data.textAlign === "right" ? "text-primary" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={cycleFontSize}
          >
            <span className="text-xs font-medium">{data.fontSize}</span>
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(id)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )}

      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={data.content}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Digite seu texto..."
          className={cn(
            "min-w-[150px] min-h-[40px] bg-transparent resize-none outline-none border-none p-1 nodrag",
            data.fontWeight === "bold" && "font-bold"
          )}
          style={{
            fontSize: data.fontSize,
            textAlign: data.textAlign,
            color: data.color,
          }}
        />
      ) : (
        <div
          className={cn(
            "min-w-[100px] min-h-[40px] p-1 cursor-text whitespace-pre-wrap",
            data.fontWeight === "bold" && "font-bold",
            !data.content && "text-muted-foreground italic"
          )}
          style={{
            fontSize: data.fontSize,
            textAlign: data.textAlign,
            color: data.content ? data.color : undefined,
          }}
        >
          {data.content || "Clique duplo para editar"}
        </div>
      )}
    </div>
  );
}

export const TextNode = memo(TextNodeComponent);
