import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, ChevronDown, Palette, Camera, Sun, Layout, Type, Sparkles, Code2, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ImageAnalysis {
  description?: string;
  style?: {
    art_style?: string;
    photography_style?: string;
    illustration_technique?: string;
    rendering_quality?: string;
  };
  color_palette?: {
    dominant_colors?: string[];
    accent_colors?: string[];
    color_mood?: string;
    color_harmony?: string;
  };
  composition?: {
    layout?: string;
    focal_point?: string;
    symmetry?: string;
    depth?: string;
    framing?: string;
  };
  lighting?: {
    type?: string;
    direction?: string;
    intensity?: string;
    mood?: string;
  };
  subjects?: Array<{
    type?: string;
    description?: string;
    position?: string;
    prominence?: string;
  }>;
  text_elements?: {
    has_text?: boolean;
    text_style?: string;
    font_characteristics?: string;
    text_content?: string;
  };
  mood_atmosphere?: {
    overall_mood?: string;
    emotional_tone?: string;
    energy_level?: string;
  };
  generation_prompt?: string;
}

interface ImageAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: ImageAnalysis | null;
  ocrText?: string;
  imageName?: string;
  imageUrl?: string;
}

export function ImageAnalysisModal({ 
  open, 
  onOpenChange, 
  analysis, 
  ocrText,
  imageName,
  imageUrl 
}: ImageAnalysisModalProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedOcr, setCopiedOcr] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    style: true,
    colors: true,
    composition: false,
    lighting: false,
    subjects: false,
    mood: false,
    prompt: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyPrompt = () => {
    if (analysis?.generation_prompt) {
      navigator.clipboard.writeText(analysis.generation_prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const copyFullJson = () => {
    if (analysis) {
      navigator.clipboard.writeText(JSON.stringify(analysis, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const copyOcrText = () => {
    const textToCopy = ocrText || analysis?.text_elements?.text_content || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedOcr(true);
      setTimeout(() => setCopiedOcr(false), 2000);
    }
  };

  const hasOcr = ocrText || analysis?.text_elements?.text_content;
  const hasAnalysis = analysis && Object.keys(analysis).length > 0;

  if (!hasAnalysis && !hasOcr) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise de Imagem
            {imageName && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {imageName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue={hasAnalysis ? "visual" : "ocr"} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b px-4">
            {hasAnalysis && (
              <TabsTrigger value="visual" className="gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Análise Visual
              </TabsTrigger>
            )}
            {hasOcr && (
              <TabsTrigger value="ocr" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                OCR / Texto
              </TabsTrigger>
            )}
            {hasAnalysis && (
              <TabsTrigger value="json" className="gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                JSON Completo
              </TabsTrigger>
            )}
          </TabsList>

          {/* Visual Analysis Tab */}
          {hasAnalysis && (
            <TabsContent value="visual" className="m-0">
              <ScrollArea className="max-h-[calc(90vh-140px)]">
                <div className="p-4 space-y-3">
                  {/* Image preview */}
                  {imageUrl && (
                    <div className="flex justify-center mb-4">
                      <img 
                        src={imageUrl} 
                        alt={imageName || "Imagem analisada"} 
                        className="max-h-32 rounded-lg border object-contain"
                      />
                    </div>
                  )}

                  {/* Description */}
                  {analysis?.description && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {analysis.description}
                    </p>
                  )}

                  {/* Style Section */}
                  {analysis?.style && (
                    <CollapsibleSection 
                      title="Estilo Visual" 
                      icon={<Camera className="h-4 w-4" />}
                      isOpen={openSections.style}
                      onToggle={() => toggleSection('style')}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {analysis.style.art_style && (
                          <InfoItem label="Estilo Artístico" value={analysis.style.art_style} />
                        )}
                        {analysis.style.photography_style && (
                          <InfoItem label="Estilo Fotográfico" value={analysis.style.photography_style} />
                        )}
                        {analysis.style.illustration_technique && (
                          <InfoItem label="Técnica de Ilustração" value={analysis.style.illustration_technique} />
                        )}
                        {analysis.style.rendering_quality && (
                          <InfoItem label="Qualidade de Renderização" value={analysis.style.rendering_quality} />
                        )}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Colors Section */}
                  {analysis?.color_palette && (
                    <CollapsibleSection 
                      title="Paleta de Cores" 
                      icon={<Palette className="h-4 w-4" />}
                      isOpen={openSections.colors}
                      onToggle={() => toggleSection('colors')}
                    >
                      <div className="space-y-3">
                        {/* Dominant Colors */}
                        {analysis.color_palette.dominant_colors && analysis.color_palette.dominant_colors.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Cores Dominantes</p>
                            <div className="flex gap-1.5">
                              {analysis.color_palette.dominant_colors.map((color, i) => (
                                <ColorSwatch key={i} color={color} />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Accent Colors */}
                        {analysis.color_palette.accent_colors && analysis.color_palette.accent_colors.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Cores de Destaque</p>
                            <div className="flex gap-1.5">
                              {analysis.color_palette.accent_colors.map((color, i) => (
                                <ColorSwatch key={i} color={color} />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2">
                          {analysis.color_palette.color_mood && (
                            <InfoItem label="Mood das Cores" value={analysis.color_palette.color_mood} />
                          )}
                          {analysis.color_palette.color_harmony && (
                            <InfoItem label="Harmonia" value={analysis.color_palette.color_harmony} />
                          )}
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Composition Section */}
                  {analysis?.composition && (
                    <CollapsibleSection 
                      title="Composição" 
                      icon={<Layout className="h-4 w-4" />}
                      isOpen={openSections.composition}
                      onToggle={() => toggleSection('composition')}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {analysis.composition.layout && (
                          <InfoItem label="Layout" value={analysis.composition.layout} />
                        )}
                        {analysis.composition.focal_point && (
                          <InfoItem label="Ponto Focal" value={analysis.composition.focal_point} />
                        )}
                        {analysis.composition.symmetry && (
                          <InfoItem label="Simetria" value={analysis.composition.symmetry} />
                        )}
                        {analysis.composition.depth && (
                          <InfoItem label="Profundidade" value={analysis.composition.depth} />
                        )}
                        {analysis.composition.framing && (
                          <InfoItem label="Enquadramento" value={analysis.composition.framing} />
                        )}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Lighting Section */}
                  {analysis?.lighting && (
                    <CollapsibleSection 
                      title="Iluminação" 
                      icon={<Sun className="h-4 w-4" />}
                      isOpen={openSections.lighting}
                      onToggle={() => toggleSection('lighting')}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {analysis.lighting.type && (
                          <InfoItem label="Tipo" value={analysis.lighting.type} />
                        )}
                        {analysis.lighting.direction && (
                          <InfoItem label="Direção" value={analysis.lighting.direction} />
                        )}
                        {analysis.lighting.intensity && (
                          <InfoItem label="Intensidade" value={analysis.lighting.intensity} />
                        )}
                        {analysis.lighting.mood && (
                          <InfoItem label="Mood" value={analysis.lighting.mood} />
                        )}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Subjects Section */}
                  {analysis?.subjects && analysis.subjects.length > 0 && (
                    <CollapsibleSection 
                      title={`Sujeitos (${analysis.subjects.length})`}
                      icon={<Type className="h-4 w-4" />}
                      isOpen={openSections.subjects}
                      onToggle={() => toggleSection('subjects')}
                    >
                      <div className="space-y-2">
                        {analysis.subjects.map((subject, i) => (
                          <div key={i} className="p-2 bg-muted/50 rounded-md">
                            <p className="text-sm font-medium">{subject.type || `Sujeito ${i + 1}`}</p>
                            {subject.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{subject.description}</p>
                            )}
                            <div className="flex gap-2 mt-1">
                              {subject.position && (
                                <Badge variant="outline" className="text-[10px]">{subject.position}</Badge>
                              )}
                              {subject.prominence && (
                                <Badge variant="outline" className="text-[10px]">{subject.prominence}</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Mood Section */}
                  {analysis?.mood_atmosphere && (
                    <CollapsibleSection 
                      title="Atmosfera" 
                      icon={<Sparkles className="h-4 w-4" />}
                      isOpen={openSections.mood}
                      onToggle={() => toggleSection('mood')}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {analysis.mood_atmosphere.overall_mood && (
                          <InfoItem label="Mood Geral" value={analysis.mood_atmosphere.overall_mood} />
                        )}
                        {analysis.mood_atmosphere.emotional_tone && (
                          <InfoItem label="Tom Emocional" value={analysis.mood_atmosphere.emotional_tone} />
                        )}
                        {analysis.mood_atmosphere.energy_level && (
                          <InfoItem label="Nível de Energia" value={analysis.mood_atmosphere.energy_level} />
                        )}
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Generation Prompt Section */}
                  {analysis?.generation_prompt && (
                    <CollapsibleSection 
                      title="Prompt de Recriação" 
                      icon={<Sparkles className="h-4 w-4" />}
                      isOpen={openSections.prompt}
                      onToggle={() => toggleSection('prompt')}
                    >
                      <div className="space-y-2">
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <p className="text-sm leading-relaxed">{analysis.generation_prompt}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={copyPrompt}
                          className="w-full"
                        >
                          {copiedPrompt ? (
                            <>
                              <Check className="h-3 w-3 mr-1.5" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1.5" />
                              Copiar Prompt
                            </>
                          )}
                        </Button>
                      </div>
                    </CollapsibleSection>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {/* OCR Tab */}
          {hasOcr && (
            <TabsContent value="ocr" className="m-0">
              <ScrollArea className="max-h-[calc(90vh-140px)]">
                <div className="p-4 space-y-4">
                  {/* Image preview */}
                  {imageUrl && (
                    <div className="flex justify-center mb-4">
                      <img 
                        src={imageUrl} 
                        alt={imageName || "Imagem"} 
                        className="max-h-32 rounded-lg border object-contain"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Texto Extraído (OCR)
                      </h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={copyOcrText}
                      >
                        {copiedOcr ? (
                          <>
                            <Check className="h-3 w-3 mr-1.5" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1.5" />
                            Copiar Texto
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg border min-h-[200px]">
                      <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                        {ocrText || analysis?.text_elements?.text_content || "Nenhum texto encontrado"}
                      </pre>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {/* Full JSON Tab */}
          {hasAnalysis && (
            <TabsContent value="json" className="m-0">
              <ScrollArea className="max-h-[calc(90vh-140px)]">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Code2 className="h-4 w-4" />
                      JSON Completo (Raw)
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={copyFullJson}
                    >
                      {copiedJson ? (
                        <>
                          <Check className="h-3 w-3 mr-1.5" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1.5" />
                          Copiar JSON
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg border overflow-x-auto">
                    <pre className="text-xs font-mono leading-relaxed">
                      {JSON.stringify(analysis, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Helper Components
function CollapsibleSection({ 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children 
}: { 
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-2 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-muted/30 rounded-md">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyColor = () => {
    navigator.clipboard.writeText(color);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };
  
  // Parse color - could be hex, rgb, or name
  const bgColor = color.startsWith('#') || color.startsWith('rgb') 
    ? color 
    : color.toLowerCase();
  
  return (
    <button
      onClick={copyColor}
      className="group relative"
      title={`${color} - Clique para copiar`}
    >
      <div 
        className="h-8 w-8 rounded-lg border-2 border-border shadow-sm transition-transform group-hover:scale-110"
        style={{ backgroundColor: bgColor }}
      />
      {copied && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-foreground text-background text-[9px] rounded">
          ✓
        </div>
      )}
      <p className="text-[8px] text-center mt-0.5 text-muted-foreground truncate max-w-8">
        {color.replace('#', '').substring(0, 6)}
      </p>
    </button>
  );
}
