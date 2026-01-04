import { useState } from "react";
import { Youtube, Loader2, Sparkles, Copy, Calendar, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { useContentRepurpose, ContentFormat, ContentObjective, GeneratedContent } from "@/hooks/useContentRepurpose";
import { cn } from "@/lib/utils";

const CONTENT_FORMATS: { id: ContentFormat; label: string; description: string }[] = [
  { id: "newsletter", label: "Newsletter", description: "Texto longo para email" },
  { id: "thread", label: "Thread", description: "Série de tweets conectados" },
  { id: "tweet", label: "Tweet", description: "Post curto para X/Twitter" },
  { id: "carousel", label: "Carrossel", description: "Slides para Instagram/LinkedIn" },
  { id: "linkedin_post", label: "Post LinkedIn", description: "Publicação profissional" },
  { id: "instagram_post", label: "Post Instagram", description: "Legenda com hashtags" },
  { id: "reels_script", label: "Roteiro Reels", description: "Script para vídeo curto" },
  { id: "blog_post", label: "Blog Post", description: "Artigo completo" },
  { id: "email_marketing", label: "Email Marketing", description: "Email de conversão" },
];

const CONTENT_OBJECTIVES: { id: ContentObjective; label: string; color: string }[] = [
  { id: "sales", label: "Vendas", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  { id: "lead_generation", label: "Geração de Leads", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "educational", label: "Educacional", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { id: "brand_awareness", label: "Fortalecimento de Marca", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
];

export function ContentRepurposeTool() {
  const { toast } = useToast();
  const { clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  
  const selectedClient = clients?.find(c => c.id === selectedClientId);
  
  const {
    youtubeUrl,
    setYoutubeUrl,
    transcript,
    selectedFormats,
    toggleFormat,
    contentObjective,
    setContentObjective,
    generatedContents,
    isTranscribing,
    isGenerating,
    generatingFormat,
    transcribe,
    generateAll,
    copyToClipboard,
  } = useContentRepurpose(selectedClientId);

  const [showTranscript, setShowTranscript] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleTranscribe = async () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: "URL necessária",
        description: "Cole o link do vídeo do YouTube",
        variant: "destructive",
      });
      return;
    }

    try {
      await transcribe();
      toast({
        title: "Vídeo transcrito!",
        description: "Agora selecione os formatos para gerar",
      });
    } catch (error) {
      toast({
        title: "Erro ao transcrever",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!selectedClientId) {
      toast({
        title: "Cliente necessário",
        description: "Selecione um cliente para gerar conteúdos",
        variant: "destructive",
      });
      return;
    }

    if (selectedFormats.length === 0) {
      toast({
        title: "Formatos necessários",
        description: "Selecione pelo menos um formato para gerar",
        variant: "destructive",
      });
      return;
    }

    if (!contentObjective) {
      toast({
        title: "Objetivo necessário",
        description: "Selecione o objetivo do conteúdo",
        variant: "destructive",
      });
      return;
    }

    try {
      await generateAll();
      toast({
        title: "Conteúdos gerados!",
        description: `${selectedFormats.length} conteúdos criados com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async (content: GeneratedContent) => {
    await copyToClipboard(content.content);
    setCopiedId(content.format);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência",
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
          <Youtube className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Reaproveitamento de Conteúdo</h1>
          <p className="text-muted-foreground">
            Transforme vídeos do YouTube em múltiplos formatos de conteúdo
          </p>
        </div>
      </div>

      {/* Step 1: URL Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">1</Badge>
            Cole o link do YouTube
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleTranscribe} 
              disabled={isTranscribing || !youtubeUrl.trim()}
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transcrevendo...
                </>
              ) : (
                "Transcrever"
              )}
            </Button>
          </div>

          {/* Transcript Preview */}
          {transcript && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                {transcript.thumbnail && (
                  <img 
                    src={transcript.thumbnail} 
                    alt={transcript.title}
                    className="w-24 h-14 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{transcript.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {transcript.content.length.toLocaleString()} caracteres transcritos
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Transcrito
                </Badge>
              </div>

              <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    {showTranscript ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Ocultar transcrição
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Ver transcrição
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-48 rounded border p-3 mt-2">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {transcript.content}
                    </p>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Select Client */}
      {transcript && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
              Selecione o cliente
            </CardTitle>
            <CardDescription>
              O conteúdo será gerado seguindo a identidade e padrões do cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione um cliente...</option>
              {clients?.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Objective */}
      {transcript && selectedClientId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">3</Badge>
              Objetivo do conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={contentObjective || ""}
              onValueChange={(value) => setContentObjective(value as ContentObjective)}
              className="grid grid-cols-2 gap-3"
            >
              {CONTENT_OBJECTIVES.map((obj) => (
                <div key={obj.id}>
                  <RadioGroupItem
                    value={obj.id}
                    id={obj.id}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={obj.id}
                    className={cn(
                      "flex items-center justify-center rounded-lg border-2 p-3 cursor-pointer transition-all",
                      "hover:bg-muted/50",
                      contentObjective === obj.id 
                        ? obj.color + " border-current" 
                        : "border-muted"
                    )}
                  >
                    {obj.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Formats */}
      {transcript && selectedClientId && contentObjective && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">4</Badge>
              Formatos para gerar
            </CardTitle>
            <CardDescription>
              Selecione os formatos de conteúdo que deseja criar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {CONTENT_FORMATS.map((format) => (
                <div
                  key={format.id}
                  onClick={() => toggleFormat(format.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    "hover:bg-muted/50",
                    selectedFormats.includes(format.id)
                      ? "border-primary bg-primary/5"
                      : "border-muted"
                  )}
                >
                  <Checkbox
                    checked={selectedFormats.includes(format.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium text-sm">{format.label}</p>
                    <p className="text-xs text-muted-foreground">{format.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedFormats.length === 0}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando {generatingFormat}...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar {selectedFormats.length} conteúdo{selectedFormats.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generated Contents */}
      {generatedContents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Conteúdos Gerados</h2>
          
          {generatedContents.map((content) => {
            const formatInfo = CONTENT_FORMATS.find(f => f.id === content.format);
            const objectiveInfo = CONTENT_OBJECTIVES.find(o => o.id === content.objective);
            
            return (
              <Card key={content.format}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{formatInfo?.label}</CardTitle>
                      {objectiveInfo && (
                        <Badge variant="outline" className={objectiveInfo.color}>
                          {objectiveInfo.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(content)}
                      >
                        {copiedId === content.format ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-64">
                    <div className="whitespace-pre-wrap text-sm">
                      {content.content}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
