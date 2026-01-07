import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Instagram, Download, Image, FileText, Check } from "lucide-react";
import { useInstagramImport } from "@/hooks/useInstagramImport";
import { useContentLibrary } from "@/hooks/useContentLibrary";
import { useReferenceLibrary } from "@/hooks/useReferenceLibrary";
import { useToast } from "@/hooks/use-toast";

interface InstagramCarouselImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

export function InstagramCarouselImporter({
  open,
  onOpenChange,
  clientId,
}: InstagramCarouselImporterProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [targetLibrary, setTargetLibrary] = useState<"content" | "reference">("reference");
  const [isSaving, setIsSaving] = useState(false);

  const {
    step,
    extractedData,
    transcription,
    result,
    error,
    importFromUrl,
    updateTranscription,
    reset,
  } = useInstagramImport();

  const { createContent } = useContentLibrary(clientId);
  const { createReference } = useReferenceLibrary(clientId);

  const handleImport = () => {
    importFromUrl(url);
  };

  const handleSave = async () => {
    if (!result) return;

    setIsSaving(true);
    try {
      if (targetLibrary === "content") {
        await createContent.mutateAsync({
          title: result.title,
          content_type: "carousel",
          content: result.content,
          content_url: result.sourceUrl,
          thumbnail_url: result.thumbnailUrl,
          metadata: {
            images: result.images,
            importedAt: new Date().toISOString(),
            source: "instagram",
          },
        });
      } else {
        await createReference.mutateAsync({
          title: result.title,
          reference_type: "carousel",
          content: result.content,
          source_url: result.sourceUrl,
          thumbnail_url: result.thumbnailUrl,
          metadata: {
            images: result.images,
            importedAt: new Date().toISOString(),
            source: "instagram",
          },
        });
      }

      toast({
        title: "Salvo com sucesso",
        description: `Post adicionado à biblioteca de ${targetLibrary === "content" ? "conteúdo" : "referências"}`,
      });

      handleClose();
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setUrl("");
    reset();
    onOpenChange(false);
  };

  const isLoading = step === "extracting" || step === "transcribing";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Importar do Instagram
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Cole o link do post ou reel do Instagram"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
            <Button onClick={handleImport} disabled={isLoading || !url.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              {step === "extracting" ? "Extraindo imagens..." : "Transcrevendo texto..."}
            </div>
          )}

          {/* Error State */}
          {error && step === "error" && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {step === "ready" && result && extractedData && (
            <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "calc(85vh - 200px)" }}>
              <div className="space-y-4 pr-4">
                {/* Transcription - FIRST and PROMINENT */}
                <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
                  <Label className="text-sm font-semibold flex items-center gap-2 mb-2 text-primary">
                    <FileText className="h-4 w-4" />
                    Transcrição das Imagens (edite se necessário)
                  </Label>
                  <Textarea
                    value={transcription}
                    onChange={(e) => updateTranscription(e.target.value)}
                    rows={10}
                    className="text-sm font-mono"
                    placeholder="Transcrição do texto das imagens..."
                  />
                  {transcription && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {Math.max(
                        (transcription.match(/---PÁGINA/gi) || []).length,
                        (transcription.match(/##\s*📄\s*Página/gi) || []).length,
                        (transcription.match(/##\s*📱\s*Slide/gi) || []).length,
                        1
                      )} páginas transcritas
                    </p>
                  )}
                </div>

                {/* Image Preview */}
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Image className="h-4 w-4" />
                    Imagens Extraídas ({extractedData.imageCount})
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {extractedData.images.slice(0, 8).map((img, idx) => (
                      <div
                        key={idx}
                        className="aspect-square rounded-md overflow-hidden bg-muted border relative"
                      >
                        <img
                          src={img}
                          alt={`Slide ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Hide broken image and show placeholder using safe DOM manipulation (no innerHTML for XSS prevention)
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.placeholder-icon')) {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'placeholder-icon absolute inset-0 flex flex-col items-center justify-center text-muted-foreground';
                              
                              // Create SVG element safely using DOM methods
                              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                              svg.setAttribute('width', '24');
                              svg.setAttribute('height', '24');
                              svg.setAttribute('viewBox', '0 0 24 24');
                              svg.setAttribute('fill', 'none');
                              svg.setAttribute('stroke', 'currentColor');
                              svg.setAttribute('stroke-width', '2');
                              svg.setAttribute('stroke-linecap', 'round');
                              svg.setAttribute('stroke-linejoin', 'round');
                              svg.setAttribute('class', 'mb-1 opacity-50');
                              
                              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                              rect.setAttribute('width', '18');
                              rect.setAttribute('height', '18');
                              rect.setAttribute('x', '3');
                              rect.setAttribute('y', '3');
                              rect.setAttribute('rx', '2');
                              rect.setAttribute('ry', '2');
                              
                              const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                              circle.setAttribute('cx', '9');
                              circle.setAttribute('cy', '9');
                              circle.setAttribute('r', '2');
                              
                              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                              path.setAttribute('d', 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21');
                              
                              svg.appendChild(rect);
                              svg.appendChild(circle);
                              svg.appendChild(path);
                              
                              // Create span element safely using textContent (not innerHTML)
                              const span = document.createElement('span');
                              span.className = 'text-xs';
                              span.textContent = `Slide ${idx + 1}`;
                              
                              placeholder.appendChild(svg);
                              placeholder.appendChild(span);
                              parent.appendChild(placeholder);
                            }
                          }}
                        />
                      </div>
                    ))}
                    {extractedData.imageCount > 8 && (
                      <div className="aspect-square rounded-md bg-muted border flex items-center justify-center text-muted-foreground text-sm">
                        +{extractedData.imageCount - 8}
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {extractedData.caption && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Legenda Original</Label>
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {extractedData.caption}
                    </div>
                  </div>
                )}

                {/* Target Library - Default to Reference */}
                <div className="border rounded-lg p-3 bg-muted/50">
                  <Label className="text-sm font-medium mb-2 block">Salvar em</Label>
                  <RadioGroup
                    value={targetLibrary}
                    onValueChange={(v) => setTargetLibrary(v as "content" | "reference")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="reference" id="reference" />
                      <Label htmlFor="reference" className="font-normal cursor-pointer">
                        Biblioteca de Referências
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="content" id="content" />
                      <Label htmlFor="content" className="font-normal cursor-pointer">
                        Conteúdo Produzido
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Actions */}
        {step === "ready" && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
