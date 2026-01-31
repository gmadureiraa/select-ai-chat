import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, Loader2, Globe, Instagram, Twitter, 
  Linkedin, Youtube, Mail, Megaphone, Check,
  Building, MessageSquare, Users, Target, Plug, FileText, Sparkles, Lock, Brain
} from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { SocialIntegrationsTab } from "./SocialIntegrationsTab";
import { ClientReferencesManager } from "./ClientReferencesManager";
import { ClientDocumentsManager } from "./ClientDocumentsManager";
import { VisualReferencesManager } from "./VisualReferencesManager";
import { AIContextTab } from "./AIContextTab";
import { Client, useClients } from "@/hooks/useClients";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

interface ClientEditTabsSimplifiedProps {
  client: Client;
  onClose: () => void;
}

const socialMediaFields = [
  { key: "website", label: "Website", icon: Globe, placeholder: "https://..." },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
  { key: "twitter", label: "X/Twitter", icon: Twitter, placeholder: "@usuario" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  { key: "tiktok", label: "TikTok", icon: Megaphone, placeholder: "@usuario" },
];

export function ClientEditTabsSimplified({ client, onClose }: ClientEditTabsSimplifiedProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(client.avatar_url || null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasChanges, setHasChanges] = useState(false);
  const [identityGuide, setIdentityGuide] = useState(client.identity_guide || "");
  
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>(
    client.social_media as Record<string, string> || {}
  );
  const [tags, setTags] = useState<Record<string, string>>(
    client.tags as Record<string, string> || {}
  );
  
  const { updateClient } = useClients();
  const { websites } = useClientWebsites(client.id);
  const { documents } = useClientDocuments(client.id);
  const { toast } = useToast();
  const { isPro } = usePlanFeatures();

  // Form data for debounce
  const formData = { name, description, avatarUrl, socialMedia, tags };
  const debouncedFormData = useDebounce(formData, 2000);

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
            avatar_url: debouncedFormData.avatarUrl,
            social_media: debouncedFormData.socialMedia,
            tags: debouncedFormData.tags,
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

  const handleContextUpdate = (newContext: string) => {
    setIdentityGuide(newContext);
  };

  return (
    <div className="space-y-6">
      {/* Header with avatar and name - Enhanced */}
      <div className="flex items-start gap-6 pb-6 border-b border-border/50">
        <div className="relative">
          <AvatarUpload
            currentUrl={avatarUrl}
            onUpload={(url) => { setAvatarUrl(url); markChanged(); }}
            fallback={name.charAt(0) || "C"}
            size="lg"
            bucket="client-files"
            folder="client-avatars"
          />
          {/* Auto-save indicator on avatar */}
          {autoSaveStatus === "saving" && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            </div>
          )}
          {autoSaveStatus === "saved" && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); markChanged(); }}
            className="text-xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
            placeholder="Nome do cliente"
          />
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description || "Adicione uma descrição para este cliente..."}
          </p>
        </div>
      </div>

      {/* Simplified Tabs: 5 tabs with AI Context as final */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="text-xs gap-1">
            <User className="h-3.5 w-3.5" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="digital" className="text-xs gap-1">
            <Globe className="h-3.5 w-3.5" />
            Digital
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs gap-1">
            <FileText className="h-3.5 w-3.5" />
            Referências
          </TabsTrigger>
          <TabsTrigger 
            value="integrations" 
            className={cn("text-xs gap-1", !isPro && "opacity-50")}
            disabled={!isPro}
          >
            <Plug className="h-3.5 w-3.5" />
            Integrações
            {!isPro && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
          </TabsTrigger>
          <TabsTrigger value="ai-context" className="text-xs gap-1">
            <Brain className="h-3.5 w-3.5" />
            Contexto IA
          </TabsTrigger>
        </TabsList>

        {/* Tab: Perfil (merged Info + Positioning) */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sobre o Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); markChanged(); }}
                  placeholder="Breve descrição do cliente e seu negócio..."
                  rows={3}
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Público-Alvo
                </Label>
                <Textarea
                  value={tags.audience || ""}
                  onChange={(e) => { setTags({ ...tags, audience: e.target.value }); markChanged(); }}
                  placeholder="Descreva o público principal..."
                  rows={2}
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
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Presença Digital */}
        <TabsContent value="digital" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Redes Sociais</CardTitle>
              <CardDescription>Links para as redes sociais do cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {socialMediaFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <field.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={socialMedia[field.key] || ""}
                    onChange={(e) => { 
                      setSocialMedia({ ...socialMedia, [field.key]: e.target.value }); 
                      markChanged(); 
                    }}
                    placeholder={field.placeholder}
                    className="flex-1"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Referências (merged docs + references + visuals) */}
        <TabsContent value="references" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Documentos
              </CardTitle>
              <CardDescription>PDFs, apresentações e documentos do cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientDocumentsManager clientId={client.id} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
                Referências de Conteúdo
              </CardTitle>
              <CardDescription>Links, textos e inspirações para criação</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientReferencesManager clientId={client.id} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Referências Visuais
              </CardTitle>
              <CardDescription>Imagens de inspiração visual e identidade</CardDescription>
            </CardHeader>
            <CardContent>
              <VisualReferencesManager clientId={client.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Integrações */}
        <TabsContent value="integrations" className="mt-4">
          {isPro ? (
            <SocialIntegrationsTab clientId={client.id} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Lock className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold mb-2">Integrações PRO</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Conecte redes sociais e publique diretamente com o plano PRO.
              </p>
              <Button onClick={() => navigate('/settings?section=billing')}>
                Fazer upgrade
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Tab: AI Context - Final tab */}
        <TabsContent value="ai-context" className="mt-4">
          <AIContextTab
            clientId={client.id}
            identityGuide={identityGuide}
            clientUpdatedAt={client.updated_at}
            onContextUpdate={handleContextUpdate}
          />
        </TabsContent>
      </Tabs>

      {/* Footer actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
