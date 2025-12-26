import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  User, FileText, Loader2, Globe, Instagram, Twitter, 
  Linkedin, Youtube, Mail, Megaphone, Trash2, RefreshCw, Check, X,
  Building, MessageSquare, Users, Target, Hash, Eye, Award, TrendingUp,
  Palette, Plug, Plus, ChevronRight, Image, BookOpen, Brain
} from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { SocialIntegrationsTab } from "./SocialIntegrationsTab";
import { ClientDocumentsManager } from "./ClientDocumentsManager";
import { BrandAssetsEditor } from "./BrandAssetsEditor";
import { VisualReferencesManager } from "./VisualReferencesManager";
import { AIClientAnalysis } from "./AIClientAnalysis";
import { Client, useClients } from "@/hooks/useClients";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { useClientAnalysis, ClientAnalysis } from "@/hooks/useClientAnalysis";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ClientEditAccordionProps {
  client: Client;
  onClose: () => void;
}

const socialMediaFields = [
  { key: "website", label: "Website Principal", icon: Globe, placeholder: "https://..." },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
  { key: "twitter", label: "X/Twitter", icon: Twitter, placeholder: "@usuario" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  { key: "tiktok", label: "TikTok", icon: Megaphone, placeholder: "@usuario" },
  { key: "newsletter", label: "Newsletter", icon: Mail, placeholder: "link ou plataforma" },
];

const tagFields = [
  { key: "segment", label: "Segmento/Indústria", icon: Building, placeholder: "Ex: E-commerce, SaaS, Educação" },
  { key: "tone", label: "Tom de Voz", icon: MessageSquare, placeholder: "Ex: Profissional, Descontraído" },
  { key: "audience", label: "Público-Alvo", icon: Users, placeholder: "Descrição do público principal", multiline: true },
  { key: "objectives", label: "Objetivos", icon: Target, placeholder: "Principais metas e objetivos", multiline: true },
  { key: "keywords", label: "Palavras-Chave", icon: Hash, placeholder: "Separadas por vírgula" },
  { key: "competitors", label: "Concorrentes", icon: Eye, placeholder: "Principais concorrentes" },
  { key: "differentials", label: "Diferenciais", icon: Award, placeholder: "O que diferencia o cliente", multiline: true },
  { key: "content_pillars", label: "Pilares de Conteúdo", icon: TrendingUp, placeholder: "Temas principais", multiline: true },
];

export function ClientEditAccordion({ client, onClose }: ClientEditAccordionProps) {
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description || "");
  const [contextNotes, setContextNotes] = useState(client.context_notes || "");
  const [identityGuide, setIdentityGuide] = useState((client as any).identity_guide || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(client.avatar_url || null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>(client.social_media as Record<string, string> || {});
  const [tags, setTags] = useState<Record<string, string>>(client.tags as Record<string, string> || {});
  const [functionTemplates, setFunctionTemplates] = useState<string[]>((client.function_templates as string[]) || []);
  const [templateInput, setTemplateInput] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  
  const { updateClient } = useClients();
  const { websites, addWebsite, deleteWebsite } = useClientWebsites(client.id);
  const { toast } = useToast();

  // Form data for debounce
  const formData = { name, description, contextNotes, identityGuide, avatarUrl, socialMedia, tags, functionTemplates };
  const debouncedFormData = useDebounce(formData, 3000);

  // Auto-save effect
  useEffect(() => {
    if (hasChanges && client) {
      const autoSave = async () => {
        setAutoSaveStatus("saving");
        try {
          await updateClient.mutateAsync({
            id: client.id,
            name: debouncedFormData.name,
            description: debouncedFormData.description || null,
            context_notes: debouncedFormData.contextNotes || null,
            identity_guide: debouncedFormData.identityGuide || null,
            avatar_url: debouncedFormData.avatarUrl,
            social_media: debouncedFormData.socialMedia,
            tags: debouncedFormData.tags,
            function_templates: debouncedFormData.functionTemplates,
          });
          setAutoSaveStatus("saved");
          setHasChanges(false);
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        } catch (error) {
          console.error("Auto-save failed:", error);
          setAutoSaveStatus("idle");
        }
      };
      autoSave();
    }
  }, [debouncedFormData]);

  const markChanged = () => setHasChanges(true);

  const loadGuideFromFolder = async () => {
    setIsLoadingGuide(true);
    try {
      const slugMap: Record<string, string> = {
        'Gabriel Madureira': 'madureira',
        'Madureira': 'madureira',
        'NeoBankless': 'neobankless',
        'Neobankless': 'neobankless',
        'Defiverso': 'defiverso',
        'Jornal Cripto': 'jornal-cripto',
        'Kaleidos': 'kaleidos',
        'Layla Foz': 'layla-foz',
      };
      
      const slug = slugMap[client.name] || client.name.toLowerCase().replace(/\s+/g, '-');
      const response = await fetch(`/clients/${slug}/guia-conteudo.md`);
      
      if (response.ok) {
        const content = await response.text();
        if (content && !content.includes('<!DOCTYPE html>')) {
          setIdentityGuide(content);
          markChanged();
          toast({ title: "Guia carregado", description: "Conteúdo importado do arquivo guia-conteudo.md" });
        } else {
          toast({ title: "Arquivo não encontrado", variant: "destructive" });
        }
      } else {
        toast({ title: "Arquivo não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao carregar", variant: "destructive" });
    } finally {
      setIsLoadingGuide(false);
    }
  };

  const handleRegenerateContext = async () => {
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{
            role: "user",
            content: `Analise todas as informações do cliente "${name}" e gere um documento completo de contexto em markdown:
- Descrição: ${description}
- Tags: ${JSON.stringify(tags)}
- Redes Sociais: ${JSON.stringify(socialMedia)}
- Websites: ${websites?.map(w => w.url).join(", ")}

Estruture: Visão Geral, Posicionamento, Tom de Voz, Público-Alvo, Presença Digital, Pontos-Chave.`
          }],
          systemPrompt: "Você é um especialista em branding. Gere documentos de contexto completos e bem estruturados.",
        },
      });

      if (error) throw error;
      if (data) {
        const reader = data.getReader();
        const decoder = new TextDecoder();
        let result = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
              try {
                const json = JSON.parse(line.slice(6));
                result += json.choices?.[0]?.delta?.content || "";
              } catch {}
            }
          }
        }
        setContextNotes(result);
        markChanged();
        toast({ title: "Contexto regenerado com IA" });
      }
    } catch {
      toast({ title: "Erro ao regenerar contexto", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const addTemplate = () => {
    if (templateInput.trim() && !functionTemplates.includes(templateInput.trim())) {
      setFunctionTemplates([...functionTemplates, templateInput.trim()]);
      setTemplateInput("");
      markChanged();
    }
  };

  const removeTemplate = (template: string) => {
    setFunctionTemplates(functionTemplates.filter(t => t !== template));
    markChanged();
  };

  const handleAddWebsite = async () => {
    if (!newWebsite.trim()) return;
    try {
      await addWebsite.mutateAsync(newWebsite);
      setNewWebsite("");
    } catch (error) {
      console.error("Error adding website:", error);
    }
  };

  const handleSubmit = async () => {
    await updateClient.mutateAsync({
      id: client.id,
      name,
      description: description || null,
      context_notes: contextNotes || null,
      identity_guide: identityGuide || null,
      avatar_url: avatarUrl,
      social_media: socialMedia,
      tags: tags,
      function_templates: functionTemplates,
    });

    setHasChanges(false);
    onClose();
  };

  // Calculate completeness
  const calculateCompleteness = () => {
    let filled = 0;
    let total = 15;
    
    const isFilledString = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
    
    if (name.trim()) filled++;
    if (description.trim()) filled++;
    if (avatarUrl) filled++;
    if (identityGuide.trim()) filled++;
    if (contextNotes.trim()) filled++;
    if (Object.values(socialMedia).filter(isFilledString).length >= 2) filled++;
    if (Object.values(tags).filter(isFilledString).length >= 3) filled++;
    if (websites && websites.length > 0) filled++;
    if (functionTemplates.length > 0) filled++;
    
    // Count individual important fields
    if (isFilledString(socialMedia.website)) filled++;
    if (isFilledString(socialMedia.instagram)) filled++;
    if (isFilledString(tags.segment)) filled++;
    if (isFilledString(tags.tone)) filled++;
    if (isFilledString(tags.audience)) filled++;
    if (isFilledString(tags.objectives)) filled++;
    
    return Math.round((filled / total) * 100);
  };

  const completeness = calculateCompleteness();

  const getSectionStatus = (items: boolean[]) => {
    const filled = items.filter(Boolean).length;
    const total = items.length;
    if (filled === 0) return { status: "empty", text: "Não preenchido" };
    if (filled === total) return { status: "complete", text: "Completo" };
    return { status: "partial", text: `${filled}/${total}` };
  };

  return (
    <div className="space-y-6">
      {/* Header with completeness */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AvatarUpload
            currentUrl={avatarUrl}
            onUpload={(url) => { setAvatarUrl(url); markChanged(); }}
            fallback={name.charAt(0) || "C"}
            size="md"
            bucket="client-files"
            folder="client-avatars"
          />
          <div>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); markChanged(); }}
              className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
              placeholder="Nome do cliente"
            />
            <div className="flex items-center gap-2 mt-1">
              {autoSaveStatus === "saving" && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Salvando...
                </Badge>
              )}
              {autoSaveStatus === "saved" && (
                <Badge variant="outline" className="gap-1 text-xs text-green-600">
                  <Check className="h-3 w-3" />
                  Salvo
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Perfil Completo</div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  completeness >= 80 ? "bg-green-500" : completeness >= 50 ? "bg-yellow-500" : "bg-orange-500"
                )}
                style={{ width: `${completeness}%` }}
              />
            </div>
            <span className="text-sm font-medium">{completeness}%</span>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <Accordion type="multiple" defaultValue={["profile", "digital", "assets"]} className="space-y-4">
        
        {/* SECTION 1: Perfil & Identidade */}
        <AccordionItem value="profile" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">Perfil & Identidade</div>
                <div className="text-xs text-muted-foreground">
                  Informações básicas, posicionamento e guia de identidade
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Informações Básicas
              </h4>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); markChanged(); }}
                  placeholder="Breve descrição do cliente..."
                  rows={3}
                />
              </div>
            </div>

            {/* Tags / Positioning */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Posicionamento
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tagFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <field.icon className="h-4 w-4 text-muted-foreground" />
                      {field.label}
                    </Label>
                    {field.multiline ? (
                      <Textarea
                        value={tags[field.key] || ""}
                        onChange={(e) => { setTags({ ...tags, [field.key]: e.target.value }); markChanged(); }}
                        placeholder={field.placeholder}
                        rows={2}
                      />
                    ) : (
                      <Input
                        value={tags[field.key] || ""}
                        onChange={(e) => { setTags({ ...tags, [field.key]: e.target.value }); markChanged(); }}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Identity Guide */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  Guia de Identidade
                </h4>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={loadGuideFromFolder} disabled={isLoadingGuide}>
                    {isLoadingGuide ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    <span className="ml-1">Importar</span>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleRegenerateContext} disabled={isRegenerating}>
                    {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-1">Regenerar</span>
                  </Button>
                </div>
              </div>
              <Textarea
                value={identityGuide}
                onChange={(e) => { setIdentityGuide(e.target.value); markChanged(); }}
                placeholder="# Posicionamento&#10;...&#10;# Tom de Voz&#10;..."
                rows={8}
                className="font-mono text-sm"
              />
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Documento de Contexto (gerado por IA)</Label>
                <Textarea
                  value={contextNotes}
                  onChange={(e) => { setContextNotes(e.target.value); markChanged(); }}
                  placeholder="Contexto gerado automaticamente..."
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 2: Presença Digital */}
        <AccordionItem value="digital" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <div className="font-medium">Presença Digital</div>
                <div className="text-xs text-muted-foreground">
                  Redes sociais, websites e integrações de API
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6">
            {/* Social Media */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Redes Sociais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {socialMediaFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <field.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <Input
                        value={socialMedia[field.key] || ""}
                        onChange={(e) => { setSocialMedia({ ...socialMedia, [field.key]: e.target.value }); markChanged(); }}
                        placeholder={field.placeholder}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Websites */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Websites para Indexar</h4>
              <div className="flex gap-2">
                <Input
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://exemplo.com"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddWebsite())}
                />
                <Button type="button" onClick={handleAddWebsite} disabled={addWebsite.isPending || !newWebsite.trim()}>
                  {addWebsite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              {websites && websites.length > 0 && (
                <div className="space-y-2">
                  {websites.map((site) => (
                    <div key={site.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{site.url}</span>
                        {site.last_scraped_at && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Extraído
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWebsite.mutate(site.id)}
                        disabled={deleteWebsite.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* API Integrations */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Plug className="h-4 w-4 text-muted-foreground" />
                Integrações de API (Publicação Automática)
              </h4>
              <SocialIntegrationsTab clientId={client.id} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 3: Assets & Recursos */}
        <AccordionItem value="assets" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <div className="font-medium">Assets & Recursos</div>
                <div className="text-xs text-muted-foreground">
                  Identidade visual, referências, documentos e templates
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6">
            {/* Brand Assets */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                Identidade Visual
              </h4>
              <BrandAssetsEditor clientId={client.id} clientName={client.name} websiteUrl={socialMedia.website} />
            </div>

            {/* Visual References */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                Referências Visuais
              </h4>
              <VisualReferencesManager clientId={client.id} />
            </div>

            {/* Documents */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Documentos
              </h4>
              <ClientDocumentsManager clientId={client.id} />
            </div>

            {/* Templates */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Templates de Conteúdo
              </h4>
              <p className="text-xs text-muted-foreground">
                Defina contextos de funções que você costuma realizar para este cliente
              </p>
              <div className="flex gap-2">
                <Textarea
                  value={templateInput}
                  onChange={(e) => setTemplateInput(e.target.value)}
                  placeholder="Ex: Criar posts para Instagram seguindo a identidade visual..."
                  rows={2}
                />
                <Button type="button" onClick={addTemplate} size="icon" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {functionTemplates.length > 0 && (
                <div className="space-y-2">
                  {functionTemplates.map((template, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-muted p-3 rounded">
                      <p className="text-sm flex-1">{template}</p>
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-6 w-6" onClick={() => removeTemplate(template)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>

      {/* Footer */}
      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!name.trim()}>
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
