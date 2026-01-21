import { useEffect, useState, memo } from "react";
import { 
  Paperclip, 
  Sparkles, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Save, 
  FolderOpen, 
  Loader2, 
  X, 
  Pencil, 
  LayoutTemplate, 
  Smartphone, 
  Briefcase, 
  RefreshCw, 
  Library, 
  Check, 
  Cloud, 
  AlertCircle,
  MousePointer2,
  Type,
  StickyNote,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Eraser,
  Image,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { SavedCanvas } from "./hooks/useCanvasState";
import { cn } from "@/lib/utils";

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

export type ToolType = 
  | "cursor" 
  | "text" 
  | "sticky" 
  | "shape" 
  | "pencil" 
  | "image" 
  | "eraser";

export type ShapeType = "rectangle" | "circle" | "diamond" | "arrow";

interface CanvasToolbarProps {
  onAddNode: (type: "attachment" | "generator") => void;
  onClear: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onLoadTemplate?: (templateId: CanvasTemplate) => void;
  onOpenLibrary?: () => void;
  // Canvas persistence
  currentCanvasName?: string;
  setCanvasName?: (name: string) => void;
  onSave?: (name?: string) => Promise<any>;
  onLoad?: (canvasId: string) => void;
  onDelete?: (canvasId: string) => Promise<void>;
  savedCanvases?: SavedCanvas[];
  isLoadingCanvases?: boolean;
  isSaving?: boolean;
  autoSaveStatus?: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
  // Whiteboard tools
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
  onClearDrawings: () => void;
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
      { id: "image_series", icon: "🖼️", label: "Série de Imagens", description: "Gere imagem com IA" },
    ]
  },
];

const BRUSH_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#000000", "#6b7280", "#ffffff",
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

