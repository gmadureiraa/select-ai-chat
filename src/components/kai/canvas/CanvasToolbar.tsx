import { useEffect, useState } from "react";
import { Link2, Lightbulb, Sparkles, Trash2, ZoomIn, ZoomOut, Maximize, Save, FolderOpen, ChevronDown, Loader2, X, Pencil, LayoutTemplate, ImageIcon, Smartphone, Briefcase, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SavedCanvas } from "./hooks/useCanvasState";

export type CanvasTemplate = 
  | "carousel_from_url" 
  | "thread_from_video" 
  | "newsletter_curated" 
  | "reel_script" 
  | "image_series"
  | "linkedin_article"
  | "podcast_highlights"
  | "story_sequence"
  | "repurpose_blog"
  | "weekly_summary";

interface CanvasToolbarProps {
  onAddNode: (type: "source" | "prompt" | "generator" | "image-source") => void;
  onClear: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onLoadTemplate?: (templateId: CanvasTemplate) => void;
  // Canvas persistence
  currentCanvasName?: string;
  setCanvasName?: (name: string) => void;
  onSave?: (name?: string) => Promise<any>;
  onLoad?: (canvasId: string) => void;
  onDelete?: (canvasId: string) => Promise<void>;
  savedCanvases?: SavedCanvas[];
  isLoadingCanvases?: boolean;
  isSaving?: boolean;
}

interface TemplateCategory {
  category: string;
  templates: { id: CanvasTemplate; icon: string; label: string; description: string }[];
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    category: "Redes Sociais",
    templates: [
      { id: "carousel_from_url", icon: "🎠", label: "Carrossel de URL", description: "Transforme conteúdo em carrossel" },
      { id: "thread_from_video", icon: "🧵", label: "Thread de Vídeo", description: "Crie thread viral de vídeo" },
      { id: "story_sequence", icon: "📖", label: "Sequência de Stories", description: "5 stories em sequência" },
      { id: "reel_script", icon: "🎬", label: "Roteiro de Reel", description: "Script para vídeo curto" },
    ]
  },
  {
    category: "Profissional",
    templates: [
      { id: "linkedin_article", icon: "💼", label: "Artigo LinkedIn", description: "Post profissional" },
      { id: "newsletter_curated", icon: "📧", label: "Newsletter Curada", description: "Compile fontes em newsletter" },
      { id: "weekly_summary", icon: "📋", label: "Resumo Semanal", description: "Curadoria de 3 fontes" },
    ]
  },
  {
    category: "Repurpose",
    templates: [
      { id: "repurpose_blog", icon: "🔄", label: "Repurpose de Blog", description: "Blog → Carrossel + Thread" },
      { id: "podcast_highlights", icon: "🎙️", label: "Destaques de Podcast", description: "Áudio → Thread" },
      { id: "image_series", icon: "🖼️", label: "Série de Imagens", description: "Gere 3 imagens de uma vez" },
    ]
  },
];

export function CanvasToolbar({
  onAddNode,
  onClear,
  onZoomIn,
  onZoomOut,
  onFitView,
  onLoadTemplate,
  currentCanvasName = "Novo Canvas",
  setCanvasName,
  onSave,
  onLoad,
  onDelete,
  savedCanvases = [],
  isLoadingCanvases = false,
  isSaving = false,
}: CanvasToolbarProps) {
  const [canvasName, setLocalCanvasName] = useState(currentCanvasName);
  const [isEditing, setIsEditing] = useState(false);

  // Sync local state with prop
  useEffect(() => {
    setLocalCanvasName(currentCanvasName);
  }, [currentCanvasName]);

  const handleSave = async () => {
    setCanvasName?.(canvasName);
    await onSave?.(canvasName);
  };

  const handleNameBlur = () => {
    setIsEditing(false);
    setCanvasName?.(canvasName);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      setCanvasName?.(canvasName);
    }
  };

  const handleDeleteCanvas = async (e: React.MouseEvent, canvasId: string) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza que deseja excluir este canvas?")) {
      await onDelete?.(canvasId);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-background/95 backdrop-blur border shadow-lg">
        {/* Canvas name */}
        <div className="flex items-center gap-1 mr-2">
          {isEditing ? (
            <Input
              value={canvasName}
              onChange={(e) => setLocalCanvasName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="h-7 w-[140px] text-xs"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1">
              <span 
                className="text-xs font-medium cursor-pointer hover:text-primary px-1.5"
                onClick={() => setIsEditing(true)}
                title="Clique para editar"
              >
                {canvasName}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Renomear canvas</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Templates dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs hover:bg-primary/10 hover:text-primary">
                  <LayoutTemplate className="h-4 w-4" />
                  Templates
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Carregar template de fluxo</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" className="w-80 max-h-[400px] overflow-y-auto">
            {TEMPLATE_CATEGORIES.map((category, idx) => (
              <div key={category.category}>
                {idx > 0 && <DropdownMenuSeparator />}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  {category.category === "Redes Sociais" && <Smartphone className="h-3.5 w-3.5" />}
                  {category.category === "Profissional" && <Briefcase className="h-3.5 w-3.5" />}
                  {category.category === "Repurpose" && <RefreshCw className="h-3.5 w-3.5" />}
                  {category.category}
                </div>
                {category.templates.map((template) => (
                  <DropdownMenuItem 
                    key={template.id}
                    onClick={() => onLoadTemplate?.(template.id)}
                    className="flex items-start gap-3 py-2 cursor-pointer"
                  >
                    <span className="text-lg">{template.icon}</span>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{template.label}</span>
                      <span className="text-xs text-muted-foreground">{template.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 mx-1" />

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
              onClick={() => onAddNode("image-source")}
              className="h-8 gap-1.5 text-xs hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-950"
            >
              <div className="h-4 w-4 rounded bg-cyan-500 flex items-center justify-center">
                <ImageIcon className="h-2.5 w-2.5 text-white" />
              </div>
              Imagem
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Adicionar imagens de referência (análise automática)</p>
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

        {/* Save/Load */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSave} 
              className="h-8 gap-1.5 text-xs"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Salvar canvas</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                  <FolderOpen className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Carregar canvas salvo</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" className="w-64">
            {isLoadingCanvases ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : savedCanvases.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhum canvas salvo
              </div>
            ) : (
              savedCanvases.map((canvas) => (
                <DropdownMenuItem 
                  key={canvas.id}
                  onClick={() => onLoad?.(canvas.id)}
                  className="flex items-center justify-between group"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{canvas.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(canvas.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDeleteCanvas(e, canvas.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
            {savedCanvases.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onClear}
                  className="text-muted-foreground"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Novo canvas
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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