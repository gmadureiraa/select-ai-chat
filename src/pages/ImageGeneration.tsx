import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientTemplates } from "@/hooks/useClientTemplates";
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
        setGeneratedImage(data.imageUrl);
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

      <div className="max-w-5xl mx-auto p-6">
        <Card className="p-6">
          <div className="space-y-6">
            {selectedTemplate && selectedTemplate.rules.length > 0 && (
              <div className="p-4 bg-muted rounded-lg border space-y-3">
                <h3 className="text-sm font-semibold">Regras do Template:</h3>
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
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Descreva a imagem que você quer criar
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Uma imagem moderna e vibrante de uma pessoa trabalhando com tecnologia, estilo minimalista, cores neon e magenta..."
                className="min-h-[120px]"
                disabled={isGenerating}
              />
            </div>

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

            {generatedImage && (
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Imagem Gerada</h3>
                <div className="relative rounded-lg overflow-hidden border">
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = generatedImage;
                      link.download = 'generated-image.png';
                      link.click();
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Download
                  </Button>
                  <Button
                    onClick={() => {
                      setGeneratedImage(null);
                      setPrompt("");
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Nova Imagem
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ImageGeneration;
