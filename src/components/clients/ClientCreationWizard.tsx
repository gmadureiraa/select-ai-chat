import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ChevronLeft, ChevronRight, Loader2, Upload, FileText, X, Plus,
  Globe, Instagram, Linkedin, Twitter, Youtube, Megaphone, Mail,
  Check, Sparkles, Building, MessageSquare, Users
} from "lucide-react";
import { WizardProgress } from "./WizardProgress";
import { WizardStep, StepSection } from "./WizardStep";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { AIClientAnalysis } from "./AIClientAnalysis";
import { useClients } from "@/hooks/useClients";
import { useGenerateClientContext } from "@/hooks/useGenerateClientContext";
import { useClientAnalysis, ClientAnalysis } from "@/hooks/useClientAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ClientCreationWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

const STEPS = [
  { title: "Básico", description: "Nome e perfil" },
  { title: "Digital", description: "Redes sociais" },
  { title: "Recursos", description: "Docs e sites" },
  { title: "Revisar", description: "Análise IA" },
];

const socialFields = [
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
  { key: "twitter", label: "X/Twitter", icon: Twitter, placeholder: "@usuario" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  { key: "tiktok", label: "TikTok", icon: Megaphone, placeholder: "@usuario" },
  { key: "newsletter", label: "Newsletter", icon: Mail, placeholder: "link da newsletter" },
];

export function ClientCreationWizard({ onComplete, onCancel }: ClientCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);

  // Step 1: Basic Info
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [segment, setSegment] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");

  // Step 2: Digital Identity
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState("");

  // Step 3: Resources
  const [websites, setWebsites] = useState<string[]>([]);
  const [websiteInput, setWebsiteInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
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

  // Run analysis when entering step 4
  useEffect(() => {
    if (currentStep === 4 && !hasRunAnalysis && !analysis && !isAnalyzing) {
      triggerAnalysis();
    }
  }, [currentStep]);

  const triggerAnalysis = async () => {
    setHasRunAnalysis(true);
    const clientData = {
      name,
      description,
      segment,
      tone,
      audience,
      socialMedia: { ...socialMedia, website },
      websites: website ? [website, ...websites] : websites,
      // Note: document contents would need to be extracted - for now we pass empty
      documentContents: [],
    };
    await runAnalysis(clientData);
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
      case 2: return true; // Optional
      case 3: return true; // Optional
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
    if (Object.values(socialMedia).some(v => v.trim())) filled++;
    if (website.trim()) filled++;
    if (websites.length > 0) filled++;
    if (files.length > 0) filled++;
    if (identityGuide.trim()) filled++;
    
    return Math.round((filled / total) * 100);
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
      <div className="min-h-[350px] py-4">
        {/* Step 1: Basic Info */}
        <WizardStep isActive={currentStep === 1} direction={direction}>
          <StepSection 
            title="Informações Básicas" 
            description="Defina o perfil inicial do cliente"
          >
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                <AvatarUpload
                  currentUrl={avatarUrl}
                  onUpload={setAvatarUrl}
                  fallback={name.charAt(0) || "?"}
                  size="lg"
                  bucket="client-files"
                  folder="client-avatars"
                />
                <span className="text-xs text-muted-foreground">Logo/Avatar</span>
              </div>
              
              <div className="flex-1 space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Breve descrição do cliente e seu negócio..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Segmento
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
                </Label>
                <Input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Ex: Profissional, Descontraído"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Público-Alvo
                </Label>
                <Input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex: Empreendedores 25-40"
                />
              </div>
            </div>
          </StepSection>
        </WizardStep>

        {/* Step 2: Digital Identity */}
        <WizardStep isActive={currentStep === 2} direction={direction}>
          <StepSection 
            title="Identidade Digital" 
            description="Configure as redes sociais e presença online"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Website Principal
                </Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {socialFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <field.icon className="h-4 w-4 text-muted-foreground" />
                      {field.label}
                    </Label>
                    <Input
                      value={socialMedia[field.key] || ""}
                      onChange={(e) => setSocialMedia({ ...socialMedia, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>
          </StepSection>
        </WizardStep>

        {/* Step 3: Resources */}
        <WizardStep isActive={currentStep === 3} direction={direction}>
          <StepSection 
            title="Recursos Adicionais" 
            description="Adicione documentos, websites extras e guia de identidade"
          >
            <div className="space-y-6">
              {/* Additional Websites */}
              <div className="space-y-2">
                <Label>Websites para Indexar</Label>
                <p className="text-xs text-muted-foreground">
                  Adicione páginas para extração automática de contexto
                </p>
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
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Clique ou arraste arquivos aqui
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOC, TXT, Imagens
                    </p>
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
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

              {/* Identity Guide */}
              <div className="space-y-2">
                <Label>Guia de Identidade (opcional)</Label>
                <Textarea
                  value={identityGuide}
                  onChange={(e) => setIdentityGuide(e.target.value)}
                  placeholder="# Posicionamento&#10;...&#10;# Tom de Voz&#10;..."
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </StepSection>
        </WizardStep>

        {/* Step 4: Review with AI Analysis */}
        <WizardStep isActive={currentStep === 4} direction={direction}>
          <StepSection 
            title="Análise Inteligente" 
            description="IA analisando o cliente e gerando insights"
          >
            <div className="space-y-4">
              {/* AI Analysis Component */}
              <AIClientAnalysis
                analysis={analysis}
                isAnalyzing={isAnalyzing}
                progress={progress}
                error={analysisError}
                onReanalyze={triggerAnalysis}
                onUpdate={updateAnalysis}
                className="max-h-[400px]"
              />

              {/* Summary when analysis is done */}
              {analysis && !isAnalyzing && (
                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Perfil Completo</span>
                    <span className="text-sm text-muted-foreground">{calculateCompleteness()}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${calculateCompleteness()}%` }}
                    />
                  </div>
                </div>
              )}
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
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goNext}
                  className="text-muted-foreground"
                >
                  Pular
                </Button>
              )}
              <Button
                type="button"
                onClick={goNext}
                disabled={!canProceed()}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
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
