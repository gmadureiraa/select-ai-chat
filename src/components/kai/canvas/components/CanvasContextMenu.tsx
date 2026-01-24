import { memo, useEffect, useRef } from "react";
import {
  Type,
  StickyNote,
  Square,
  Paperclip,
  MessageSquare,
  Sparkles,
  Eraser,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CanvasContextMenuProps {
  position: { x: number; y: number };
  onAction: (action: string) => void;
  onClose: () => void;
  hasDrawings: boolean;
}

interface MenuItem {
  type?: "separator";
  label?: string;
  action?: string;
  icon?: LucideIcon;
  shortcut?: string;
  color?: string;
}

function CanvasContextMenuComponent({
  position,
  onAction,
  onClose,
  hasDrawings,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const menuItems: MenuItem[] = [
    { label: "Texto", action: "add-text", icon: Type, shortcut: "T" },
    { label: "Sticky Note", action: "add-sticky", icon: StickyNote, shortcut: "S" },
    { label: "Forma", action: "add-shape", icon: Square, shortcut: "R" },
    { type: "separator" },
    { label: "Anexo (IA)", action: "add-attachment", icon: Paperclip, color: "text-blue-500" },
    { label: "Instruções (IA)", action: "add-prompt", icon: MessageSquare, color: "text-yellow-500" },
    { label: "Gerador (IA)", action: "add-generator", icon: Sparkles, color: "text-primary" },
  ];

  if (hasDrawings) {
    menuItems.push(
      { type: "separator" },
      { label: "Limpar desenhos", action: "clear-drawings", icon: Eraser, color: "text-destructive" }
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-popover border rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {menuItems.map((item, index) => {
        if (item.type === "separator") {
          return <div key={index} className="h-px bg-border my-1" />;
        }

        const Icon = item.icon;
        return (
          <button
            key={item.action || index}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
              item.color
            )}
            onClick={() => {
              if (item.action) {
                onAction(item.action);
              }
              onClose();
            }}
          >
            {Icon && <Icon size={16} className={item.color || "text-muted-foreground"} />}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {item.shortcut}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const CanvasContextMenu = memo(CanvasContextMenuComponent);
