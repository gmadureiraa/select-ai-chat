import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/Header";
import { ArrowLeft, Sparkles, Loader2, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { useImageGenerations } from "@/hooks/useImageGenerations";
import { ScrollArea } from "@/components/ui/scroll-area";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const ImageGeneration = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { templates } = useClientTemplates(clientId!);
  const selectedTemplate = templates.find(t => t.id === templateId && t.type === 'image');
  const { generations, createGeneration, deleteGeneration } = useImageGenerations(clientId!, templateId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [generations]);

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Digite um prompt",
        description: "Descreva a imagem que você quer gerar.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      // Build enhanced prompt with template rules
      let enhancedPrompt = prompt;
      const textRules: string[] = [];
      const imageReferences: string[] = [];
      
      if (selectedTemplate && selectedTemplate.rules.length > 0) {
        selectedTemplate.rules.forEach(rule => {
          if (rule.type === 'text' || !rule.type) {
            textRules.push(rule.content);
          } else if (rule.type === 'image_reference' && rule.file_url) {
            imageReferences.push(rule.file_url);
          }
        });
        
        if (textRules.length > 0) {
          enhancedPrompt = `${prompt}\n\nDiretrizes de estilo: ${textRules.join(". ")}`;
        }
        
        if (imageReferences.length > 0) {
          enhancedPrompt += `\n\nIMPORTANTE: Inspire-se no estilo visual, composição e elementos das seguintes imagens de referência (não copie, apenas inspire-se): ${imageReferences.join(", ")}`;
        }
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: enhancedPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.imageUrl) {
        // Save to history
        await createGeneration.mutateAsync({
          prompt,
          imageUrl: data.imageUrl,
          templateId,
        });
        
        setPrompt("");
        toast({
          title: "Imagem gerada!",
          description: "Sua imagem foi criada com sucesso.",
        });
      } else {
        throw new Error("No image returned");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Erro ao gerar imagem",
        description: "Não foi possível gerar a imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header>
        <div>
          <div className="flex items-center gap-4 mb-2">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">
                {selectedTemplate ? selectedTemplate.name : "Geração de Imagem"}
              </h1>
              {selectedTemplate && (
                <p className="text-sm text-muted-foreground mt-1">
                  Template com {selectedTemplate.rules.length} regra(s) aplicada(s)
                </p>
              )}
            </div>
          </div>
          {client && !selectedTemplate && (
            <p className="text-muted-foreground">{client.name}</p>
          )}
        </div>
        <Button
          onClick={() => navigate(`/client/${clientId}`)}
          variant="outline"
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </Header>

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        {selectedTemplate && selectedTemplate.rules.length > 0 && (
          <div className="p-4 bg-muted/50 border-b">
            <details className="cursor-pointer">
              <summary className="text-sm font-semibold">Regras do Template ({selectedTemplate.rules.length})</summary>
              <div className="mt-3 space-y-3">
                {selectedTemplate.rules.map((rule) => (
                  <div key={rule.id} className="space-y-2">
                    {rule.type === 'image_reference' && rule.file_url ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Imagem de Referência: {rule.content}
                        </p>
                        <img 
                          src={rule.file_url} 
                          alt="Referência" 
                          className="max-w-sm rounded border"
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        • {rule.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-6 max-w-3xl mx-auto">
            {generations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma imagem gerada ainda</p>
                <p className="text-sm">Digite um prompt abaixo para começar</p>
              </div>
            ) : (
              generations.map((gen) => (
                <div key={gen.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 bg-muted p-3 rounded-lg">
                      <p className="text-sm">{gen.prompt}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 justify-end">
                    <div className="max-w-2xl space-y-2">
                      <img
                        src={gen.image_url}
                        alt="Generated"
                        className="w-full rounded-lg border"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = gen.image_url;
                            link.download = `image-${gen.id}.png`;
                            link.click();
                          }}
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                        <Button
                          onClick={() => deleteGeneration.mutate(gen.id)}
                          variant="ghost"
                          size="sm"
                          className="gap-2 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isGenerating && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 bg-background">
          <div className="max-w-3xl mx-auto space-y-3">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva a imagem que você quer criar..."
              className="min-h-[100px] resize-none"
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isGenerating && prompt.trim()) {
                    handleGenerate();
                  }
                }
              }}
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Gerando imagem...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Gerar Imagem
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGeneration;
