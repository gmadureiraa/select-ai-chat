import { useState } from "react";
import { Settings, Save, Trash2, Globe, Instagram, Twitter, Linkedin, Youtube, FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useClients, Client } from "@/hooks/useClients";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { ClientDocumentsManager } from "@/components/clients/ClientDocumentsManager";
import { toast } from "sonner";

interface KaiSettingsTabProps {
  clientId: string;
  client: Client;
}

export const KaiSettingsTab = ({ clientId, client }: KaiSettingsTabProps) => {
  const { updateClient, deleteClient } = useClients();
  const { documents } = useClientDocuments(clientId);
  const { websites } = useClientWebsites(clientId);

  const [formData, setFormData] = useState({
    name: client.name,
    description: client.description || "",
    identity_guide: client.identity_guide || "",
    context_notes: client.context_notes || "",
    social_media: client.social_media || {},
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateClient.mutateAsync({
        id: clientId,
        ...formData,
      });
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

  const socialMediaFields = [
    { key: "website", label: "Website", icon: Globe, placeholder: "https://..." },
    { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "@usuario" },
    { key: "twitter", label: "X/Twitter", icon: Twitter, placeholder: "@usuario" },
    { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/..." },
    { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "@canal" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Configurações do Cliente</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="identity">Identidade</TabsTrigger>
          <TabsTrigger value="social">Redes Sociais</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição do cliente e seu negócio"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Notas de Contexto</Label>
                <Textarea
                  value={formData.context_notes}
                  onChange={(e) => setFormData({ ...formData, context_notes: e.target.value })}
                  placeholder="Notas importantes, objetivos, público-alvo, etc."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Identity Guide */}
        <TabsContent value="identity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Guia de Identidade</CardTitle>
              <CardDescription>
                Documentação completa de posicionamento, tom de voz e estratégia de conteúdo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.identity_guide}
                onChange={(e) => setFormData({ ...formData, identity_guide: e.target.value })}
                placeholder="# Posicionamento&#10;...&#10;&#10;# Tom de Voz&#10;...&#10;&#10;# Estratégia de Conteúdo&#10;..."
                rows={20}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Redes Sociais</CardTitle>
              <CardDescription>
                Links e handles das redes sociais do cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {socialMediaFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <field.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
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

          {/* Websites */}
          {websites && websites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Websites Indexados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {websites.map((website) => (
                    <div key={website.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm truncate">{website.url}</span>
                      <Badge variant="outline" className="text-xs">
                        {website.last_scraped_at ? "Indexado" : "Pendente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="space-y-4">
          <ClientDocumentsManager clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
