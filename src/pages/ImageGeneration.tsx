import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/Header";
import { ArrowLeft, Sparkles, Loader2, Download, Trash2, Copy, ZoomIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTemplateReferences } from "@/hooks/useTemplateReferences";
import { useImageGenerations } from "@/hooks/useImageGenerations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ReferencePreviewDialog } from "@/components/images/ReferencePreviewDialog";
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
  const [previewImage, setPreviewImage] = useState<{ url: string; description: string } | null>(null);

  const { template, references, isLoading: isLoadingReferences } = useTemplateReferences(templateId);
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
      // Build enhanced prompt with ALL template rules and references
      let enhancedPrompt = prompt;
      
      if (template && !isLoadingReferences) {
        const promptParts: string[] = [prompt];
        
        // Add text rules as style guidelines
        if (references.textRules.length > 0) {
          promptParts.push('\n\nESTILO E DIRETRIZES:');
          references.textRules.forEach(rule => {
            promptParts.push(`- ${rule}`);
          });
        }
        
        // Add visual descriptions from image references
        if (references.imageReferences.length > 0) {
          promptParts.push('\n\nREFERÊNCIAS VISUAIS (inspire-se nestes elementos):');
          references.imageReferences.forEach((ref, idx) => {
            promptParts.push(`${idx + 1}. ${ref.description}`);
            promptParts.push(`   URL: ${ref.url}`);
          });
          promptParts.push('\nIMPORTANTE: Inspire-se no estilo visual, composição e elementos dessas referências, mas crie algo original.');
        }
        
        enhancedPrompt = promptParts.join('\n');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          prompt: enhancedPrompt,
          imageReferences: references.imageReferences
        }),
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

  const handleGenerateVariation = async (originalPrompt: string) => {
    setPrompt(originalPrompt);
    setIsGenerating(true);

    try {
      let enhancedPrompt = `${originalPrompt}\n\nIMPORTANTE: Crie uma VARIAÇÃO desta imagem, mantendo o estilo geral mas com elementos e composição diferentes.`;
      
      if (template && !isLoadingReferences) {
        const promptParts: string[] = [enhancedPrompt];
        
        if (references.textRules.length > 0) {
          promptParts.push('\n\nESTILO E DIRETRIZES:');
          references.textRules.forEach(rule => {
            promptParts.push(`- ${rule}`);
          });
        }
        
        if (references.imageReferences.length > 0) {
          promptParts.push('\n\nREFERÊNCIAS VISUAIS (inspire-se nestes elementos):');
          references.imageReferences.forEach((ref, idx) => {
            promptParts.push(`${idx + 1}. ${ref.description}`);
            promptParts.push(`   URL: ${ref.url}`);
          });
        }
        
        enhancedPrompt = promptParts.join('\n');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          prompt: enhancedPrompt,
          imageReferences: references.imageReferences
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.imageUrl) {
        await createGeneration.mutateAsync({
          prompt: `[VARIAÇÃO] ${originalPrompt}`,
          imageUrl: data.imageUrl,
          templateId,
        });
        
        setPrompt("");
        toast({
          title: "Variação gerada!",
          description: "Uma nova versão da imagem foi criada.",
        });
      } else {
        throw new Error("No image returned");
      }
    } catch (error) {
      console.error("Error generating variation:", error);
      toast({
        title: "Erro ao gerar variação",
        description: "Não foi possível gerar a variação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ReferencePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
        imageUrl={previewImage?.url || ""}
        description={previewImage?.description || ""}
      />
      
      <Header>
        <div>
          <div className="flex items-center gap-4 mb-2">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">
                {template ? template.name : "Geração de Imagem"}
              </h1>
              {template && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">
                    Template ativo
                  </p>
                  {references.textRules.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {references.textRules.length} {references.textRules.length === 1 ? 'regra' : 'regras'}
                    </Badge>
                  )}
                  {references.imageReferences.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {references.imageReferences.length} {references.imageReferences.length === 1 ? 'referência visual' : 'referências visuais'}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          {client && !template && (
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
        {template && (references.textRules.length > 0 || references.imageReferences.length > 0) && !isLoadingReferences && (
          <div className="p-4 bg-muted/50 border-b">
            <details className="cursor-pointer" open>
              <summary className="text-sm font-semibold hover:text-primary transition-colors">
                Regras do Template ({references.textRules.length + references.imageReferences.length})
              </summary>
              <div className="mt-4 space-y-6">
                {references.textRules.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                      Diretrizes de Estilo:
                    </p>
                    <ul className="space-y-2">
                      {references.textRules.map((rule, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground pl-4 border-l-2 border-primary/20">
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {references.imageReferences.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                      Referências Visuais:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {references.imageReferences.map((ref, idx) => (
                        <div key={idx} className="group relative">
                          <div className="aspect-video rounded-lg overflow-hidden border border-border hover:border-primary transition-colors">
                            <img 
                              src={ref.url} 
                              alt={ref.description} 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                onClick={() => setPreviewImage({ url: ref.url, description: ref.description })}
                                variant="secondary"
                                size="sm"
                                className="gap-2"
                              >
                                <ZoomIn className="h-4 w-4" />
                                Expandir
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {ref.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                      <div className="flex gap-2 justify-end flex-wrap">
                        <Button
                          onClick={() => handleGenerateVariation(gen.prompt)}
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          disabled={isGenerating}
                        >
                          <Copy className="h-4 w-4" />
                          Gerar Variação
                        </Button>
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
