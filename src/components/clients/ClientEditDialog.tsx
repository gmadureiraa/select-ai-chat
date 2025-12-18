import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClients, Client } from "@/hooks/useClients";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, X, FileText, Loader2, Globe, Instagram, Twitter, 
  Linkedin, Youtube, Mail, Megaphone, Trash2, RefreshCw, Check,
  Building, MessageSquare, Users, Target, Hash, Eye, Award, TrendingUp,
  Palette
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ClientDocumentsManager } from "./ClientDocumentsManager";
import { BrandAssetsEditor } from "./BrandAssetsEditor";
import { VisualReferencesManager } from "./VisualReferencesManager";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";

interface ClientEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
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

export const ClientEditDialog = ({ open, onOpenChange, client }: ClientEditDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [identityGuide, setIdentityGuide] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Record<string, string>>({});
  const [functionTemplates, setFunctionTemplates] = useState<string[]>([]);
  const [templateInput, setTemplateInput] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  
  const { updateClient } = useClients();
  const { websites, addWebsite, deleteWebsite } = useClientWebsites(client?.id || "");
  const { toast } = useToast();

  // Form data for debounce
  const formData = { name, description, contextNotes, identityGuide, avatarUrl, socialMedia, tags, functionTemplates };
  const debouncedFormData = useDebounce(formData, 3000);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setDescription(client.description || "");
      setContextNotes(client.context_notes || "");
      setIdentityGuide((client as any).identity_guide || "");
      setAvatarUrl(client.avatar_url || null);
      setSocialMedia(client.social_media as Record<string, string> || {});
      setTags(client.tags as Record<string, string> || {});
      setFunctionTemplates((client.function_templates as string[]) || []);
      setHasChanges(false);
    }
  }, [client]);

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
    if (!client) return;
    
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
    if (!client) return;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Editar Cliente</DialogTitle>
              <DialogDescription>
                Atualize as informações e contexto do cliente
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
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
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="identity">Identidade</TabsTrigger>
              <TabsTrigger value="brand" className="flex items-center gap-1">
                <Palette className="h-3 w-3" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="social">Redes</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
              <TabsTrigger value="websites">Websites</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
              <TabsTrigger value="templates">Padrões</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="flex items-start gap-6">
                <AvatarUpload
                  currentUrl={avatarUrl}
                  onUpload={(url) => { setAvatarUrl(url); markChanged(); }}
                  fallback={name.charAt(0) || "C"}
                  size="lg"
                  bucket="client-files"
                  folder="client-avatars"
                />
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Cliente *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); markChanged(); }}
                      placeholder="Ex: Empresa XYZ"
                      required
                    />
                  </div>
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
              </div>
            </TabsContent>

            <TabsContent value="identity" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Guia de Identidade e Posicionamento</Label>
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
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Documento de Contexto (IA)</Label>
                <Textarea
                  value={contextNotes}
                  onChange={(e) => { setContextNotes(e.target.value); markChanged(); }}
                  placeholder="Contexto gerado automaticamente..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="brand" className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Identidade Visual da Marca</h4>
                <p className="text-xs text-muted-foreground">
                  Configure logo, cores, tipografia e estilo visual. Essas informações serão usadas para melhorar as gerações de imagem com IA.
                </p>
              </div>
              
              {client && (
                <>
                  <BrandAssetsEditor clientId={client.id} clientName={client.name} />
                  
                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium mb-4">Referências Visuais</h4>
                    <VisualReferencesManager clientId={client.id} />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
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
            </TabsContent>

            <TabsContent value="tags" className="space-y-4">
              {tagFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label className="flex items-center gap-2">
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
            </TabsContent>

            <TabsContent value="websites" className="space-y-4">
              <div className="space-y-2">
                <Label>Adicionar Website</Label>
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
                <p className="text-xs text-muted-foreground">
                  URLs serão automaticamente extraídas e indexadas para contexto
                </p>
              </div>
              {websites && websites.length > 0 && (
                <div className="space-y-2">
                  <Label>Websites Cadastrados</Label>
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
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              {client && <ClientDocumentsManager clientId={client.id} />}
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="space-y-2">
                <Label>Funções/Padrões Recorrentes</Label>
                <p className="text-xs text-muted-foreground">
                  Defina contextos de funções que você costuma realizar para este cliente
                </p>
                <div className="flex gap-2">
                  <Textarea
                    value={templateInput}
                    onChange={(e) => setTemplateInput(e.target.value)}
                    placeholder="Ex: Criar posts para Instagram seguindo a identidade visual..."
                    rows={3}
                  />
                  <Button type="button" onClick={addTemplate} size="icon" className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {functionTemplates.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-sm font-medium">Padrões Definidos:</p>
                    {functionTemplates.map((template, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-muted p-3 rounded">
                        <p className="text-sm flex-1">{template}</p>
                        <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeTemplate(template)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
