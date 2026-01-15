import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Settings, Save, Trash2, Globe, Instagram, Twitter, Linkedin, Youtube, 
  FileText, BookOpen, Sparkles, Loader2, RefreshCw, Palette, Target, 
  Users, MessageSquare, Hash, Building, Mail, Phone, MapPin, Calendar,
  TrendingUp, Award, Megaphone, Eye, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useClients, Client } from "@/hooks/useClients";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { ClientCompletenessIndicator } from "@/components/kai/ClientCompletenessIndicator";
import { useDebounce } from "@/hooks/useDebounce";

import { ClientDocumentsManager } from "@/components/clients/ClientDocumentsManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KaiSettingsTabProps {
  clientId: string;
  client: Client;
}

export const KaiSettingsTab = ({ clientId, client }: KaiSettingsTabProps) => {
  const { updateClient, deleteClient } = useClients();
  const { documents } = useClientDocuments(clientId);
  const { websites, addWebsite, deleteWebsite } = useClientWebsites(clientId);
  

  const [formData, setFormData] = useState({
    name: client.name,
    description: client.description || "",
    identity_guide: client.identity_guide || "",
    context_notes: client.context_notes || "",
    social_media: client.social_media || {},
    tags: client.tags || {},
  });

  const [newWebsite, setNewWebsite] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeSettingsTab, setActiveSettingsTab] = useState("general");
  
  // Debounced form data for auto-save
  const debouncedFormData = useDebounce(formData, 3000);

  // Update form when client changes
  useEffect(() => {
    setFormData({
      name: client.name,
      description: client.description || "",
      identity_guide: client.identity_guide || "",
      context_notes: client.context_notes || "",
      social_media: client.social_media || {},
      tags: client.tags || {},
    });
    setHasUnsavedChanges(false);
  }, [client]);

  // Track changes
  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  // Auto-save effect
  useEffect(() => {
    if (hasUnsavedChanges && debouncedFormData) {
      const autoSave = async () => {
        setAutoSaveStatus("saving");
        try {
          await updateClient.mutateAsync({
            id: clientId,
            ...debouncedFormData,
          });
          setAutoSaveStatus("saved");
          setHasUnsavedChanges(false);
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        } catch (error) {
          console.error("Auto-save failed:", error);
          setAutoSaveStatus("idle");
        }
      };
      autoSave();
    }
  }, [debouncedFormData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateClient.mutateAsync({
        id: clientId,
        ...formData,
      });
      setHasUnsavedChanges(false);
      toast.success("Cliente atualizado com sucesso");
    } catch (error) {
      toast.error("Erro ao atualizar cliente");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      await deleteClient.mutateAsync(clientId);
      toast.success("Cliente excluído com sucesso");
      window.location.href = "/kai";
    } catch (error) {
      toast.error("Erro ao excluir cliente");
    }
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

  const handleRegenerateContext = async () => {
    setIsRegenerating(true);
    try {
      // Regenerate client context using AI
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{
            role: "user",
            content: `Analise todas as informações do cliente "${client.name}" e gere um documento completo de contexto em markdown, incluindo:
            
- Descrição: ${formData.description}
- Tags: ${JSON.stringify(formData.tags)}
- Redes Sociais: ${JSON.stringify(formData.social_media)}
- Websites cadastrados: ${websites?.map(w => w.url).join(", ")}
- Documentos: ${documents?.map(d => d.name).join(", ")}

Estruture o documento com seções para: Visão Geral, Posicionamento, Tom de Voz, Público-Alvo, Presença Digital, Pontos-Chave para Conteúdo.`
          }],
          systemPrompt: "Você é um especialista em branding e marketing digital. Gere documentos de contexto completos e bem estruturados para perfis.",
        },
      });

      if (error) throw error;

      // Parse streaming response
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

        setFormData(prev => ({ ...prev, context_notes: result }));
        toast.success("Contexto regenerado com IA");
      }
    } catch (error) {
      console.error("Error regenerating context:", error);
      toast.error("Erro ao regenerar contexto");
    } finally {
      setIsRegenerating(false);
    }
  };

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
    { key: "tone", label: "Tom de Voz", icon: MessageSquare, placeholder: "Ex: Profissional, Descontraído, Inspirador" },
    { key: "audience", label: "Público-Alvo", icon: Users, placeholder: "Descrição do público principal" },
    { key: "objectives", label: "Objetivos", icon: Target, placeholder: "Principais metas e objetivos" },
    { key: "keywords", label: "Palavras-Chave", icon: Hash, placeholder: "Separadas por vírgula" },
    { key: "competitors", label: "Concorrentes", icon: Eye, placeholder: "Principais concorrentes" },
    { key: "differentials", label: "Diferenciais", icon: Award, placeholder: "O que diferencia o cliente" },
    { key: "content_pillars", label: "Pilares de Conteúdo", icon: TrendingUp, placeholder: "Temas principais" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Configurações do Cliente</h2>
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerateContext} disabled={isRegenerating}>
            {isRegenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Regenerar Contexto
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Completeness Indicator */}
      <ClientCompletenessIndicator
        client={client}
        documentsCount={documents?.length || 0}
        websitesCount={websites?.length || 0}
        onNavigateToTab={setActiveSettingsTab}
      />

      <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="brand">Marca</TabsTrigger>
          <TabsTrigger value="social">Redes</TabsTrigger>
          <TabsTrigger value="websites">Websites</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => updateFormData({ name: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Input
                    value={(formData.tags as any)?.segment || ""}
                    onChange={(e) => updateFormData({
                      tags: { ...formData.tags, segment: e.target.value },
                    })}
                    placeholder="Ex: E-commerce, SaaS"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Breve descrição do cliente e seu negócio"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estratégia e Posicionamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tagFields.slice(0, 4).map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <field.icon className="h-4 w-4 text-muted-foreground" />
                    {field.label}
                  </Label>
                  {field.key === "objectives" || field.key === "audience" ? (
                    <Textarea
                      value={(formData.tags as any)?.[field.key] || ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        tags: { ...formData.tags, [field.key]: e.target.value },
                      })}
                      placeholder={field.placeholder}
                      rows={2}
                    />
                  ) : (
                    <Input
                      value={(formData.tags as any)?.[field.key] || ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        tags: { ...formData.tags, [field.key]: e.target.value },
                      })}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diferenciação e Conteúdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tagFields.slice(4).map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <field.icon className="h-4 w-4 text-muted-foreground" />
                    {field.label}
                  </Label>
                  <Textarea
                    value={(formData.tags as any)?.[field.key] || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      tags: { ...formData.tags, [field.key]: e.target.value },
                    })}
                    placeholder={field.placeholder}
                    rows={2}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brand Identity */}
        <TabsContent value="brand" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Guia de Identidade
              </CardTitle>
              <CardDescription>
                Documentação completa de posicionamento, tom de voz e estratégia de conteúdo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.identity_guide}
                onChange={(e) => setFormData({ ...formData, identity_guide: e.target.value })}
                placeholder="# Posicionamento&#10;...&#10;&#10;# Tom de Voz&#10;...&#10;&#10;# Paleta de Cores&#10;...&#10;&#10;# Tipografia&#10;..."
                rows={20}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documento de Contexto (Gerado por IA)
              </CardTitle>
              <CardDescription>
                Documento gerado automaticamente com base em todas as informações do cliente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.context_notes}
                onChange={(e) => setFormData({ ...formData, context_notes: e.target.value })}
                placeholder="O documento de contexto será gerado automaticamente..."
                rows={15}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Redes Sociais e Presença Digital</CardTitle>
              <CardDescription>
                Links e handles das redes sociais do cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {socialMediaFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <field.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">{field.label}</Label>
                    <Input
                      value={(formData.social_media as any)?.[field.key] || ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        social_media: {
                          ...formData.social_media,
                          [field.key]: e.target.value,
                        },
                      })}
                      placeholder={field.placeholder}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Canais de Performance</CardTitle>
              <CardDescription>
                Desative os canais que não são utilizados por este cliente para ocultar das métricas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "instagram", label: "Instagram", icon: Instagram },
                { key: "youtube", label: "YouTube", icon: Eye },
                { key: "twitter", label: "X/Twitter", icon: Twitter },
                { key: "newsletter", label: "Newsletter", icon: Mail },
                { key: "meta_ads", label: "Meta Ads", icon: Megaphone },
              ].map((channel) => {
                const archivedChannels = (formData.social_media as any)?.archived_channels || [];
                const isArchived = archivedChannels.includes(channel.key);
                
                return (
                  <div key={channel.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <channel.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">{channel.label}</span>
                    </div>
                    <Switch
                      checked={!isArchived}
                      onCheckedChange={(checked) => {
                        const currentArchived = (formData.social_media as any)?.archived_channels || [];
                        const newArchived = checked
                          ? currentArchived.filter((c: string) => c !== channel.key)
                          : [...currentArchived, channel.key];
                        setFormData({
                          ...formData,
                          social_media: {
                            ...formData.social_media,
                            archived_channels: newArchived,
                          },
                        });
                      }}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Websites */}
        <TabsContent value="websites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Websites Indexados</CardTitle>
              <CardDescription>
                Websites que são automaticamente extraídos para contexto do cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://exemplo.com"
                  onKeyPress={(e) => e.key === "Enter" && handleAddWebsite()}
                />
                <Button onClick={handleAddWebsite} disabled={addWebsite.isPending}>
                  {addWebsite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                </Button>
              </div>

              {websites && websites.length > 0 ? (
                <div className="space-y-2">
                  {websites.map((website) => (
                    <div key={website.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{website.url}</p>
                        <p className="text-xs text-muted-foreground">
                          {website.last_scraped_at 
                            ? `Indexado em ${new Date(website.last_scraped_at).toLocaleDateString()}`
                            : "Aguardando indexação"
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={website.last_scraped_at ? "default" : "outline"}>
                          {website.last_scraped_at ? "Indexado" : "Pendente"}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteWebsite.mutate(website.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum website indexado</p>
                  <p className="text-xs">Adicione websites para extrair contexto automaticamente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="space-y-4">
          <ClientDocumentsManager clientId={clientId} />
        </TabsContent>

      </Tabs>
    </div>
  );
};