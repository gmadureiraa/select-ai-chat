import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ChevronLeft, ChevronRight, Loader2, Upload, FileText, X, Plus,
  Globe, Instagram, Linkedin, Twitter, Youtube, Megaphone, Mail,
  Check, Sparkles, Building, MessageSquare, Users, RotateCcw,
  Palette, Type, Eye
} from "lucide-react";
import { WizardProgress } from "./WizardProgress";
import { WizardStep, StepSection } from "./WizardStep";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useClients } from "@/hooks/useClients";
import { useGenerateClientContext } from "@/hooks/useGenerateClientContext";
import { useClientAnalysis, ClientAnalysis } from "@/hooks/useClientAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClientCreationWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

const STEPS = [
  { title: "Fontes", description: "Website, redes e docs" },
  { title: "Análise IA", description: "Extração automática" },
  { title: "Perfil", description: "Revisar e ajustar" },
  { title: "Confirmar", description: "Criar cliente" },
];

const socialFields = [
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
  { key: "twitter", label: "X/Twitter", icon: Twitter, placeholder: "@usuario" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  { key: "tiktok", label: "TikTok", icon: Megaphone, placeholder: "@usuario" },
  { key: "newsletter", label: "Newsletter", icon: Mail, placeholder: "link da newsletter" },
];

const analysisSteps = [
  { key: "connect", label: "Conectando ao website", threshold: 15 },
  { key: "branding", label: "Extraindo logo e cores", threshold: 30 },
  { key: "content", label: "Analisando conteúdo", threshold: 45 },
  { key: "social", label: "Processando redes sociais", threshold: 60 },
  { key: "docs", label: "Processando documentos", threshold: 75 },
  { key: "profile", label: "Gerando perfil completo", threshold: 90 },
  { key: "final", label: "Finalizando", threshold: 100 },
];

export function ClientCreationWizard({ onComplete, onCancel }: ClientCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [hasAutoFilled, setHasAutoFilled] = useState(false);

  // Step 1: Sources (combined inputs)
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>({});
  const [websites, setWebsites] = useState<string[]>([]);
  const [websiteInput, setWebsiteInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // Step 3: Profile (auto-filled by AI, editable)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [segment, setSegment] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [identityGuide, setIdentityGuide] = useState("");

  const { createClient } = useClients();
  const { generateContext, isGenerating } = useGenerateClientContext();
  const { 
    isAnalyzing, 
    analysis, 
    progress, 
    error: analysisError, 
    runAnalysis, 
    updateAnalysis,
    setAnalysis,
    resetAnalysis 
  } = useClientAnalysis();

  // Run analysis when entering step 2
  useEffect(() => {
    if (currentStep === 2 && !hasRunAnalysis && !analysis && !isAnalyzing) {
      triggerAnalysis();
    }
  }, [currentStep]);

  // Auto-fill fields when analysis completes and move to step 3
  useEffect(() => {
    if (analysis && currentStep === 2 && !hasAutoFilled) {
      setHasAutoFilled(true);
      
      // Auto-fill fields from AI analysis
      if (!description && analysis.executive_summary) {
        setDescription(analysis.executive_summary);
      }
      if (!segment && analysis.content_themes?.length > 0) {
        setSegment(analysis.content_themes.slice(0, 2).join(", "));
      }
      if (!tone && analysis.tone_of_voice?.primary) {
        setTone(analysis.tone_of_voice.primary);
      }
      if (!audience && analysis.target_audience?.demographics) {
        const demo = analysis.target_audience.demographics;
        const parts = [demo.role, demo.age, demo.location].filter(Boolean);
        setAudience(parts.join(", "));
      }
      if (!avatarUrl && analysis.visual_identity?.logo_url) {
        setAvatarUrl(analysis.visual_identity.logo_url);
      }
      
      // Auto-advance to profile step after a brief delay
      setTimeout(() => {
        setDirection("forward");
        setCurrentStep(3);
      }, 1500);
    }
  }, [analysis, currentStep, hasAutoFilled]);

  const triggerAnalysis = async () => {
    setHasRunAnalysis(true);
    setHasAutoFilled(false);
    const clientData = {
      name,
      description,
      segment,
      tone,
      audience,
      socialMedia: { ...socialMedia, website },
      websites: website ? [website, ...websites] : websites,
      documentContents: [],
    };
    await runAnalysis(clientData);
  };

  const reAnalyze = () => {
    setHasRunAnalysis(false);
    setHasAutoFilled(false);
    resetAnalysis();
    triggerAnalysis();
  };

  const goNext = () => {
    if (currentStep < STEPS.length) {
      setDirection("forward");
      setCurrentStep(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setDirection("backward");
      setCurrentStep(prev => prev - 1);
    }
  };

  const addWebsite = () => {
    if (websiteInput.trim() && !websites.includes(websiteInput.trim())) {
      setWebsites([...websites, websiteInput.trim()]);
      setWebsiteInput("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return name.trim().length > 0;
      case 2: return !!analysis && !isAnalyzing;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const calculateCompleteness = () => {
    let filled = 0;
    let total = 10;
    
    if (name.trim()) filled++;
    if (description.trim()) filled++;
    if (segment.trim()) filled++;
    if (tone.trim()) filled++;
    if (audience.trim()) filled++;
    if (Object.values(socialMedia).some(v => typeof v === 'string' && v.trim())) filled++;
    if (website.trim()) filled++;
    if (websites.length > 0) filled++;
    if (files.length > 0) filled++;
    if (avatarUrl) filled++;
    
    return Math.round((filled / total) * 100);
  };

  const getAnalysisStepStatus = (stepThreshold: number) => {
    if (progress.progress >= stepThreshold) return "done";
    if (progress.progress >= stepThreshold - 15) return "active";
    return "pending";
  };

  const handleCreate = async () => {
    setIsProcessing(true);
    
    try {
      // 1. Create client
      setProcessingMessage("Criando cliente...");
      const allWebsites = website ? [website, ...websites] : websites;
      const tags = { segment, tone, audience, objectives: "" };
      
      const client = await createClient.mutateAsync({
        name,
        description: description || null,
        context_notes: null,
        social_media: { ...socialMedia, website },
        tags,
        function_templates: [],
        websites: allWebsites,
      });

      const clientId = client.id;

      // 2. Upload avatar if set
      if (avatarUrl) {
        await supabase
          .from("clients")
          .update({ avatar_url: avatarUrl })
          .eq("id", clientId);
      }

      // 3. Upload documents
      setProcessingMessage("Enviando documentos...");
      const uploadedDocs: string[] = [];
      for (const file of files) {
        const fileName = `${clientId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("client-files")
          .upload(fileName, file);

        if (!uploadError) {
          await supabase.from("client_documents").insert({
            client_id: clientId,
            name: file.name,
            file_type: file.type,
            file_path: fileName,
          });
          uploadedDocs.push(file.name);
        }
      }

      // 4. Scrape websites
      setProcessingMessage("Analisando websites...");
      const websiteContents: string[] = [];
      for (const url of allWebsites) {
        try {
          const { data } = await supabase.functions.invoke("scrape-website", {
            body: { url, clientId },
          });
          if (data?.scraped_markdown) {
            websiteContents.push(`Website: ${url}\n${data.scraped_markdown}`);
          }
        } catch (err) {
          console.error("Error scraping website:", url, err);
        }
      }

      // 5. Generate context with AI
      setProcessingMessage("Gerando documento final com IA...");
      const finalContext = await generateContext({
        name,
        description,
        tags,
        social_media: { ...socialMedia, website },
        function_templates: [],
        websites: websiteContents,
        documents: uploadedDocs,
      });

      // 6. Update client with final context, identity guide, and AI analysis
      if (finalContext || identityGuide || analysis) {
        await supabase
          .from("clients")
          .update({ 
            context_notes: finalContext,
            identity_guide: identityGuide || null,
            ai_analysis: analysis ? JSON.parse(JSON.stringify(analysis)) : null,
          })
          .eq("id", clientId);
      }

      onComplete();
    } catch (error) {
      console.error("Error creating client:", error);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <WizardProgress 
        currentStep={currentStep} 
        totalSteps={STEPS.length} 
        steps={STEPS} 
      />

      {/* Step Content */}
      <div className="min-h-[400px] py-4">
        {/* Step 1: Sources */}
        <WizardStep isActive={currentStep === 1} direction={direction}>
          <StepSection 
            title="Fontes de Informação" 
            description="Forneça as fontes que a IA usará para entender o cliente"
          >
            <ScrollArea className="h-[380px] pr-4">
              <div className="space-y-6">
                {/* Name (required) */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-1">
                    Nome do Cliente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Empresa XYZ"
                    className={cn(!name.trim() && "border-destructive/50")}
                  />
                </div>

                {/* Main Website */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Website Principal
                  </Label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">
                    A IA extrairá logo, cores, tom de voz e mais do website
                  </p>
                </div>

                {/* Social Media */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Redes Sociais</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {socialFields.map((field) => (
                      <div key={field.key} className="flex items-center gap-2">
                        <field.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          value={socialMedia[field.key] || ""}
                          onChange={(e) => setSocialMedia({ ...socialMedia, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Websites */}
                <div className="space-y-2">
                  <Label>Páginas Adicionais para Indexar</Label>
                  <div className="flex gap-2">
                    <Input
                      value={websiteInput}
                      onChange={(e) => setWebsiteInput(e.target.value)}
                      placeholder="https://exemplo.com/about"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addWebsite())}
                    />
                    <Button type="button" onClick={addWebsite} size="icon" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {websites.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {websites.map((url) => (
                        <Badge key={url} variant="secondary" className="gap-1">
                          <span className="truncate max-w-[200px]">{url}</span>
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                            onClick={() => setWebsites(websites.filter(w => w !== url))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div className="space-y-2">
                  <Label>Documentos</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Clique ou arraste arquivos aqui
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF, DOC, TXT, Imagens
                      </p>
                    </label>
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </StepSection>
        </WizardStep>

        {/* Step 2: AI Analysis */}
        <WizardStep isActive={currentStep === 2} direction={direction}>
          <StepSection 
            title="Análise Inteligente" 
            description="A IA está extraindo informações automaticamente"
          >
            <div className="flex flex-col items-center justify-center py-8 space-y-8">
              {/* Animated Icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className={cn(
                    "h-10 w-10 text-primary",
                    isAnalyzing && "animate-pulse"
                  )} />
                </div>
                {isAnalyzing && (
                  <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                )}
              </div>

              {/* Title */}
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-1">
                  {isAnalyzing ? "Analisando Cliente..." : analysis ? "Análise Completa!" : "Iniciando Análise..."}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isAnalyzing 
                    ? "Aguarde enquanto extraímos informações do cliente" 
                    : analysis 
                      ? "Redirecionando para revisão do perfil..." 
                      : "Preparando análise..."}
                </p>
              </div>

              {/* Progress Steps */}
              <div className="w-full max-w-md space-y-3">
                {analysisSteps.map((step, idx) => {
                  const status = getAnalysisStepStatus(step.threshold);
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                        status === "done" && "bg-primary text-primary-foreground",
                        status === "active" && "bg-primary/20 text-primary animate-pulse",
                        status === "pending" && "bg-muted text-muted-foreground"
                      )}>
                        {status === "done" ? (
                          <Check className="h-3 w-3" />
                        ) : status === "active" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span className={cn(
                        "text-sm transition-colors",
                        status === "done" && "text-foreground",
                        status === "active" && "text-primary font-medium",
                        status === "pending" && "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md">
                <Progress value={progress.progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {progress.progress}%
                </p>
              </div>

              {/* Error State */}
              {analysisError && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-destructive">{analysisError}</p>
                  <Button variant="outline" size="sm" onClick={reAnalyze}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              )}

              {/* Tip */}
              <div className="bg-muted/50 rounded-lg p-3 text-center max-w-md">
                <p className="text-xs text-muted-foreground">
                  💡 Quanto mais informações você forneceu no passo anterior, melhor será a análise!
                </p>
              </div>
            </div>
          </StepSection>
        </WizardStep>

        {/* Step 3: Profile Review */}
        <WizardStep isActive={currentStep === 3} direction={direction}>
          <StepSection 
            title="Perfil Gerado pela IA" 
            description="Revise e ajuste as informações extraídas"
            actions={
              <Button variant="ghost" size="sm" onClick={reAnalyze} disabled={isAnalyzing}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Re-analisar
              </Button>
            }
          >
            <ScrollArea className="h-[380px] pr-4">
              <div className="space-y-6">
                {/* Visual Identity Preview */}
                {analysis?.visual_identity && (
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-start gap-4">
                      {/* Logo */}
                      <AvatarUpload
                        currentUrl={avatarUrl}
                        onUpload={setAvatarUrl}
                        fallback={name.charAt(0) || "?"}
                        size="lg"
                        bucket="client-files"
                        folder="client-avatars"
                      />
                      
                      <div className="flex-1 space-y-3">
                        {/* Colors */}
                        {analysis.visual_identity.colors?.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Cores:</span>
                            <div className="flex gap-1">
                              {analysis.visual_identity.colors.slice(0, 5).map((color, idx) => (
                                <div
                                  key={idx}
                                  className="w-6 h-6 rounded border shadow-sm"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Typography */}
                        {analysis.visual_identity.typography?.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Type className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Fontes:</span>
                            <span className="text-sm">{analysis.visual_identity.typography.join(", ")}</span>
                          </div>
                        )}
                        
                        {/* Style */}
                        {analysis.visual_identity.style && (
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Estilo:</span>
                            <span className="text-sm">{analysis.visual_identity.style}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center justify-between">
                    <span>Descrição</span>
                    {analysis?.executive_summary && (
                      <Badge variant="secondary" className="text-xs">Preenchido pela IA</Badge>
                    )}
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição do cliente..."
                    rows={3}
                  />
                </div>

                {/* Grid: Segment, Tone, Audience */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      Segmento
                      {analysis?.content_themes && (
                        <Badge variant="outline" className="text-xs ml-auto">IA</Badge>
                      )}
                    </Label>
                    <Input
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                      placeholder="Ex: E-commerce, SaaS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Tom de Voz
                      {analysis?.tone_of_voice && (
                        <Badge variant="outline" className="text-xs ml-auto">IA</Badge>
                      )}
                    </Label>
                    <Input
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      placeholder="Ex: Profissional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Público-Alvo
                      {analysis?.target_audience && (
                        <Badge variant="outline" className="text-xs ml-auto">IA</Badge>
                      )}
                    </Label>
                    <Input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="Ex: 25-40 anos"
                    />
                  </div>
                </div>

                {/* Recommendations */}
                {analysis?.recommendations && analysis.recommendations.length > 0 && (
                  <Card className="p-4 bg-primary/5 border-primary/20">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium mb-2">Recomendações da IA</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {analysis.recommendations.slice(0, 3).map((rec, idx) => (
                            <li key={idx}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Identity Guide */}
                <div className="space-y-2">
                  <Label>Guia de Identidade (opcional)</Label>
                  <Textarea
                    value={identityGuide}
                    onChange={(e) => setIdentityGuide(e.target.value)}
                    placeholder="# Posicionamento&#10;...&#10;# Tom de Voz&#10;..."
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </ScrollArea>
          </StepSection>
        </WizardStep>

        {/* Step 4: Confirm */}
        <WizardStep isActive={currentStep === 4} direction={direction}>
          <StepSection 
            title="Confirmar Criação" 
            description="Revise o resumo e crie o cliente"
          >
            <div className="space-y-6">
              {/* Summary Card */}
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                      {name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{name}</h3>
                    {description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {segment && <Badge variant="secondary">{segment}</Badge>}
                      {tone && <Badge variant="outline">{tone}</Badge>}
                      {audience && <Badge variant="outline">{audience}</Badge>}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <Globe className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-2xl font-bold">{website ? 1 + websites.length : websites.length}</p>
                  <p className="text-xs text-muted-foreground">Websites</p>
                </Card>
                <Card className="p-4 text-center">
                  <Instagram className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-2xl font-bold">{Object.values(socialMedia).filter(v => typeof v === 'string' && v.trim()).length}</p>
                  <p className="text-xs text-muted-foreground">Redes Sociais</p>
                </Card>
                <Card className="p-4 text-center">
                  <FileText className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-2xl font-bold">{files.length}</p>
                  <p className="text-xs text-muted-foreground">Documentos</p>
                </Card>
                <Card className="p-4 text-center">
                  <Sparkles className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-2xl font-bold">{analysis ? "✓" : "—"}</p>
                  <p className="text-xs text-muted-foreground">Análise IA</p>
                </Card>
              </div>

              {/* Completeness */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Perfil Completo</span>
                  <span className="text-sm text-muted-foreground">{calculateCompleteness()}%</span>
                </div>
                <Progress value={calculateCompleteness()} className="h-2" />
              </div>
            </div>
          </StepSection>
        </WizardStep>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={currentStep === 1 ? onCancel : goBack}
          disabled={currentStep === 2 && isAnalyzing}
        >
          {currentStep === 1 ? (
            "Cancelar"
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          {currentStep < STEPS.length ? (
            <>
              {currentStep === 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goNext}
                  className="text-muted-foreground"
                >
                  Pular análise
                </Button>
              )}
              {currentStep !== 2 && (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={!canProceed()}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {currentStep === 2 && !isAnalyzing && analysis && (
                <Button
                  type="button"
                  onClick={goNext}
                >
                  Revisar Perfil
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {currentStep === 2 && isAnalyzing && (
                <Button disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isProcessing || !name.trim()}
              className="min-w-[140px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {processingMessage || "Criando..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Criar Cliente
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
