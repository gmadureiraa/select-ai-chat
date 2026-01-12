import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Sparkles, X, Loader2, Play } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { GeneratorNodeData, ContentFormat, Platform } from "../hooks/useCanvasState";

interface GeneratorNodeProps extends NodeProps<GeneratorNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<GeneratorNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onGenerate?: (nodeId: string) => void;
}

const FORMAT_OPTIONS: { value: ContentFormat; label: string; icon: string }[] = [
  { value: "carousel", label: "Carrossel", icon: "🎠" },
  { value: "thread", label: "Thread", icon: "🧵" },
  { value: "reel_script", label: "Roteiro Reel", icon: "🎬" },
  { value: "post", label: "Post", icon: "📝" },
  { value: "stories", label: "Stories", icon: "📱" },
  { value: "newsletter", label: "Newsletter", icon: "📧" },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter/X" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
];

function GeneratorNodeComponent({ 
  id, 
  data, 
  selected,
  onUpdateData,
  onDelete,
  onGenerate
}: GeneratorNodeProps) {
  const handleFormatChange = (format: ContentFormat) => {
    onUpdateData?.(id, { format });
  };

  const handlePlatformChange = (platform: Platform) => {
    onUpdateData?.(id, { platform });
  };

  const selectedFormat = FORMAT_OPTIONS.find(f => f.value === data.format);

  return (
    <Card className={cn(
      "w-[280px] shadow-lg transition-all border-2",
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
        {/* Format */}
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
                <span className="flex items-center gap-2">
                  <span>{selectedFormat?.icon}</span>
                  <span>{selectedFormat?.label}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Platform */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Plataforma
          </label>
          <Select
            value={data.platform}
            onValueChange={handlePlatformChange}
            disabled={data.isGenerating}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress */}
        {data.isGenerating && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {data.currentStep || "Processando..."}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {data.progress || 0}%
              </span>
            </div>
            <Progress value={data.progress || 0} className="h-1.5" />
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={() => onGenerate?.(id)}
          disabled={data.isGenerating}
          className="w-full h-9 gap-2"
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
