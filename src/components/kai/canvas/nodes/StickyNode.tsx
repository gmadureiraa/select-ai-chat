import { memo, useState, useRef, useEffect, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StickyNodeData {
  type: "sticky";
  content: string;
  color: string;
  size: "small" | "medium" | "large";
}

interface StickyNodeProps extends NodeProps<StickyNodeData> {
  onUpdateData: (id: string, data: Partial<StickyNodeData>) => void;
  onDelete: (id: string) => void;
}

const SIZE_MAP = {
  small: { width: 120, height: 120 },
  medium: { width: 160, height: 160 },
  large: { width: 200, height: 200 },
};

const STICKY_COLORS = [
  "#fef08a", // yellow
  "#fda4af", // pink
  "#93c5fd", // blue
  "#86efac", // green
  "#c4b5fd", // purple
  "#fed7aa", // orange
];

function StickyNodeComponent({ id, data, selected, onUpdateData, onDelete }: StickyNodeProps) {
  const [isEditing, setIsEditing] = useState(!data.content);
  const [showControls, setShowControls] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dimensions = SIZE_MAP[data.size];

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false);
    }
    e.stopPropagation();
  }, []);

  const cycleSize = useCallback(() => {
    const sizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
    const currentIndex = sizes.indexOf(data.size);
    const nextIndex = (currentIndex + 1) % sizes.length;
    onUpdateData(id, { size: sizes[nextIndex] });
  }, [id, data.size, onUpdateData]);

  const cycleColor = useCallback(() => {
    const currentIndex = STICKY_COLORS.indexOf(data.color);
    const nextIndex = (currentIndex + 1) % STICKY_COLORS.length;
    onUpdateData(id, { color: STICKY_COLORS[nextIndex] });
  }, [id, data.color, onUpdateData]);

  // Calculate text color based on background
  const isDark = data.color === "#c4b5fd" || data.color === "#93c5fd";
  const textColor = isDark ? "#1f2937" : "#1f2937";

  return (
    <div
      className={cn(
        "group relative rounded-sm transition-shadow nodrag",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: data.color,
        boxShadow: "2px 4px 8px rgba(0,0,0,0.15)",
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-600" />
      <Handle type="source" position={Position.Right} className="!bg-gray-600" />

      {/* Top fold effect */}
      <div
        className="absolute top-0 right-0 w-6 h-6"
        style={{
          background: `linear-gradient(135deg, transparent 50%, ${data.color}dd 50%)`,
          filter: "brightness(0.9)",
        }}
      />

      {/* Controls */}
      {(showControls || selected) && (
        <div className="absolute -top-9 left-0 right-0 flex items-center justify-center gap-1 z-10">
          <div className="flex items-center gap-1 bg-background border shadow-lg rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={cycleColor}
              title="Mudar cor"
            >
              <div
                className="w-3 h-3 rounded-full border border-foreground/20"
                style={{ backgroundColor: data.color }}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-xs"
              onClick={cycleSize}
              title="Mudar tamanho"
            >
              {data.size === "small" ? "S" : data.size === "medium" ? "M" : "L"}
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(id)}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3 h-full">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={data.content}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Escreva aqui..."
            className="w-full h-full bg-transparent resize-none outline-none border-none text-sm"
            style={{ color: textColor }}
          />
        ) : (
          <div
            className={cn(
              "w-full h-full text-sm whitespace-pre-wrap overflow-hidden cursor-text",
              !data.content && "opacity-50 italic"
            )}
            style={{ color: textColor }}
          >
            {data.content || "Clique duplo para editar"}
          </div>
        )}
      </div>
    </div>
  );
}

export const StickyNode = memo(StickyNodeComponent);
