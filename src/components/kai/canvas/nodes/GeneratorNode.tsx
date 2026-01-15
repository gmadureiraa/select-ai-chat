import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Sparkles, X, Loader2, Play, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GeneratorNodeData, ContentFormat } from "../hooks/useCanvasState";
import { contentFormats } from "@/components/chat/FormatItem";

interface GeneratorNodeProps extends NodeProps<GeneratorNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<GeneratorNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onGenerate?: (nodeId: string) => void;
  onGenerateMore?: (nodeId: string) => void;
}

// Use contentFormats from the central definition, excluding special actions
const FORMAT_OPTIONS = contentFormats
  .filter(f => !["format_ideias", "format_gerar_imagem"].includes(f.id))
  .map(f => ({
    value: f.category as ContentFormat,
    label: f.name,
    description: f.description,
  }));

// Add image option
FORMAT_OPTIONS.push({
  value: "image" as ContentFormat,
  label: "Imagem",
  description: "Gerar imagem com IA",
});

const IMAGE_STYLE_OPTIONS = [
  { value: "photographic", label: "Fotográfico" },
  { value: "illustration", label: "Ilustração" },
  { value: "3d", label: "3D Render" },
  { value: "minimalist", label: "Minimalista" },
  { value: "artistic", label: "Artístico" },
];

const IMAGE_TYPE_OPTIONS = [
  { value: "general", label: "Imagem Geral" },
  { value: "thumbnail", label: "Thumbnail YouTube" },
  { value: "social_post", label: "Post Social" },
  { value: "banner", label: "Banner/Header" },
  { value: "product", label: "Foto de Produto" },
];

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 (Quadrado)" },
  { value: "4:5", label: "4:5 (Vertical)" },
  { value: "9:16", label: "9:16 (Stories)" },
  { value: "16:9", label: "16:9 (Paisagem)" },
];

function GeneratorNodeComponent({ 
  id, 
  data, 
  selected,
  onUpdateData,
  onDelete,
  onGenerate,
  onGenerateMore
}: GeneratorNodeProps) {
  const [nodeSize, setNodeSize] = useState<"normal" | "expanded">("normal");
  
  const handleFormatChange = (format: ContentFormat) => {
    onUpdateData?.(id, { format });
  };

  const selectedFormat = FORMAT_OPTIONS.find(f => f.value === data.format);

  return (
    <Card className={cn(
      "shadow-lg transition-all border-2",
      nodeSize === "normal" ? "w-[280px]" : "w-[380px]",
      selected ? "border-primary ring-2 ring-primary/20" : "border-green-500/50",
      data.isGenerating && "animate-pulse",
      "bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-background"
    )}>
      <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-green-500 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-medium text-sm">Gerador</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete?.(id)}
          disabled={data.isGenerating}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="px-3 pb-3 space-y-3">
        {/* Format Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Formato
          </label>
          <Select
            value={data.format}
            onValueChange={handleFormatChange}
            disabled={data.isGenerating}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>
                <span>{selectedFormat?.label || "Selecione"}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {nodeSize === "expanded" && (
                      <span className="text-[10px] text-muted-foreground">{option.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Image-specific options */}
        {data.format === "image" && (
          <>
            {/* Image Type (Thumbnail, Social, etc) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Tipo de Imagem
              </label>
              <Select
                value={(data as any).imageType || "general"}
                onValueChange={(value) => {
                  const updates: any = { imageType: value };
                  // Auto-set aspect ratio for thumbnails
                  if (value === "thumbnail") {
                    updates.aspectRatio = "16:9";
                  }
                  onUpdateData?.(id, updates);
                }}
                disabled={data.isGenerating}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Estilo Visual
                </label>
                <Select
                  value={data.imageStyle || "photographic"}
                  onValueChange={(value) => onUpdateData?.(id, { imageStyle: value })}
                  disabled={data.isGenerating}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_STYLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Proporção
                </label>
                <Select
                  value={data.aspectRatio || "1:1"}
                  onValueChange={(value) => onUpdateData?.(id, { aspectRatio: value })}
                  disabled={data.isGenerating}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`no-text-${id}`}
                  checked={data.noTextInImage || false}
                  onCheckedChange={(checked) => onUpdateData?.(id, { noTextInImage: !!checked })}
                  disabled={data.isGenerating}
                />
                <Label htmlFor={`no-text-${id}`} className="text-[10px] text-muted-foreground cursor-pointer">
                  Sem texto na imagem
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`preserve-person-${id}`}
                  checked={(data as any).preservePerson || false}
                  onCheckedChange={(checked) => onUpdateData?.(id, { preservePerson: !!checked } as any)}
                  disabled={data.isGenerating}
                />
                <Label htmlFor={`preserve-person-${id}`} className="text-[10px] text-muted-foreground cursor-pointer">
                  Manter aparência da pessoa
                </Label>
              </div>
            </div>
          </>
        )}

        {/* Progress */}
        {data.isGenerating && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {data.currentStep || "Processando..."}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {data.generatedCount && data.quantity && data.quantity > 1 
                  ? `${data.generatedCount}/${data.quantity}` 
                  : `${data.progress || 0}%`}
              </span>
            </div>
            <Progress value={data.progress || 0} className="h-1.5" />
          </div>
        )}

        {/* Generate buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => onGenerate?.(id)}
            disabled={data.isGenerating}
            className="flex-1 h-9 gap-2"
            variant={data.isGenerating ? "secondary" : "default"}
          >
            {data.isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Gerar
              </>
            )}
          </Button>
          
          {/* Generate More button */}
          <Button
            onClick={() => onGenerateMore?.(id)}
            disabled={data.isGenerating}
            variant="outline"
            size="icon"
            className="h-9 w-9"
            title="Gerar mais um conteúdo"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-1"
        style={{ top: "30%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-2"
        style={{ top: "50%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-3"
        style={{ top: "70%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
    </Card>
  );
}

export const GeneratorNode = memo(GeneratorNodeComponent);
