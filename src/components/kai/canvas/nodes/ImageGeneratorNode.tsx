import { useState, useCallback, memo } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Upload, Loader2, RefreshCw, Download, Sparkles, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface ImageGeneratorNodeData {
  type: "image-generator";
  referenceImage?: string;
  prompt: string;
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:5";
  noText: boolean;
  preserveFace: boolean;
  generatedImage?: string;
  isGenerating?: boolean;
  error?: string;
}

interface ImageGeneratorNodeProps extends NodeProps<ImageGeneratorNodeData> {
  onUpdateData: (id: string, data: Partial<ImageGeneratorNodeData>) => void;
  onDelete: (id: string) => void;
  clientId?: string;
}

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 (Quadrado)" },
  { value: "16:9", label: "16:9 (Horizontal)" },
  { value: "9:16", label: "9:16 (Vertical)" },
  { value: "4:5", label: "4:5 (Instagram)" },
];

function ImageGeneratorNodeComponent({ 
  id, 
  data, 
  onUpdateData, 
  onDelete,
  clientId 
}: ImageGeneratorNodeProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast({ title: "Apenas imagens são aceitas", variant: "destructive" });
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      onUpdateData(id, { referenceImage: base64 });
    } catch (err) {
      toast({ title: "Erro ao processar imagem", variant: "destructive" });
    }
  }, [id, onUpdateData, toast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      onUpdateData(id, { referenceImage: base64 });
    } catch (err) {
      toast({ title: "Erro ao processar imagem", variant: "destructive" });
    }
  }, [id, onUpdateData, toast]);

  const handleGenerate = useCallback(async () => {
    if (!data.prompt.trim()) {
      toast({ title: "Digite o que deseja criar", variant: "destructive" });
      return;
    }

    onUpdateData(id, { isGenerating: true, error: undefined });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data: result, error } = await supabase.functions.invoke("generate-image-simple", {
        body: {
          prompt: data.prompt,
          referenceImage: data.referenceImage,
          aspectRatio: data.aspectRatio,
          noText: data.noText,
          preserveFace: data.preserveFace,
          clientId,
        },
        headers: {
          Authorization: `Bearer ${sessionData?.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const imageUrl = result?.imageUrl || result?.image_url;
      if (!imageUrl) throw new Error("Nenhuma imagem gerada");

      onUpdateData(id, { 
        generatedImage: imageUrl, 
        isGenerating: false 
      });

      toast({ title: "Imagem gerada!" });
    } catch (err: any) {
      console.error("[ImageGeneratorNode] Error:", err);
      onUpdateData(id, { 
        isGenerating: false, 
        error: err.message || "Erro ao gerar imagem" 
      });
      toast({ 
        title: "Erro ao gerar imagem", 
        description: err.message,
        variant: "destructive" 
      });
    }
  }, [id, data, clientId, onUpdateData, toast]);

  const handleDownload = useCallback(() => {
    if (!data.generatedImage) return;
    const link = document.createElement("a");
    link.href = data.generatedImage;
    link.download = `imagem-gerada-${Date.now()}.png`;
    link.click();
  }, [data.generatedImage]);

  return (
    <Card className="w-[340px] shadow-lg border-2 border-purple-200 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-medium text-sm">Gerador de Imagem</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6" 
          onClick={() => onDelete(id)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardContent className="p-3 space-y-3">
        {/* Reference Image Drop Zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg transition-colors cursor-pointer",
            isDragging ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" : "border-muted-foreground/25",
            data.referenceImage ? "p-0" : "p-4"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !data.referenceImage && document.getElementById(`file-${id}`)?.click()}
        >
          {data.referenceImage ? (
            <div className="relative group">
              <img 
                src={data.referenceImage} 
                alt="Referência" 
                className="w-full h-32 object-cover rounded-lg"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateData(id, { referenceImage: undefined });
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Upload className="h-6 w-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">Arraste uma imagem de referência</p>
              <p className="text-[10px] opacity-60">(opcional)</p>
            </div>
          )}
          <input
            id={`file-${id}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Prompt */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">O que criar:</Label>
          <Textarea
            placeholder="Descreva a imagem que você quer..."
            value={data.prompt}
            onChange={(e) => onUpdateData(id, { prompt: e.target.value })}
            className="min-h-[80px] text-sm resize-none"
          />
        </div>

        {/* Options Row */}
        <div className="flex items-center gap-3">
          <Select 
            value={data.aspectRatio} 
            onValueChange={(v) => onUpdateData(id, { aspectRatio: v as any })}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((ar) => (
                <SelectItem key={ar.value} value={ar.value} className="text-xs">
                  {ar.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`notext-${id}`}
              checked={data.noText}
              onCheckedChange={(c) => onUpdateData(id, { noText: !!c })}
            />
            <Label htmlFor={`notext-${id}`} className="text-[11px] cursor-pointer">
              Sem texto
            </Label>
          </div>

          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`face-${id}`}
              checked={data.preserveFace}
              onCheckedChange={(c) => onUpdateData(id, { preserveFace: !!c })}
              disabled={!data.referenceImage}
            />
            <Label 
              htmlFor={`face-${id}`} 
              className={cn(
                "text-[11px] cursor-pointer",
                !data.referenceImage && "opacity-50"
              )}
            >
              Manter rosto
            </Label>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={data.isGenerating || !data.prompt.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {data.isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar Imagem
            </>
          )}
        </Button>

        {/* Error Display */}
        {data.error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive">{data.error}</p>
          </div>
        )}

        {/* Generated Image Result */}
        {data.generatedImage && (
          <div className="space-y-2">
            <div className="relative rounded-lg overflow-hidden border">
              <img 
                src={data.generatedImage} 
                alt="Imagem gerada" 
                className="w-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleGenerate}
                disabled={data.isGenerating}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Gerar de novo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleDownload}
              >
                <Download className="h-3 w-3 mr-1" />
                Baixar
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-purple-500 border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-purple-500 border-2 border-background"
      />
    </Card>
  );
}

// Utility function
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ImageGeneratorNode = memo(ImageGeneratorNodeComponent);
