import { useState, useEffect } from "react";
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
  Building, MessageSquare, Users, Target, Plug, FileText
} from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { SocialIntegrationsTab } from "./SocialIntegrationsTab";
import { ClientReferencesManager } from "./ClientReferencesManager";
import { ClientDocumentsManager } from "./ClientDocumentsManager";
import { VisualReferencesManager } from "./VisualReferencesManager";
import { Client, useClients } from "@/hooks/useClients";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

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
  const [name, setName] = useState(client.name);
  const [description, setDescription] = useState(client.description || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(client.avatar_url || null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>(
    client.social_media as Record<string, string> || {}
  );
  const [tags, setTags] = useState<Record<string, string>>(
    client.tags as Record<string, string> || {}
  );
  
  const { updateClient } = useClients();
  const { websites } = useClientWebsites(client.id);
  const { toast } = useToast();

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

  return (
    <div className="space-y-6">
      {/* Header with avatar and name */}
      <div className="flex items-center gap-4">
        <AvatarUpload
          currentUrl={avatarUrl}
          onUpload={(url) => { setAvatarUrl(url); markChanged(); }}
          fallback={name.charAt(0) || "C"}
          size="md"
          bucket="client-files"
          folder="client-avatars"
        />
        <div className="flex-1">
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

      {/* Simplified Tabs: 4 instead of 7 */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="text-xs gap-1">
            <User className="h-3.5 w-3.5" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="digital" className="text-xs gap-1">
            <Globe className="h-3.5 w-3.5" />
            Presença Digital
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs gap-1">
            <FileText className="h-3.5 w-3.5" />
            Referências
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs gap-1">
            <Plug className="h-3.5 w-3.5" />
            Integrações
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
        <TabsContent value="references" className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
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
          <SocialIntegrationsTab clientId={client.id} />
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
