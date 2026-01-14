import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Wand2, X, Loader2, Image, Play } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ImageEditorNodeData } from "../hooks/useCanvasState";

interface ImageEditorNodeProps extends NodeProps<ImageEditorNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<ImageEditorNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onEdit?: (nodeId: string) => void;
}

const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 (Quadrado)" },
  { value: "4:5", label: "4:5 (Vertical)" },
  { value: "9:16", label: "9:16 (Stories)" },
  { value: "16:9", label: "16:9 (Paisagem)" },
];

function ImageEditorNodeComponent({ 
  id, 
  data, 
  selected,
  onUpdateData,
  onDelete,
  onEdit
}: ImageEditorNodeProps) {
  return (
    <Card className={cn(
      "w-[280px] shadow-lg transition-all border-2",
      selected ? "border-primary ring-2 ring-primary/20" : "border-orange-500/50",
      data.isProcessing && "animate-pulse",
      "bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-background"
    )}>
      <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-orange-500 flex items-center justify-center">
            <Wand2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-medium text-sm">Editor de Imagem</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete?.(id)}
          disabled={data.isProcessing}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="px-3 pb-3 space-y-3">
        {/* Base image preview */}
        {data.baseImageUrl ? (
          <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
            <img 
              src={data.baseImageUrl} 
              alt="Base" 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-1">
              <span className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                Imagem base
              </span>
            </div>
          </div>
        ) : (
          <div className="aspect-video rounded-md bg-muted/50 border-2 border-dashed flex items-center justify-center">
            <div className="text-center">
              <Image className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
              <p className="text-[10px] text-muted-foreground">
                Conecte uma fonte com imagem
              </p>
            </div>
          </div>
        )}

        {/* Edit instruction */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Instrução de Edição
          </label>
          <Textarea
            placeholder="Ex: Mude o fundo para azul, adicione um efeito de brilho..."
            value={data.editInstruction}
            onChange={(e) => onUpdateData?.(id, { editInstruction: e.target.value })}
            className="min-h-[60px] text-xs resize-none"
            disabled={data.isProcessing}
          />
        </div>

        {/* Aspect ratio */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Proporção
          </label>
          <Select
            value={data.aspectRatio || "1:1"}
            onValueChange={(value) => onUpdateData?.(id, { aspectRatio: value })}
            disabled={data.isProcessing}
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

        {/* Progress */}
        {data.isProcessing && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {data.currentStep || "Editando..."}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {data.progress || 0}%
              </span>
            </div>
            <Progress value={data.progress || 0} className="h-1.5" />
          </div>
        )}

        {/* Edit button */}
        <Button
          onClick={() => onEdit?.(id)}
          disabled={data.isProcessing || !data.baseImageUrl || !data.editInstruction.trim()}
          className="w-full h-9 gap-2"
          variant={data.isProcessing ? "secondary" : "default"}
        >
          {data.isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Editando...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Aplicar Edição
            </>
          )}
        </Button>
      </CardContent>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
    </Card>
  );
}

export const ImageEditorNode = memo(ImageEditorNodeComponent);
