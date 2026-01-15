import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ChevronLeft, ChevronRight, Loader2, Upload, FileText, X, Plus,
  Globe, Instagram, Linkedin, Twitter, Youtube, Megaphone,
  Check, Sparkles
} from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useClients } from "@/hooks/useClients";
import { useClientAnalysis } from "@/hooks/useClientAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

interface ClientCreationWizardSimplifiedProps {
  onComplete: () => void;
  onCancel: () => void;
}

const socialFields = [
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
  { key: "twitter", label: "X/Twitter", icon: Twitter, placeholder: "@usuario" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  { key: "tiktok", label: "TikTok", icon: Megaphone, placeholder: "@usuario" },
];

export function ClientCreationWizardSimplified({ onComplete, onCancel }: ClientCreationWizardSimplifiedProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isCreating, setIsCreating] = useState(false);

  // Step 1: Basic info
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  // AI Analysis
  const { 
    isAnalyzing, 
    analysis, 
    progress, 
    runAnalysis, 
    resetAnalysis 
  } = useClientAnalysis();

  const { createClient } = useClients();

  // Auto-run analysis when entering step 2
  useEffect(() => {
    if (step === 2 && !analysis && !isAnalyzing) {
      runAnalysis({
        name,
        description: "",
        segment: "",
        tone: "",
        audience: "",
        socialMedia: { ...socialMedia, website },
        websites: website ? [website] : [],
        documentContents: [],
      });
    }
  }, [step]);

  // Auto-fill avatar from analysis
  useEffect(() => {
    if (analysis?.visual_identity?.logo_url && !avatarUrl) {
      setAvatarUrl(analysis.visual_identity.logo_url);
    }
  }, [analysis]);

  const canProceedStep1 = name.trim().length > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    
    try {
      // Build tags from analysis
      const tags = {
        segment: analysis?.content_themes?.slice(0, 2).join(", ") || "",
        tone: analysis?.tone_of_voice?.primary || "",
        audience: analysis?.target_audience?.demographics?.role || "",
        objectives: "",
      };

      // Create client
      const client = await createClient.mutateAsync({
        name,
        description: analysis?.executive_summary || null,
        context_notes: null,
        social_media: { ...socialMedia, website },
        tags,
        function_templates: [],
        websites: website ? [website] : [],
      });

      const clientId = client.id;

      // Upload avatar if set
      if (avatarUrl) {
        await supabase
          .from("clients")
          .update({ avatar_url: avatarUrl })
          .eq("id", clientId);
      }

      // Upload documents
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
        }
      }

      // Save AI analysis
      if (analysis) {
        await supabase
          .from("clients")
          .update({ ai_analysis: JSON.parse(JSON.stringify(analysis)) })
          .eq("id", clientId);
      }

      onComplete();
    } catch (error) {
      console.error("Error creating client:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
          step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {step > 1 ? <Check className="h-4 w-4" /> : "1"}
        </div>
        <div className={cn("flex-1 h-1 rounded", step >= 2 ? "bg-primary" : "bg-muted")} />
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
          step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          2
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold">Dados do Perfil</h3>
              <p className="text-sm text-muted-foreground">
                Preencha as informações básicas. A IA vai completar o resto.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <AvatarUpload
                currentUrl={avatarUrl}
                onUpload={setAvatarUrl}
                fallback={name.charAt(0) || "?"}
                size="lg"
                bucket="client-files"
                folder="client-avatars"
              />
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Perfil *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Empresa XYZ"
                    className={cn(!name.trim() && "border-destructive/50")}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Website
                  </Label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">
                    A IA vai extrair logo, cores e informações do site
                  </p>
                </div>
              </div>
            </div>

            {/* Social Media - Compact */}
            <div className="space-y-3">
              <Label className="text-sm">Redes Sociais (opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {socialFields.slice(0, 4).map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <field.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={socialMedia[field.key] || ""}
                      onChange={(e) => setSocialMedia({ ...socialMedia, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="text-sm h-9"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Documents - Compact */}
            <div className="space-y-2">
              <Label>Documentos (opcional)</Label>
              <div className="border border-dashed rounded-lg p-3 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  Clique para adicionar arquivos
                </label>
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {files.map((file, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                      <FileText className="h-3 w-3" />
                      <span className="truncate max-w-[100px]">{file.name}</span>
                      <button
                        onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                        className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 2: Analysis & Confirm */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-lg font-semibold">
                {isAnalyzing ? "Analisando..." : analysis ? "Pronto para criar!" : "Análise"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAnalyzing 
                  ? "A IA está extraindo informações automaticamente" 
                  : "Confira o resumo e confirme a criação"}
              </p>
            </div>

            {isAnalyzing && (
              <Card className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                  <div className="w-full max-w-xs">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      {progress.step || "Processando..."}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {analysis && !isAnalyzing && (
              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                      {name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold">{name}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {analysis.executive_summary || "Descrição será gerada automaticamente"}
                    </p>
                  </div>
                </div>

                {analysis.content_themes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.content_themes.slice(0, 4).map((theme, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {analysis.tone_of_voice?.primary && (
                    <span>Tom: {analysis.tone_of_voice.primary}</span>
                  )}
                  {Object.keys(socialMedia).filter(k => socialMedia[k]).length > 0 && (
                    <span>{Object.keys(socialMedia).filter(k => socialMedia[k]).length} redes sociais</span>
                  )}
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={step === 1 ? onCancel : () => setStep(1)}>
          {step === 1 ? "Cancelar" : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </>
          )}
        </Button>

        {step === 1 ? (
          <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
            Analisar com IA
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={isAnalyzing || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Criar Perfil
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
