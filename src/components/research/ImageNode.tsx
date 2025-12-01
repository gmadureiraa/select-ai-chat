import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Sparkles } from "lucide-react";
import { useResearchItems } from "@/hooks/useResearchItems";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ImageNodeData {
  item: {
    id: string;
    title?: string;
    source_url?: string;
    metadata?: {
      description?: string;
    };
  };
}

const ImageNode = ({ data, id }: NodeProps<ImageNodeData>) => {
  const { deleteItem, updateItem } = useResearchItems();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteItem.mutateAsync(data.item.id);
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
      // Incluir a imagem atual como referência se existir
      const imageReferences = data.item.source_url
        ? [
            {
              url: data.item.source_url,
              description: data.item.metadata?.description || "Imagem de referência",
            },
          ]
        : [];

      const { data: result, error } = await supabase.functions.invoke(
        "generate-image",
        {
          body: {
            prompt,
            imageReferences,
          },
        }
      );

      if (error) throw error;

      if (result?.imageUrl) {
        // Criar novo item com a imagem gerada
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

  return (
    <Card className="w-[400px] border-border/40 bg-card/95 shadow-lg backdrop-blur-sm">
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Handle type="target" position={Position.Top} className="!bg-primary" />

      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            Imagem
          </div>
        </div>

        {data.item.source_url && (
          <div className="rounded-lg overflow-hidden border border-border/40">
            <img
              src={data.item.source_url}
              alt={data.item.title || "Imagem"}
              className="w-full h-auto"
            />
          </div>
        )}

        {data.item.metadata?.description && (
          <p className="text-xs text-muted-foreground">
            {data.item.metadata.description}
          </p>
        )}

        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Gerar Nova Imagem</span>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva a imagem que deseja gerar..."
            className="min-h-[80px] text-sm"
            disabled={isGenerating}
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
      </CardContent>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary"
      />
    </Card>
  );
};

export default memo(ImageNode);
