import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, FileText, Loader2, Globe, Instagram, Twitter, 
  Linkedin, Youtube, Mail, Megaphone, Trash2, RefreshCw, Check,
  Building, MessageSquare, Users, Target, Hash, Eye, Award, TrendingUp,
  Palette, Plus, BookOpen, Brain, Plug, Image, BarChart3
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { SocialIntegrationsTab } from "./SocialIntegrationsTab";
import { ClientReferencesManager } from "./ClientReferencesManager";
import { ClientDocumentsManager } from "./ClientDocumentsManager";
import { BrandAssetsEditor } from "./BrandAssetsEditor";
import { VisualReferencesManager } from "./VisualReferencesManager";
import { Client, useClients } from "@/hooks/useClients";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ClientEditTabsProps {
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

export function ClientEditTabs({ client, onClose }: ClientEditTabsProps) {
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description || "");
  const [contextNotes, setContextNotes] = useState(client.context_notes || "");
  const [identityGuide, setIdentityGuide] = useState((client as any).identity_guide || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(client.avatar_url || null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [socialMedia, setSocialMedia] = useState<Record<string, any>>(client.social_media as Record<string, any> || {});
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

  // Calculate completeness per section
  const isFilledString = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
  
  const infoComplete = [name.trim(), description.trim(), avatarUrl].filter(Boolean).length;
  const positioningComplete = ['segment', 'tone', 'audience', 'objectives'].filter(k => isFilledString(tags[k])).length;
  const identityComplete = [identityGuide.trim(), contextNotes.trim()].filter(Boolean).length;
  const digitalComplete = Object.values(socialMedia).filter(isFilledString).length + (websites?.length || 0);

  const totalComplete = infoComplete + positioningComplete + identityComplete + digitalComplete;
  const totalFields = 3 + 4 + 2 + 8;
  const completeness = Math.round((totalComplete / totalFields) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="info" className="text-xs">
            <User className="h-3 w-3 mr-1" />
            Informações
          </TabsTrigger>
          <TabsTrigger value="positioning" className="text-xs">
            <Target className="h-3 w-3 mr-1" />
            Posicionamento
          </TabsTrigger>
          <TabsTrigger value="identity" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            Identidade
          </TabsTrigger>
          <TabsTrigger value="digital" className="text-xs">
            <Globe className="h-3 w-3 mr-1" />
            Presença Digital
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Referências
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs">
            <Plug className="h-3 w-3 mr-1" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="assets" className="text-xs">
            <Image className="h-3 w-3 mr-1" />
            Assets
          </TabsTrigger>
        </TabsList>

        {/* Tab: Informações */}
        <TabsContent value="info" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações Básicas</CardTitle>
              <CardDescription>Dados fundamentais do cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); markChanged(); }}
                  placeholder="Breve descrição do cliente e seu negócio..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    Segmento
                  </Label>
                  <Input
                    value={tags.segment || ""}
                    onChange={(e) => { setTags({ ...tags, segment: e.target.value }); markChanged(); }}
                    placeholder="Ex: E-commerce, SaaS"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Tom de Voz
                  </Label>
                  <Input
                    value={tags.tone || ""}
                    onChange={(e) => { setTags({ ...tags, tone: e.target.value }); markChanged(); }}
                    placeholder="Ex: Profissional, Descontraído"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Posicionamento */}
        <TabsContent value="positioning" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posicionamento Estratégico</CardTitle>
              <CardDescription>Defina o posicionamento e estratégia de conteúdo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Público-Alvo
                </Label>
                <Textarea
                  value={tags.audience || ""}
                  onChange={(e) => { setTags({ ...tags, audience: e.target.value }); markChanged(); }}
                  placeholder="Descreva o público principal..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Objetivos
                </Label>
                <Textarea
                  value={tags.objectives || ""}
                  onChange={(e) => { setTags({ ...tags, objectives: e.target.value }); markChanged(); }}
                  placeholder="Principais metas e objetivos..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    Palavras-Chave
                  </Label>
                  <Input
                    value={tags.keywords || ""}
                    onChange={(e) => { setTags({ ...tags, keywords: e.target.value }); markChanged(); }}
                    placeholder="Separadas por vírgula"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    Concorrentes
                  </Label>
                  <Input
                    value={tags.competitors || ""}
                    onChange={(e) => { setTags({ ...tags, competitors: e.target.value }); markChanged(); }}
                    placeholder="Principais concorrentes"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  Diferenciais
                </Label>
                <Textarea
                  value={tags.differentials || ""}
                  onChange={(e) => { setTags({ ...tags, differentials: e.target.value }); markChanged(); }}
                  placeholder="O que diferencia o cliente..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Pilares de Conteúdo
                </Label>
                <Textarea
                  value={tags.content_pillars || ""}
                  onChange={(e) => { setTags({ ...tags, content_pillars: e.target.value }); markChanged(); }}
                  placeholder="Temas principais de conteúdo..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Identidade */}
        <TabsContent value="identity" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Guia de Identidade</CardTitle>
                  <CardDescription>Manual de marca e comunicação</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={loadGuideFromFolder} disabled={isLoadingGuide}>
                    {isLoadingGuide ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    <span className="ml-1">Importar</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={identityGuide}
                onChange={(e) => { setIdentityGuide(e.target.value); markChanged(); }}
                placeholder="# Posicionamento&#10;...&#10;# Tom de Voz&#10;..."
                rows={12}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Contexto Gerado por IA
                  </CardTitle>
                  <CardDescription>Resumo automatizado do cliente</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleRegenerateContext} disabled={isRegenerating}>
                  {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-1">Regenerar</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={contextNotes}
                onChange={(e) => { setContextNotes(e.target.value); markChanged(); }}
                placeholder="Clique em 'Regenerar' para gerar automaticamente com IA..."
                rows={8}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Presença Digital */}
        <TabsContent value="digital" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Redes Sociais</CardTitle>
              <CardDescription>Links e perfis nas redes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {socialMediaFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <field.icon className="h-4 w-4 text-muted-foreground" />
                      {field.label}
                    </Label>
                    <Input
                      value={socialMedia[field.key] || ""}
                      onChange={(e) => { setSocialMedia({ ...socialMedia, [field.key]: e.target.value }); markChanged(); }}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Channels Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Canais de Performance
              </CardTitle>
              <CardDescription>Escolha quais canais aparecem no dashboard de performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "instagram", label: "Instagram", icon: Instagram },
                  { key: "youtube", label: "YouTube", icon: Youtube },
                  { key: "twitter", label: "X/Twitter", icon: Twitter },
                  { key: "newsletter", label: "Newsletter", icon: Mail },
                  { key: "tiktok", label: "TikTok", icon: Megaphone },
                  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
                  { key: "meta_ads", label: "Meta Ads", icon: Megaphone },
                ].map((channel) => {
                  const archivedChannels = (socialMedia as any)?.archived_channels || [];
                  const isArchived = archivedChannels.includes(channel.key);
                  
                  return (
                    <div key={channel.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <channel.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{channel.label}</span>
                      </div>
                      <Switch
                        checked={!isArchived}
                        onCheckedChange={(checked) => {
                          const currentArchived = (socialMedia as any)?.archived_channels || [];
                          const newArchived = checked
                            ? currentArchived.filter((c: string) => c !== channel.key)
                            : [...currentArchived, channel.key];
                          setSocialMedia({
                            ...socialMedia,
                            archived_channels: newArchived,
                          });
                          markChanged();
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Websites para Indexar</CardTitle>
              <CardDescription>URLs que serão analisadas para contexto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://exemplo.com"
                  className="flex-1"
                />
                <Button 
                  onClick={handleAddWebsite} 
                  disabled={addWebsite.isPending || !newWebsite.trim()}
                  size="sm"
                >
                  {addWebsite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {websites && websites.length > 0 && (
                <div className="space-y-2">
                  {websites.map((website) => (
                    <div key={website.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="text-sm truncate flex-1">{website.url}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWebsite.mutate(website.id)}
                        disabled={deleteWebsite.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Referências */}
        <TabsContent value="references" className="mt-4">
          <ClientReferencesManager clientId={client.id} />
        </TabsContent>

        {/* Tab: Integrações */}
        <TabsContent value="integrations" className="mt-4">
          <SocialIntegrationsTab clientId={client.id} />
        </TabsContent>

        {/* Tab: Assets */}
        <TabsContent value="assets" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Identidade Visual
              </CardTitle>
              <CardDescription>Cores, fontes e logos</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandAssetsEditor clientId={client.id} clientName={client.name} websiteUrl={socialMedia.website} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Referências Visuais</CardTitle>
              <CardDescription>Imagens de referência para estilo</CardDescription>
            </CardHeader>
            <CardContent>
              <VisualReferencesManager clientId={client.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos</CardTitle>
              <CardDescription>PDFs, apresentações e outros arquivos</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientDocumentsManager clientId={client.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSubmit} disabled={updateClient.isPending}>
          {updateClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
