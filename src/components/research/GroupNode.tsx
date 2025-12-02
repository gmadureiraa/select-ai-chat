import { memo, useState } from "react";
import { Handle, Position, NodeResizer } from "reactflow";
import { Trash2, GripVertical, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface GroupNodeProps {
  id: string;
  data: {
    item: {
      title: string | null;
      metadata?: {
        color?: string;
        collapsed?: boolean;
      };
    };
    onDelete: (id: string) => void;
    onUpdate?: (id: string, updates: any) => void;
  };
  selected?: boolean;
}

const groupColors = [
  { id: "purple", bg: "bg-purple-500/10", border: "border-purple-500/30", label: "Roxo" },
  { id: "blue", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Azul" },
  { id: "green", bg: "bg-green-500/10", border: "border-green-500/30", label: "Verde" },
  { id: "yellow", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Amarelo" },
  { id: "red", bg: "bg-red-500/10", border: "border-red-500/30", label: "Vermelho" },
  { id: "pink", bg: "bg-pink-500/10", border: "border-pink-500/30", label: "Rosa" },
  { id: "cyan", bg: "bg-cyan-500/10", border: "border-cyan-500/30", label: "Ciano" },
  { id: "orange", bg: "bg-orange-500/10", border: "border-orange-500/30", label: "Laranja" },
];

export const GroupNode = memo(({ id, data, selected }: GroupNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.item.title || "Grupo");
  
  const colorId = data.item.metadata?.color || "purple";
  const colorConfig = groupColors.find(c => c.id === colorId) || groupColors[0];

  const handleTitleChange = () => {
    setIsEditing(false);
    if (data.onUpdate) {
      data.onUpdate(id, { title });
    }
  };

  const handleColorChange = (newColor: string) => {
    if (data.onUpdate) {
      data.onUpdate(id, { 
        metadata: { 
          ...data.item.metadata, 
          color: newColor 
        } 
      });
    }
  };

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="!border-primary"
        handleClassName="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      
      <div
        className={cn(
          "min-w-[200px] min-h-[150px] rounded-xl border-2 border-dashed transition-all",
          colorConfig.bg,
          colorConfig.border,
          selected && "ring-2 ring-primary/30"
        )}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-dashed border-inherit">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleChange}
              onKeyDown={(e) => e.key === "Enter" && handleTitleChange()}
              className="h-6 text-sm font-medium bg-transparent border-none p-0 focus-visible:ring-0"
              autoFocus
            />
          ) : (
            <span 
              className="text-sm font-medium cursor-pointer hover:text-primary"
              onDoubleClick={() => setIsEditing(true)}
            >
              {title}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Palette className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="grid grid-cols-4 gap-1">
                  {groupColors.map((color) => (
                    <button
                      key={color.id}
                      className={cn(
                        "w-6 h-6 rounded border-2 transition-all",
                        color.bg,
                        color.border,
                        colorId === color.id && "ring-2 ring-primary ring-offset-1"
                      )}
                      onClick={() => handleColorChange(color.id)}
                      title={color.label}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => data.onDelete(id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Drop zone indicator */}
        <div className="absolute inset-4 top-12 border border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground/50">Arraste itens para dentro</span>
        </div>
      </div>

      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3 !border-2 !border-background" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3 !border-2 !border-background" />
    </>
  );
});

GroupNode.displayName = "GroupNode";
