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
import { ArrowLeft, Link2, Upload, Loader2, Sparkles, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ReverseEngineering = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clients } = useClients();
  
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [referenceText, setReferenceText] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [inputType, setInputType] = useState<"images" | "text">("images");

  const handleAnalyze = async () => {
    if (!selectedClient) {
      toast({
        title: "Cliente não selecionado",
        description: "Selecione um cliente antes de analisar",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0 && !referenceText) {
      toast({
        title: "Referência vazia",
        description: "Adicione imagens ou texto de referência",
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
          referenceImages: inputType === "images" ? referenceImages : undefined,
          referenceText: inputType === "text" ? referenceText : undefined,
          phase: "analyze",
        },
      });

      if (error) throw error;

      setAnalysis(data);
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
      <header className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/agents")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Engenharia Reversa
          </h1>
          <p className="text-sm text-muted-foreground">
            Analise conteúdo de referência e recrie no estilo do seu cliente
          </p>
        </div>
      </header>

      <div className="grid gap-6">
        {/* Seleção de Cliente */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
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
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Conteúdo de Referência</Label>
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as "images" | "text")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="images" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Imagens
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Texto
                </TabsTrigger>
              </TabsList>
              <TabsContent value="images" className="space-y-2 mt-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-3">
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
                    className="flex flex-col items-center gap-2 cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Clique para fazer upload de screenshots
                    </span>
                  </label>
                </div>
                {referenceImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{referenceImages.length} imagem(ns) carregada(s)</p>
                    <div className="flex gap-2 flex-wrap">
                      {referenceImages.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 rounded border">
                          <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full object-cover rounded" />
                          <button
                            onClick={() => setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
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
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analisar Conteúdo
              </>
            )}
          </Button>
        </Card>

        {/* Análise */}
        {analysis && (
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Análise do Conteúdo</Label>
              <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
                <div>
                  <span className="font-medium text-foreground">Tipo:</span>{" "}
                  <span className="text-muted-foreground">{analysis.contentType}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Estrutura:</span>{" "}
                  <span className="text-muted-foreground">{analysis.structure}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Tom:</span>{" "}
                  <span className="text-muted-foreground">{analysis.tone}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Principais elementos:</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1 ml-2">
                    {analysis.keyElements?.map((element: string, i: number) => (
                      <li key={i}>{element}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-foreground">Estratégia:</span>{" "}
                  <p className="text-muted-foreground mt-1">{analysis.strategy}</p>
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
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Conteúdo Adaptado
                </>
              )}
            </Button>
          </Card>
        )}

        {/* Conteúdo Gerado */}
        {generatedContent && (
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                Conteúdo Gerado
              </Label>
              <div className="bg-muted/50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                  {generatedContent}
                </pre>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent);
                  toast({
                    title: "Copiado!",
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
