import { memo } from "react";
import {
  MousePointer2,
  Type,
  StickyNote,
  Square,
  Pencil,
  Image,
  Sparkles,
  Circle,
  Diamond,
  ArrowRight,
  Eraser,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ToolType = 
  | "cursor" 
  | "text" 
  | "sticky" 
  | "shape" 
  | "pencil" 
  | "image" 
  | "eraser";

export type ShapeType = "rectangle" | "circle" | "diamond" | "arrow";

const BRUSH_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#000000", // black
  "#6b7280", // gray
  "#ffffff", // white
];

const BRUSH_SIZES = [2, 4, 8];

const STICKY_COLORS = [
  { name: "Amarelo", value: "#fef08a" },
  { name: "Rosa", value: "#fda4af" },
  { name: "Azul", value: "#93c5fd" },
  { name: "Verde", value: "#86efac" },
  { name: "Roxo", value: "#c4b5fd" },
  { name: "Laranja", value: "#fed7aa" },
];

interface CanvasSideToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  brushColor: string;
  brushSize: number;
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  selectedShape: ShapeType;
  onShapeChange: (shape: ShapeType) => void;
  selectedStickyColor: string;
  onStickyColorChange: (color: string) => void;
  onAddAINode: (type: "attachment" | "prompt" | "generator") => void;
  onClearDrawings: () => void;
}

function CanvasSideToolbarComponent({
  activeTool,
  onToolChange,
  brushColor,
  brushSize,
  onBrushColorChange,
  onBrushSizeChange,
  selectedShape,
  onShapeChange,
  selectedStickyColor,
  onStickyColorChange,
  onAddAINode,
  onClearDrawings,
}: CanvasSideToolbarProps) {
  const tools: Array<{
    type: ToolType;
    icon: React.ReactNode;
    label: string;
    shortcut: string;
  }> = [
    { type: "cursor", icon: <MousePointer2 size={18} />, label: "Selecionar", shortcut: "V" },
    { type: "text", icon: <Type size={18} />, label: "Texto", shortcut: "T" },
    { type: "sticky", icon: <StickyNote size={18} />, label: "Sticky Note", shortcut: "S" },
    { type: "shape", icon: <Square size={18} />, label: "Forma", shortcut: "R" },
    { type: "pencil", icon: <Pencil size={18} />, label: "Lápis", shortcut: "P" },
    { type: "eraser", icon: <Eraser size={18} />, label: "Borracha", shortcut: "E" },
    { type: "image", icon: <Image size={18} />, label: "Imagem", shortcut: "I" },
  ];

  const shapes: Array<{ type: ShapeType; icon: React.ReactNode; label: string }> = [
    { type: "rectangle", icon: <Square size={16} />, label: "Retângulo" },
    { type: "circle", icon: <Circle size={16} />, label: "Círculo" },
    { type: "diamond", icon: <Diamond size={16} />, label: "Losango" },
    { type: "arrow", icon: <ArrowRight size={16} />, label: "Seta" },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-background border shadow-lg rounded-xl p-2">
        {/* Main tools */}
        {tools.map((tool) => (
          <Tooltip key={tool.type}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.type ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-lg",
                  activeTool === tool.type && "bg-primary text-primary-foreground"
                )}
                onClick={() => onToolChange(tool.type)}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              {tool.label}
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                {tool.shortcut}
              </kbd>
            </TooltipContent>
          </Tooltip>
        ))}

        <div className="h-px bg-border my-1" />

        {/* Pencil settings - show when pencil or eraser is active */}
        {(activeTool === "pencil" || activeTool === "eraser") && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg"
              >
                <div
                  className="w-4 h-4 rounded-full border-2 border-foreground"
                  style={{ backgroundColor: activeTool === "eraser" ? "#ffffff" : brushColor }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-auto p-3">
              <div className="space-y-3">
                {activeTool === "pencil" && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground">Cor</div>
                    <div className="flex flex-wrap gap-1.5 max-w-[120px]">
                      {BRUSH_COLORS.map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                            brushColor === color ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => onBrushColorChange(color)}
                        />
                      ))}
                    </div>
                  </>
                )}
                <div className="text-xs font-medium text-muted-foreground">Tamanho</div>
                <div className="flex gap-2">
                  {BRUSH_SIZES.map((size) => (
                    <button
                      key={size}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors",
                        brushSize === size
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => onBrushSizeChange(size)}
                    >
                      <div
                        className="rounded-full bg-foreground"
                        style={{ width: size * 2, height: size * 2 }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Shape selector - show when shape is active */}
        {activeTool === "shape" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg"
              >
                {shapes.find((s) => s.type === selectedShape)?.icon || <Square size={18} />}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-auto p-2">
              <div className="flex gap-1">
                {shapes.map((shape) => (
                  <Button
                    key={shape.type}
                    variant={selectedShape === shape.type ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onShapeChange(shape.type)}
                  >
                    {shape.icon}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Sticky color selector - show when sticky is active */}
        {activeTool === "sticky" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg"
              >
                <div
                  className="w-4 h-4 rounded border border-foreground/20"
                  style={{ backgroundColor: selectedStickyColor }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-auto p-2">
              <div className="flex gap-1.5">
                {STICKY_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={cn(
                      "w-6 h-6 rounded border-2 transition-transform hover:scale-110",
                      selectedStickyColor === color.value
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => onStickyColorChange(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <div className="h-px bg-border my-1" />

        {/* AI Nodes dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-primary"
                >
                  <Sparkles size={18} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">
              Nós de IA
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem onClick={() => onAddAINode("attachment")}>
              <Image className="mr-2 h-4 w-4" />
              Anexo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddAINode("prompt")}>
              <Type className="mr-2 h-4 w-4" />
              Instruções
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddAINode("generator")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerador
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear drawings button */}
        {(activeTool === "pencil" || activeTool === "eraser") && (
          <>
            <div className="h-px bg-border my-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={onClearDrawings}
                >
                  <Minus size={18} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Limpar desenhos
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

export const CanvasSideToolbar = memo(CanvasSideToolbarComponent);
