import { useState } from "react";
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
  Plus
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
  { id: "select", icon: MousePointer2, label: "Selecionar", shortcut: "V" },
  { id: "ai_chat", icon: Sparkles, label: "Chat IA", color: "text-purple-500" },
  { id: "note", icon: StickyNote, label: "Nota", color: "text-yellow-500" },
  { id: "youtube", icon: Youtube, label: "YouTube", color: "text-red-500" },
  { id: "text", icon: FileText, label: "Texto", color: "text-blue-500" },
  { id: "link", icon: LinkIcon, label: "Link", color: "text-green-500" },
  { id: "audio", icon: Mic, label: "Áudio", color: "text-pink-500" },
  { id: "image", icon: Image, label: "Imagem", color: "text-orange-500" },
  { id: "content_library", icon: BookOpen, label: "Biblioteca de Conteúdo", color: "text-cyan-500" },
  { id: "reference_library", icon: Library, label: "Biblioteca de Referências", color: "text-indigo-500" },
];

export const CanvasToolbar = ({ onAddItem, activeTool, setActiveTool }: CanvasToolbarProps) => {
  const handleToolClick = (toolId: string) => {
    if (toolId === "select") {
      setActiveTool("select");
    } else {
      setActiveTool(toolId);
      onAddItem(toolId);
      // Reset to select after adding
      setTimeout(() => setActiveTool("select"), 100);
    }
  };

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
                        ? "bg-accent text-accent-foreground" 
                        : "hover:bg-accent/50",
                      tool.color
                    )}
                    onClick={() => handleToolClick(tool.id)}
                  >
                    <tool.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{tool.label}</p>
                  {tool.shortcut && (
                    <span className="text-muted-foreground ml-1">({tool.shortcut})</span>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