function CanvasToolbarComponent({
  onAddNode,
  onClear,
  onZoomIn,
  onZoomOut,
  onFitView,
  onLoadTemplate,
  onOpenLibrary,
  currentCanvasName = "Novo Canvas",
  setCanvasName,
  onSave,
  onLoad,
  onDelete,
  savedCanvases = [],
  isLoadingCanvases = false,
  isSaving = false,
  autoSaveStatus = 'idle',
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
  onClearDrawings,
}: CanvasToolbarProps) {
  const [canvasName, setLocalCanvasName] = useState(currentCanvasName);
  const [isEditing, setIsEditing] = useState(false);

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

  const renderAutoSaveIndicator = () => {
    switch (autoSaveStatus) {
      case 'pending':
        return (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="hidden sm:inline">Alterações</span>
          </div>
        );
      case 'saving':
        return (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="hidden sm:inline">Salvando</span>
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center gap-1 text-[10px] text-green-600">
            <Check className="h-3 w-3" />
            <span className="hidden sm:inline">Salvo</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Erro</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <Cloud className="h-3 w-3" />
          </div>
        );
    }
  };

  const tools = [
    { type: "cursor" as ToolType, icon: MousePointer2, label: "Selecionar", shortcut: "V" },
    { type: "text" as ToolType, icon: Type, label: "Texto", shortcut: "T" },
    { type: "sticky" as ToolType, icon: StickyNote, label: "Nota", shortcut: "S" },
    { type: "shape" as ToolType, icon: Square, label: "Forma", shortcut: "R" },
    { type: "pencil" as ToolType, icon: Pencil, label: "Lápis", shortcut: "P" },
    { type: "eraser" as ToolType, icon: Eraser, label: "Borracha", shortcut: "E" },
  ];

  const shapes = [
    { type: "rectangle" as ShapeType, icon: Square, label: "Retângulo" },
    { type: "circle" as ShapeType, icon: Circle, label: "Círculo" },
    { type: "diamond" as ShapeType, icon: Diamond, label: "Losango" },
    { type: "arrow" as ShapeType, icon: ArrowRight, label: "Seta" },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 px-2 py-1.5 rounded-lg bg-background/95 backdrop-blur border shadow-lg">
        {/* Canvas name */}
        <div className="flex items-center gap-1 mr-1">
          {isEditing ? (
            <Input
              value={canvasName}
              onChange={(e) => setLocalCanvasName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="h-7 w-[100px] text-xs"
              autoFocus
            />
          ) : (
            <span 
              className="text-xs font-medium cursor-pointer hover:text-primary px-1.5 max-w-[100px] truncate"
              onClick={() => setIsEditing(true)}
              title={canvasName}
            >
              {canvasName}
            </span>
          )}
          {renderAutoSaveIndicator()}
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Whiteboard Tools */}
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.type;
            
            // Special handling for shape tool
            if (tool.type === "shape") {
              return (
                <Popover key={tool.type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          size="icon"
                          className={cn("h-8 w-8", isActive && "bg-primary text-primary-foreground")}
                          onClick={() => onToolChange(tool.type)}
                        >
                          <Icon size={16} />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="flex items-center gap-2">
                      {tool.label}
                      <kbd className="text-[10px] bg-muted px-1 rounded">{tool.shortcut}</kbd>
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent side="bottom" className="w-auto p-2">
                    <div className="flex gap-1">
                      {shapes.map((shape) => {
                        const ShapeIcon = shape.icon;
                        return (
                          <Button
                            key={shape.type}
                            variant={selectedShape === shape.type ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              onShapeChange(shape.type);
                              onToolChange("shape");
                            }}
                          >
                            <ShapeIcon size={16} />
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            // Special handling for sticky tool
            if (tool.type === "sticky") {
              return (
                <Popover key={tool.type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          size="icon"
                          className={cn("h-8 w-8", isActive && "bg-primary text-primary-foreground")}
                          onClick={() => onToolChange(tool.type)}
                        >
                          <Icon size={16} />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="flex items-center gap-2">
                      {tool.label}
                      <kbd className="text-[10px] bg-muted px-1 rounded">{tool.shortcut}</kbd>
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent side="bottom" className="w-auto p-2">
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
                          onClick={() => {
                            onStickyColorChange(color.value);
                            onToolChange("sticky");
                          }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            // Special handling for pencil/eraser
            if (tool.type === "pencil" || tool.type === "eraser") {
              return (
                <Popover key={tool.type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          size="icon"
                          className={cn("h-8 w-8", isActive && "bg-primary text-primary-foreground")}
                          onClick={() => onToolChange(tool.type)}
                        >
                          <Icon size={16} />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="flex items-center gap-2">
                      {tool.label}
                      <kbd className="text-[10px] bg-muted px-1 rounded">{tool.shortcut}</kbd>
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent side="bottom" className="w-auto p-3">
                    <div className="space-y-3">
                      {tool.type === "pencil" && (
                        <>
                          <div className="text-xs font-medium text-muted-foreground">Cor</div>
                          <div className="flex flex-wrap gap-1.5 max-w-[140px]">
                            {BRUSH_COLORS.map((color) => (
                              <button
                                key={color}
                                className={cn(
                                  "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-destructive hover:text-destructive"
                        onClick={onClearDrawings}
                      >
                        <Minus size={14} className="mr-1" />
                        Limpar desenhos
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <Tooltip key={tool.type}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="icon"
                    className={cn("h-8 w-8", isActive && "bg-primary text-primary-foreground")}
                    onClick={() => onToolChange(tool.type)}
                  >
                    <Icon size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2">
                  {tool.label}
                  <kbd className="text-[10px] bg-muted px-1 rounded">{tool.shortcut}</kbd>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Simplified AI Nodes - Only Attachment and Generator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddNode("attachment")}
              className="h-8 gap-1.5 text-xs hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-cyan-950"
            >
              <div className="h-5 w-5 rounded bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Paperclip className="h-3 w-3 text-white" />
              </div>
              <span className="hidden md:inline font-medium">Anexo</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Adicionar anexo (imagem, vídeo, áudio, texto, URL)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddNode("generator")}
              className="h-8 gap-1.5 text-xs hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950"
            >
              <div className="h-5 w-5 rounded bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
              <span className="hidden md:inline font-medium">Gerador</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Gerar texto ou imagem com IA</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Library, Templates, Save/Load */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenLibrary}
              className="h-8 w-8 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950"
            >
              <Library size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Biblioteca</TooltipContent>
        </Tooltip>

        {/* Templates dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <LayoutTemplate size={16} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Templates</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" className="w-72 max-h-[400px] overflow-y-auto">
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

        {/* Save */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSave} 
              className="h-8 w-8"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Salvar (Ctrl+S)</TooltipContent>
        </Tooltip>

        {/* Load dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <FolderOpen size={16} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Carregar canvas</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" className="w-56">
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
                    <span className="font-medium text-sm">{canvas.name}</span>
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
                <DropdownMenuItem onClick={onClear} className="text-muted-foreground">
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
              <ZoomOut size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Diminuir zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8">
              <ZoomIn size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Aumentar zoom</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onFitView} className="h-8 w-8">
              <Maximize size={16} />
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
              <Trash2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Limpar canvas</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export const CanvasToolbar = memo(CanvasToolbarComponent);
