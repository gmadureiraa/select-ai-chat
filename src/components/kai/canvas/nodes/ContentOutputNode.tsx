import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileOutput, X, Copy, RefreshCw, Calendar, Check, Edit3, Save, Download, Image } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { OutputNodeData, ContentFormat, Platform } from "../hooks/useCanvasState";
import { useToast } from "@/hooks/use-toast";

interface ContentOutputNodeProps extends NodeProps<OutputNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<OutputNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onSendToPlanning?: (nodeId: string) => void;
  onRegenerate?: (nodeId: string) => void;
}

const FORMAT_LABELS: Record<ContentFormat, string> = {
  carousel: "Carrossel",
  thread: "Thread",
  reel_script: "Roteiro",
  post: "Post",
  stories: "Stories",
  newsletter: "Newsletter",
  image: "Imagem"
};

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "Twitter/X",
  youtube: "YouTube",
  tiktok: "TikTok",
  other: "Outro"
};

function ContentOutputNodeComponent({ 
  id, 
  data, 
  selected,
  onUpdateData,
  onDelete,
  onSendToPlanning,
  onRegenerate
}: ContentOutputNodeProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(data.content);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.content);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(data.content);
  };

  const handleSave = () => {
    onUpdateData?.(id, { content: editedContent, isEditing: false });
    setIsEditing(false);
    toast({
      title: "Salvo!",
      description: "Alterações salvas com sucesso",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(data.content);
  };

  return (
    <Card className={cn(
      "w-[350px] shadow-lg transition-all border-2",
      selected ? "border-primary ring-2 ring-primary/20" : "border-pink-500/50",
      data.addedToPlanning && "border-green-500/50",
      "bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/30 dark:to-background"
    )}>
      <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-6 w-6 rounded-md flex items-center justify-center",
            data.addedToPlanning ? "bg-green-500" : "bg-pink-500"
          )}>
            {data.addedToPlanning ? (
              <Check className="h-3.5 w-3.5 text-white" />
            ) : (
              <FileOutput className="h-3.5 w-3.5 text-white" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] h-5">
              {FORMAT_LABELS[data.format]}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5">
              {PLATFORM_LABELS[data.platform]}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete?.(id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="px-3 pb-3 space-y-2">
        {/* Image output */}
        {data.isImage ? (
          <div className="space-y-2">
            <div className="relative rounded-md border overflow-hidden bg-muted/30">
              {data.content ? (
                <img 
                  src={data.content} 
                  alt="Generated image" 
                  className="w-full h-auto max-h-[200px] object-contain"
                />
              ) : (
                <div className="h-[150px] flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground animate-pulse" />
                </div>
              )}
            </div>
            {data.content && (
              <div className="flex gap-1.5">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCopy}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copiar URL
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = data.content;
                    link.download = `image-${id}.png`;
                    link.click();
                  }}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onRegenerate?.(id)}
                  className="h-7 text-xs px-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ) : isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[200px] text-xs resize-none"
              rows={10}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="flex-1 gap-1">
                <Save className="h-3 w-3" />
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[180px] rounded-md border p-2 bg-muted/30">
              <div className="text-xs whitespace-pre-wrap">
                {data.content || "Aguardando geração..."}
              </div>
            </ScrollArea>

            {data.content && (
              <div className="flex gap-1.5">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleEdit}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCopy}
                  className="flex-1 h-7 text-xs gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onRegenerate?.(id)}
                  className="h-7 text-xs px-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            )}

            {data.content && !data.addedToPlanning && (
              <Button 
                onClick={() => onSendToPlanning?.(id)}
                className="w-full h-8 gap-1.5 text-xs"
              >
                <Calendar className="h-3.5 w-3.5" />
                Enviar para Planejamento
              </Button>
            )}

            {data.addedToPlanning && (
              <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3.5 w-3.5" />
                Adicionado ao planejamento
              </div>
            )}
          </>
        )}
      </CardContent>

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-white"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-white"
      />
    </Card>
  );
}

export const ContentOutputNode = memo(ContentOutputNodeComponent);
