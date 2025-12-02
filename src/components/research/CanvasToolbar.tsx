import { useEffect, useCallback } from "react";
import { 
  MousePointer2, 
  Sparkles, 
  StickyNote, 
  Youtube, 
  FileText, 
  Link as LinkIcon, 
  Mic, 
  Image, 
  BookOpen, 
  Library,
  FileText as PDFIcon,
  Globe,
  Table,
  GitCompare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  onAddItem: (type: string) => void;
  activeTool: string | null;
  setActiveTool: (tool: string | null) => void;
}

const tools = [
  { id: "select", icon: MousePointer2, label: "Selecionar", shortcut: "V", color: "" },
  { id: "ai_chat", icon: Sparkles, label: "Chat IA", shortcut: "C", color: "text-purple-500", bgHover: "hover:bg-purple-500/10" },
  { id: "comparison", icon: GitCompare, label: "Comparação", shortcut: "K", color: "text-amber-500", bgHover: "hover:bg-amber-500/10" },
  { id: "group", icon: Square, label: "Grupo/Frame", shortcut: "G", color: "text-slate-500", bgHover: "hover:bg-slate-500/10" },
  { id: "note", icon: StickyNote, label: "Nota", shortcut: "N", color: "text-yellow-500", bgHover: "hover:bg-yellow-500/10" },
  { id: "youtube", icon: Youtube, label: "YouTube", shortcut: "Y", color: "text-red-500", bgHover: "hover:bg-red-500/10" },
  { id: "text", icon: FileText, label: "Texto", shortcut: "T", color: "text-blue-500", bgHover: "hover:bg-blue-500/10" },
  { id: "link", icon: LinkIcon, label: "Link", shortcut: "L", color: "text-green-500", bgHover: "hover:bg-green-500/10" },
  { id: "pdf", icon: PDFIcon, label: "PDF", shortcut: "P", color: "text-rose-500", bgHover: "hover:bg-rose-500/10" },
  { id: "embed", icon: Globe, label: "Embed Social", shortcut: "E", color: "text-emerald-500", bgHover: "hover:bg-emerald-500/10" },
  { id: "spreadsheet", icon: Table, label: "Planilha", shortcut: "S", color: "text-teal-500", bgHover: "hover:bg-teal-500/10" },
  { id: "audio", icon: Mic, label: "Áudio", shortcut: "A", color: "text-pink-500", bgHover: "hover:bg-pink-500/10" },
  { id: "image", icon: Image, label: "Imagem", shortcut: "I", color: "text-orange-500", bgHover: "hover:bg-orange-500/10" },
  { id: "content_library", icon: BookOpen, label: "Biblioteca de Conteúdo", shortcut: "B", color: "text-cyan-500", bgHover: "hover:bg-cyan-500/10" },
  { id: "reference_library", icon: Library, label: "Biblioteca de Referências", shortcut: "R", color: "text-indigo-500", bgHover: "hover:bg-indigo-500/10" },
];

export const CanvasToolbar = ({ onAddItem, activeTool, setActiveTool }: CanvasToolbarProps) => {
  const handleToolClick = useCallback((toolId: string) => {
    if (toolId === "select") {
      setActiveTool("select");
    } else {
      setActiveTool(toolId);
      onAddItem(toolId);
      // Reset to select after adding
      setTimeout(() => setActiveTool("select"), 100);
    }
  }, [onAddItem, setActiveTool]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const key = e.key.toUpperCase();
      const tool = tools.find(t => t.shortcut === key);
      
      if (tool) {
        e.preventDefault();
        handleToolClick(tool.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToolClick]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 px-3 py-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg">
          {tools.map((tool, index) => (
            <div key={tool.id} className="flex items-center">
              {index === 1 && (
                <div className="w-px h-6 bg-border mx-1" />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-lg transition-all",
                      activeTool === tool.id 
                        ? "bg-accent text-accent-foreground ring-2 ring-primary/30" 
                        : tool.bgHover || "hover:bg-accent/50",
                      tool.color
                    )}
                    onClick={() => handleToolClick(tool.id)}
                  >
                    <tool.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{tool.label}</p>
                  <span className="text-muted-foreground">
                    Atalho: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">{tool.shortcut}</kbd>
                  </span>
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
