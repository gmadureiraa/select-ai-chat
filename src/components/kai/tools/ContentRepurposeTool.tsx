import { useState } from "react";
import { Loader2, Sparkles, Check, Scissors, Youtube, FileText, Lightbulb, Link2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { useContentCreator, ContentFormat } from "@/hooks/useContentCreator";
import { useRepurposeHistory, RepurposeHistoryItem } from "@/hooks/useRepurposeHistory";
import { GeneratedContentResults } from "./GeneratedContentResults";
import { RepurposeHistoryCards } from "./RepurposeHistoryCards";
import { ContentSourceSelector } from "./ContentSourceSelector";
import { PlanningDestinationSelector } from "./PlanningDestinationSelector";
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
  
  const selectedClient = clients?.find(c => c.id === clientId);
  const { saveHistory } = useRepurposeHistory(clientId);
  
  const {
    sourceType,
    setSourceType,
    themeInput,
    setThemeInput,
    urlInput,
    setUrlInput,
    referenceInput,
    setReferenceInput,
    additionalContext,
    setAdditionalContext,
    extractedData,
    selectedFormats,
    toggleFormat,
    planningDestination,
    setPlanningDestination,
    columns,
    generatedContents,
    isExtracting,
    isGenerating,
    generatingFormat,
    showResults,
    extractContent,
    generateAll,
    copyToClipboard,
    reset,
    goBackToForm,
  } = useContentCreator();

  // Check if source is ready (has input based on type)
  const hasSourceInput = 
    (sourceType === 'theme' && themeInput.trim()) ||
    (sourceType === 'url' && urlInput.trim()) ||
    (sourceType === 'reference' && referenceInput.trim());

  const handleExtractOrContinue = async () => {
    if (sourceType === 'url' && !extractedData) {
      try {
        await extractContent();
        toast({
          title: "Conteúdo extraído!",
          description: "Agora selecione os formatos para gerar",
        });
      } catch (error) {
        toast({
          title: "Erro ao extrair",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    }
    // For theme/reference, no extraction needed - just proceed to step 2
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
      
      // Save to history
      if (results && results.length > 0) {
        const sourceUrl = sourceType === 'url' ? urlInput : 
                          sourceType === 'theme' ? `tema:${themeInput.substring(0, 50)}` : 
                          'referência';
        const title = extractedData?.title || themeInput || "Conteúdo";

        try {
          await saveHistory.mutateAsync({
            clientId: clientId,
            youtubeUrl: sourceUrl,
            videoTitle: title,
            videoThumbnail: extractedData?.thumbnail,
            transcript: extractedData?.content || themeInput,
            objective: "educational",
            generatedContents: results,
          });
        } catch (historyError) {
          console.error("Failed to save history:", historyError);
        }
      }
      
      const addedCount = results?.filter(r => r.addedToPlanning).length || 0;
      toast({
        title: "Conteúdos gerados!",
        description: addedCount > 0 
          ? `${results?.length || 0} conteúdos criados, ${addedCount} adicionados ao planejamento`
          : `${results?.length || 0} conteúdos criados`,
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
        videoTitle={viewingHistoryItem.video_title || "Conteúdo"}
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

  // Show results page when generation starts
  if (showResults) {
    return (
      <GeneratedContentResults
        contents={generatedContents}
        videoTitle={extractedData?.title || themeInput || "Conteúdo"}
        videoThumbnail={extractedData?.thumbnail}
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

  const getSourceIcon = () => {
    if (extractedData?.sourceType === 'youtube') return Youtube;
    if (sourceType === 'theme') return Lightbulb;
    if (sourceType === 'url') return Link2;
    return BookOpen;
  };

  const SourceIcon = getSourceIcon();

  // Determine if we should show step 2
  const showStep2 = sourceType === 'theme' || sourceType === 'reference' || extractedData;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Criador de Conteúdo</h1>
          <p className="text-muted-foreground">
            Transforme temas, links ou referências em múltiplos formatos
          </p>
        </div>
      </div>

      {/* Step 1: Source Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">1</Badge>
            De onde vem a inspiração?
          </CardTitle>
          <CardDescription>
            Escolha um tema, cole um link, ou use referências da biblioteca
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ContentSourceSelector
            sourceType={sourceType}
            onSourceTypeChange={setSourceType}
            themeInput={themeInput}
            onThemeInputChange={setThemeInput}
            urlInput={urlInput}
            onUrlInputChange={setUrlInput}
            referenceInput={referenceInput}
            onReferenceInputChange={setReferenceInput}
            additionalContext={additionalContext}
            onAdditionalContextChange={setAdditionalContext}
            clientId={clientId}
            disabled={isExtracting || isGenerating}
          />

          {/* Extract button for URL type */}
          {sourceType === 'url' && !extractedData && (
            <Button 
              onClick={handleExtractOrContinue} 
              disabled={isExtracting || !urlInput.trim()}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extraindo conteúdo...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Extrair Conteúdo
                </>
              )}
            </Button>
          )}

          {/* Extracted content preview */}
          {extractedData && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              {extractedData.thumbnail ? (
                <img 
                  src={extractedData.thumbnail} 
                  alt={extractedData.title}
                  className="w-24 h-14 object-cover rounded"
                />
              ) : (
                <div className="w-24 h-14 rounded bg-muted flex items-center justify-center">
                  <SourceIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{extractedData.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {extractedData.sourceType === 'youtube' ? 'YouTube' : 
                     extractedData.sourceType === 'theme' ? 'Tema' : 'Artigo'}
                  </Badge>
                  {extractedData.content.length.toLocaleString()} caracteres
                </p>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Check className="h-3 w-3 mr-1" />
                Pronto
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Section */}
      <RepurposeHistoryCards 
        clientId={clientId || undefined}
        onViewResults={(item) => setViewingHistoryItem(item)}
      />

      {/* Step 2: Formats & Destination */}
      {showStep2 && hasSourceInput && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
              Formatos e destino
            </CardTitle>
            <CardDescription>
              Selecione os formatos de conteúdo e onde criar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Format selection */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Formatos para gerar</p>
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
            </div>

            {/* Planning destination */}
            <PlanningDestinationSelector
              destination={planningDestination}
              onChange={setPlanningDestination}
              columns={columns}
              disabled={isGenerating}
            />

            {/* Generate button */}
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
                  {planningDestination.enabled && " e adicionar ao planejamento"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
