import { Link2, BookOpen, Lightbulb, Sparkles, Trash2, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CanvasToolbarProps {
  onAddNode: (type: "source" | "library" | "prompt" | "generator") => void;
  onClear: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

export function CanvasToolbar({
  onAddNode,
  onClear,
  onZoomIn,
  onZoomOut,
  onFitView
}: CanvasToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-background/95 backdrop-blur border shadow-lg">
        {/* Add nodes */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddNode("source")}
              className="h-8 gap-1.5 text-xs hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
            >
              <div className="h-4 w-4 rounded bg-blue-500 flex items-center justify-center">
                <Link2 className="h-2.5 w-2.5 text-white" />
              </div>
              Fonte
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Adicionar URL, texto ou arquivo</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddNode("library")}
              className="h-8 gap-1.5 text-xs hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950"
            >
              <div className="h-4 w-4 rounded bg-purple-500 flex items-center justify-center">
                <BookOpen className="h-2.5 w-2.5 text-white" />
              </div>
              Biblioteca
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Referenciar item da biblioteca</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddNode("prompt")}
              className="h-8 gap-1.5 text-xs hover:bg-yellow-50 hover:text-yellow-600 dark:hover:bg-yellow-950"
            >
              <div className="h-4 w-4 rounded bg-yellow-500 flex items-center justify-center">
                <Lightbulb className="h-2.5 w-2.5 text-white" />
              </div>
              Briefing
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Adicionar instruções/briefing</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddNode("generator")}
              className="h-8 gap-1.5 text-xs hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950"
            >
              <div className="h-4 w-4 rounded bg-green-500 flex items-center justify-center">
                <Sparkles className="h-2.5 w-2.5 text-white" />
              </div>
              Gerador
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Adicionar gerador de conteúdo</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Diminuir zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Aumentar zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onFitView} className="h-8 w-8">
              <Maximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Ajustar visualização</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Clear */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear} 
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Limpar canvas</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
