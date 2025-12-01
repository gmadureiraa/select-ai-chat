import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { useActivities } from "@/hooks/useActivities";
import { ArrowLeft, Upload, Loader2, FileText, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ReverseEngineering = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clients } = useClients();
  const { logActivity } = useActivities();
  
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [referenceText, setReferenceText] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [inputType, setInputType] = useState<"images" | "text" | "instagram">("images");

  const handleExtractInstagram = async () => {
    if (!instagramUrl.trim()) {
      toast({
        title: "Link vazio",
        description: "Cole o link do Instagram",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    setExtractedImages([]);

    try {
      const { data, error } = await supabase.functions.invoke('extract-instagram', {
        body: { url: instagramUrl }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setExtractedImages(data.images);
      toast({
        title: "Imagens extraídas",
        description: `${data.imageCount} ${data.imageCount === 1 ? 'imagem extraída' : 'imagens extraídas'}`,
      });

    } catch (error) {
      console.error('Error extracting Instagram images:', error);
      toast({
        title: "Erro",
        description: "Erro ao extrair imagens do Instagram",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedClient) {
      toast({
        title: "Cliente não selecionado",
        description: "Selecione um cliente antes de analisar",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0 && !referenceText && extractedImages.length === 0) {
      toast({
        title: "Referência vazia",
        description: "Adicione imagens, texto de referência ou extraia de um post do Instagram",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setGeneratedContent("");

    try {
      const { data, error } = await supabase.functions.invoke("reverse-engineer", {
        body: {
          clientId: selectedClient,
          referenceImages: inputType === "images" ? referenceImages : inputType === "instagram" ? extractedImages : undefined,
          referenceText: inputType === "text" ? referenceText : undefined,
          phase: "analyze",
        },
      });

      if (error) throw error;

      setAnalysis(data);
      
      // Log activity
      const clientName = clients.find(c => c.id === selectedClient)?.name;
      logActivity.mutate({
        activityType: "reverse_engineering_analysis",
        entityType: "reverse_engineering",
        entityName: clientName,
        description: `Análise de engenharia reversa para ${clientName}`,
        metadata: { 
          inputType,
          hasImages: referenceImages.length > 0,
          hasText: referenceText.length > 0,
          contentType: data.contentType
        },
      });
      
      toast({
        title: "Análise concluída",
        description: "Conteúdo analisado com sucesso",
      });
    } catch (error: any) {
      console.error("Erro ao analisar:", error);
      toast({
        title: "Erro na análise",
        description: error.message || "Não foi possível analisar o conteúdo",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!analysis) return;

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("reverse-engineer", {
        body: {
          clientId: selectedClient,
          analysis: analysis,
          phase: "generate",
        },
      });

      if (error) throw error;

      setGeneratedContent(data.content);
      
      // Log activity
      const clientName = clients.find(c => c.id === selectedClient)?.name;
      logActivity.mutate({
        activityType: "reverse_engineering_generation",
        entityType: "reverse_engineering",
        entityName: clientName,
        description: `Conteúdo gerado via engenharia reversa para ${clientName}`,
        metadata: { 
          contentLength: data.content.length,
          contentType: analysis.contentType
        },
      });
      
      toast({
        title: "Conteúdo gerado",
        description: "Conteúdo adaptado ao estilo do cliente",
      });
    } catch (error: any) {
      console.error("Erro ao gerar:", error);
      toast({
        title: "Erro na geração",
        description: error.message || "Não foi possível gerar o conteúdo",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/agents")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Engenharia Reversa
          </h1>
          <p className="text-sm text-muted-foreground">
            Analise conteúdo de referência e recrie no estilo do seu cliente
          </p>
        </div>
      </header>

      <div className="grid gap-4">
        {/* Seleção de Cliente */}
        <Card className="border-border/50 bg-card/50 p-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Input de Referência */}
        <Card className="border-border/50 bg-card/50 p-6">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Conteúdo de Referência</Label>
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as "images" | "text" | "instagram")}>
              <TabsList className="grid w-full grid-cols-3 bg-background">
                <TabsTrigger value="images">
                  Imagens
                </TabsTrigger>
                <TabsTrigger value="text">
                  Texto
                </TabsTrigger>
                <TabsTrigger value="instagram">
                  Link Instagram
                </TabsTrigger>
              </TabsList>
              <TabsContent value="images" className="space-y-3 mt-4">
                <div className="border border-dashed border-border/50 rounded-lg p-8 hover:border-border transition-colors">
                  <input
                    type="file"
                    id="image-upload"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      
                      const urls: string[] = [];
                      for (const file of files) {
                        const reader = new FileReader();
                        const base64 = await new Promise<string>((resolve) => {
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });
                        urls.push(base64);
                      }
                      setReferenceImages((prev) => [...prev, ...urls]);
                      toast({
                        title: "Imagens adicionadas",
                        description: `${files.length} imagem(ns) carregada(s)`,
                      });
                    }}
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center gap-3 cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">
                      Clique para fazer upload de screenshots
                    </span>
                  </label>
                </div>
                {referenceImages.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">{referenceImages.length} imagem(ns) carregada(s)</p>
                    <div className="flex gap-2 flex-wrap">
                      {referenceImages.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 rounded border border-border/50 overflow-hidden">
                          <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-1 -right-1 bg-background border border-border rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-muted"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Faça upload de screenshots de cada slide do carrossel, frames do Reels ou páginas do conteúdo
                </p>
              </TabsContent>
              <TabsContent value="text" className="space-y-2 mt-4">
                <Textarea
                  placeholder="Cole aqui o texto do conteúdo que deseja analisar..."
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Cole o texto completo do conteúdo de referência
                </p>
              </TabsContent>
              <TabsContent value="instagram" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://instagram.com/p/..."
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleExtractInstagram} 
                      disabled={isExtracting || !instagramUrl.trim()}
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Extraindo...
                        </>
                      ) : (
                        'Extrair'
                      )}
                    </Button>
                  </div>

                  {extractedImages.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {extractedImages.length} {extractedImages.length === 1 ? 'imagem extraída' : 'imagens extraídas'}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {extractedImages.map((url, i) => (
                          <div key={i} className="relative w-20 h-20 rounded border border-border/50 overflow-hidden">
                            <img src={url} alt={`Instagram ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => setExtractedImages((prev) => prev.filter((_, idx) => idx !== i))}
                              className="absolute -top-1 -right-1 bg-background border border-border rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-muted"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Cole o link de um post ou carrossel do Instagram para extrair todas as imagens automaticamente
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedClient}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              "Analisar Conteúdo"
            )}
          </Button>
        </Card>

        {/* Análise */}
        {analysis && (
          <Card className="border-border/50 bg-card/50 p-6 space-y-4">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Análise do Conteúdo</Label>
              <div className="bg-background border border-border/50 p-4 rounded-lg space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="font-medium min-w-[100px]">Tipo:</span>
                  <span className="text-muted-foreground">{analysis.contentType}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium min-w-[100px]">Estrutura:</span>
                  <span className="text-muted-foreground">{analysis.structure}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium min-w-[100px]">Tom:</span>
                  <span className="text-muted-foreground">{analysis.tone}</span>
                </div>
                <div>
                  <span className="font-medium">Principais elementos:</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-2 ml-2 space-y-1">
                    {analysis.keyElements?.map((element: string, i: number) => (
                      <li key={i}>{element}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-medium">Estratégia:</span>
                  <p className="text-muted-foreground mt-2">{analysis.strategy}</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Conteúdo Adaptado"
              )}
            </Button>
          </Card>
        )}

        {/* Conteúdo Gerado */}
        {generatedContent && (
          <Card className="border-border/50 bg-card/50 p-6 space-y-4">
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                Conteúdo Gerado
              </Label>
              <div className="bg-background border border-border/50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                  {generatedContent}
                </pre>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent);
                  toast({
                    title: "Copiado",
                    description: "Conteúdo copiado para área de transferência",
                  });
                }}
                variant="outline"
                className="flex-1"
              >
                Copiar Conteúdo
              </Button>
              <Button
                onClick={() => {
                  setAnalysis(null);
                  setGeneratedContent("");
                  setReferenceImages([]);
                  setReferenceText("");
                  setInstagramUrl("");
                  setExtractedImages([]);
                }}
                variant="outline"
                className="flex-1"
              >
                Nova Análise
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ReverseEngineering;
