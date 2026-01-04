import { useState } from "react";
import { Youtube, Loader2, Sparkles, Check, ChevronDown, ChevronUp, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { useContentRepurpose, ContentFormat } from "@/hooks/useContentRepurpose";
import { useRepurposeHistory, RepurposeHistoryItem } from "@/hooks/useRepurposeHistory";
import { GeneratedContentResults } from "./GeneratedContentResults";
import { RepurposeHistoryCards } from "./RepurposeHistoryCards";
import { cn } from "@/lib/utils";

const CONTENT_FORMATS: { id: ContentFormat; label: string; description: string; icon?: string }[] = [
  { id: "newsletter", label: "Newsletter", description: "Texto longo para email" },
  { id: "thread", label: "Thread", description: "Série de tweets conectados" },
  { id: "tweet", label: "Tweet", description: "Post curto para X/Twitter" },
  { id: "carousel", label: "Carrossel", description: "Slides para Instagram/LinkedIn" },
  { id: "linkedin_post", label: "Post LinkedIn", description: "Publicação profissional" },
  { id: "instagram_post", label: "Post Instagram", description: "Legenda com hashtags" },
  { id: "reels_script", label: "Roteiro Reels", description: "Script para vídeo curto" },
  { id: "blog_post", label: "Blog Post", description: "Artigo completo" },
  { id: "email_marketing", label: "Email Marketing", description: "Email de conversão" },
  { id: "cut_moments", label: "Momentos de Corte", description: "5 melhores clips para cortar", icon: "scissors" },
];

interface ContentRepurposeToolProps {
  clientId: string;
}

export function ContentRepurposeTool({ clientId }: ContentRepurposeToolProps) {
  const { toast } = useToast();
  const { clients } = useClients();
  const [viewingHistoryItem, setViewingHistoryItem] = useState<RepurposeHistoryItem | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  
  const selectedClient = clients?.find(c => c.id === clientId);
  const { saveHistory } = useRepurposeHistory(clientId);
  
  const {
    youtubeUrl,
    setYoutubeUrl,
    transcript,
    selectedFormats,
    toggleFormat,
    generatedContents,
    isTranscribing,
    isGenerating,
    generatingFormat,
    showResults,
    transcribe,
    generateAll,
    copyToClipboard,
    reset,
    goBackToForm,
  } = useContentRepurpose();

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
    if (!clientId) {
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

    try {
      const results = await generateAll(clientId);
      
      // Save to history (don't block results if this fails)
      if (results && results.length > 0 && transcript) {
        try {
          await saveHistory.mutateAsync({
            clientId: clientId,
            youtubeUrl,
            videoTitle: transcript.title,
            videoThumbnail: transcript.thumbnail,
            transcript: transcript.content,
            objective: "educational",
            generatedContents: results,
          });
        } catch (historyError) {
          console.error("Failed to save history:", historyError);
          toast({
            title: "Aviso",
            description: "Conteúdos gerados, mas não foi possível salvar no histórico",
          });
        }
      }
      
      toast({
        title: "Conteúdos gerados!",
        description: `${results?.length || 0} conteúdos criados`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  // View history item results
  if (viewingHistoryItem) {
    return (
      <GeneratedContentResults
        contents={viewingHistoryItem.generated_contents}
        videoTitle={viewingHistoryItem.video_title || "Vídeo"}
        videoThumbnail={viewingHistoryItem.video_thumbnail || undefined}
        onBack={() => setViewingHistoryItem(null)}
        onCopy={async (text) => {
          await copyToClipboard(text);
        }}
        onReset={() => {
          setViewingHistoryItem(null);
          reset();
        }}
        clientName={selectedClient?.name}
        clientId={clientId}
      />
    );
  }

  // Show results page when generation starts (or is complete)
  if (showResults) {
    return (
      <GeneratedContentResults
        contents={generatedContents}
        videoTitle={transcript?.title || "Vídeo"}
        videoThumbnail={transcript?.thumbnail}
        onBack={goBackToForm}
        onCopy={async (text) => {
          await copyToClipboard(text);
        }}
        onReset={reset}
        clientName={selectedClient?.name}
        clientId={clientId}
        isGenerating={isGenerating}
        generatingFormat={generatingFormat}
        expectedCount={selectedFormats.length}
      />
    );
  }

  const getFormatLabel = (formatId: string) => {
    const format = CONTENT_FORMATS.find(f => f.id === formatId);
    return format?.label || formatId;
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

      {/* History Section - Below URL input */}
      <RepurposeHistoryCards 
        clientId={clientId || undefined}
        onViewResults={(item) => setViewingHistoryItem(item)}
      />

      {/* Step 2: Formats */}
      {transcript && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
              Formatos para gerar
            </CardTitle>
            <CardDescription>
              Selecione os formatos de conteúdo que deseja criar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CONTENT_FORMATS.map((format) => (
                <div
                  key={format.id}
                  onClick={() => toggleFormat(format.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    "hover:bg-muted/50",
                    selectedFormats.includes(format.id)
                      ? "border-primary bg-primary/5"
                      : "border-muted",
                    format.id === "cut_moments" && "col-span-2 md:col-span-1 bg-gradient-to-r from-red-500/5 to-orange-500/5"
                  )}
                >
                  <Checkbox
                    checked={selectedFormats.includes(format.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {format.id === "cut_moments" && (
                        <Scissors className="h-4 w-4 text-red-500" />
                      )}
                      <p className="font-medium text-sm">{format.label}</p>
                    </div>
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
                  Gerando {getFormatLabel(generatingFormat || '')}...
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
    </div>
  );
}
