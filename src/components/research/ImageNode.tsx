import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Trash2, Sparkles, Upload, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useResearchItems } from "@/hooks/useResearchItems";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImageNodeData {
  item: {
    id: string;
    title?: string;
    source_url?: string;
    content?: string;
    metadata?: {
      description?: string;
      transcribed?: boolean;
    };
  };
  onDelete?: (id: string) => void;
  projectId?: string;
  isConnected?: boolean;
}

const ImageNode = ({ data }: NodeProps<ImageNodeData>) => {
  const { updateItem } = useResearchItems(data.projectId);
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    if (data.item.source_url && !data.item.metadata?.transcribed && !data.item.content) {
      handleTranscribeImage();
    }
  }, [data.item.source_url]);

  const handleTranscribeImage = async () => {
    if (!data.item.source_url) return;

    setIsTranscribing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("transcribe-images", {
        body: { imageUrls: [data.item.source_url] },
      });

      if (error) throw error;

      if (result?.transcription) {
        await updateItem.mutateAsync({
          id: data.item.id,
          content: result.transcription,
          metadata: {
            ...data.item.metadata,
            transcribed: true,
            transcribedAt: new Date().toISOString(),
          },
        });

        toast({
          title: "Imagem transcrita",
          description: "Conteúdo textual extraído com sucesso",
        });
      }
    } catch (error: any) {
      console.error("Error transcribing image:", error);
      toast({
        title: "Erro ao transcrever",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(`research-images/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("client-files")
        .getPublicUrl(uploadData.path);

      await updateItem.mutateAsync({
        id: data.item.id,
        source_url: publicUrl,
        title: file.name,
      });

      toast({
        title: "Imagem carregada",
        description: "A transcrição será feita automaticamente",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: "Erro ao fazer upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete(data.item.id);
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt necessário",
        description: "Digite um prompt para gerar a imagem",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const imageReferences = data.item.source_url
        ? [{ url: data.item.source_url, description: data.item.metadata?.description || "Imagem de referência" }]
        : [];

      const { data: result, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt, imageReferences },
      });

      if (error) throw error;

      if (result?.imageUrl) {
        await updateItem.mutateAsync({
          id: data.item.id,
          source_url: result.imageUrl,
          metadata: {
            ...data.item.metadata,
            generatedPrompt: prompt,
            generatedAt: new Date().toISOString(),
          },
        });

        toast({
          title: "Imagem gerada",
          description: "Nova imagem criada com sucesso",
        });

        setPrompt("");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast({
        title: "Erro ao gerar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
  };

  return (
    <div 
      className={cn(
        "bg-card border-2 border-orange-700 rounded-xl shadow-md hover:shadow-lg transition-all",
        "min-w-[350px] max-w-[400px] group relative",
        data.isConnected && "ring-2 ring-orange-400/50"
      )}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-400 hover:!bg-orange-500 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-orange-400 hover:!bg-orange-500 !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-orange-400 hover:!bg-orange-500 !border-2 !border-background" id="left" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-orange-400 hover:!bg-orange-500 !border-2 !border-background" id="right" />

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive z-10"
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-900/30 rounded-lg border border-orange-700">
            <ImageIcon className="h-4 w-4 text-orange-400" />
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-900/30 text-orange-300 text-xs font-medium">
            Imagem
          </span>
        </div>
        {isTranscribing && (
          <div className="flex items-center gap-1 text-xs text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Transcrevendo...</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 space-y-3">
        {/* Upload Area */}
        {!data.item.source_url && (
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">Faça upload de uma imagem</p>
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
              className="text-sm"
            />
          </div>
        )}

        {/* Image Preview with Enhanced Thumbnail */}
        {data.item.source_url && (
          <div className="rounded-lg overflow-hidden border border-border relative group/img">
            <img
              src={data.item.source_url}
              alt={data.item.title || "Imagem"}
              className="w-full h-auto max-h-[200px] object-cover"
            />
            {/* Hover overlay with full preview hint */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-center pb-2">
              <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">
                {data.item.title || "Clique para expandir"}
              </span>
            </div>
          </div>
        )}

        {/* Transcription */}
        {data.item.content && (
          <div className="p-3 bg-muted/30 rounded-md border border-border">
            <div className="flex items-center gap-1 mb-1">
              <FileText className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium">Transcrição</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-4">
              {data.item.content}
            </p>
          </div>
        )}

        {/* Image Generation */}
        <div className="space-y-2 pt-2 border-t border-border" onKeyDown={handleKeyDown}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Gerar Nova Imagem</span>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva a imagem que deseja gerar..."
            className="min-h-[80px] text-sm no-pan no-wheel"
            disabled={isGenerating}
            onWheel={(e) => e.stopPropagation()}
          />
          <Button
            onClick={handleGenerateImage}
            disabled={isGenerating || !prompt.trim()}
            size="sm"
            className="w-full"
          >
            {isGenerating ? (
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
        </div>
      </div>
    </div>
  );
};

export default memo(ImageNode);
