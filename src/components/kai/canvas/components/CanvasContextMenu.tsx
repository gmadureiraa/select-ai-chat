import { memo } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  Clipboard,
  Type,
  StickyNote,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Paperclip,
  MessageSquare,
  Sparkles,
  Eraser,
  Image,
} from "lucide-react";

interface CanvasContextMenuProps {
  children: React.ReactNode;
  onPaste: () => void;
  onAddText: (position: { x: number; y: number }) => void;
  onAddSticky: (position: { x: number; y: number }, color: string) => void;
  onAddShape: (position: { x: number; y: number }, shapeType: string) => void;
  onAddAttachment: (position: { x: number; y: number }) => void;
  onAddPrompt: (position: { x: number; y: number }) => void;
  onAddGenerator: (position: { x: number; y: number }) => void;
  onClearDrawings: () => void;
  hasDrawings: boolean;
  contextPosition: { x: number; y: number } | null;
  onContextPositionChange: (pos: { x: number; y: number } | null) => void;
}

const STICKY_COLORS = [
  { name: "Amarelo", value: "#fef08a" },
  { name: "Rosa", value: "#fda4af" },
  { name: "Azul", value: "#93c5fd" },
  { name: "Verde", value: "#86efac" },
  { name: "Roxo", value: "#c4b5fd" },
  { name: "Laranja", value: "#fed7aa" },
];

function CanvasContextMenuComponent({
  children,
  onPaste,
  onAddText,
  onAddSticky,
  onAddShape,
  onAddAttachment,
  onAddPrompt,
  onAddGenerator,
  onClearDrawings,
  hasDrawings,
  contextPosition,
  onContextPositionChange,
}: CanvasContextMenuProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    onContextPositionChange({ x: e.clientX, y: e.clientY });
  };

  const getPosition = () => contextPosition || { x: 0, y: 0 };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onPaste}>
          <Clipboard className="mr-2 h-4 w-4" />
          Colar
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+V</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => onAddText(getPosition())}>
          <Type className="mr-2 h-4 w-4" />
          Texto
          <span className="ml-auto text-xs text-muted-foreground">T</span>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <StickyNote className="mr-2 h-4 w-4" />
            Sticky Note
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {STICKY_COLORS.map((color) => (
              <ContextMenuItem
                key={color.value}
                onClick={() => onAddSticky(getPosition(), color.value)}
              >
                <div
                  className="mr-2 h-4 w-4 rounded border"
                  style={{ backgroundColor: color.value }}
                />
                {color.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Square className="mr-2 h-4 w-4" />
            Forma
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onAddShape(getPosition(), "rectangle")}>
              <Square className="mr-2 h-4 w-4" />
              Retângulo
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAddShape(getPosition(), "circle")}>
              <Circle className="mr-2 h-4 w-4" />
              Círculo
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAddShape(getPosition(), "diamond")}>
              <Diamond className="mr-2 h-4 w-4" />
              Losango
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onAddShape(getPosition(), "arrow")}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Seta
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => onAddAttachment(getPosition())}>
          <Paperclip className="mr-2 h-4 w-4 text-blue-500" />
          Anexo (IA)
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onAddPrompt(getPosition())}>
          <MessageSquare className="mr-2 h-4 w-4 text-yellow-500" />
          Instruções (IA)
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onAddGenerator(getPosition())}>
          <Sparkles className="mr-2 h-4 w-4 text-green-500" />
          Gerador (IA)
        </ContextMenuItem>

        {hasDrawings && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={onClearDrawings}
              className="text-destructive focus:text-destructive"
            >
              <Eraser className="mr-2 h-4 w-4" />
              Limpar desenhos
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const CanvasContextMenu = memo(CanvasContextMenuComponent);
