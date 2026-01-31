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
  Building, MessageSquare, Users, Target, Plug, FileText, Sparkles, RefreshCw, Lock
} from "lucide-react";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { SocialIntegrationsTab } from "./SocialIntegrationsTab";
import { ClientReferencesManager } from "./ClientReferencesManager";
import { ClientDocumentsManager } from "./ClientDocumentsManager";
import { VisualReferencesManager } from "./VisualReferencesManager";
import { Client, useClients } from "@/hooks/useClients";
import { useClientWebsites } from "@/hooks/useClientWebsites";
import { useClientDocuments } from "@/hooks/useClientDocuments";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [contextNotes, setContextNotes] = useState(client.context_notes || "");
  
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

  // Generate AI context based on all client data
  const handleGenerateContext = async () => {
    setIsGeneratingContext(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [{
            role: "user",
            content: `Analise todas as informações do cliente "${name}" e gere um documento completo de contexto em markdown, incluindo:
            
- Descrição: ${description}
- Segmento: ${tags.segment || "Não informado"}
- Tom de Voz: ${tags.tone || "Não informado"}
- Público-Alvo: ${tags.audience || "Não informado"}
- Objetivos: ${tags.objectives || "Não informado"}
- Redes Sociais: ${JSON.stringify(socialMedia)}
- Websites cadastrados: ${websites?.map(w => w.url).join(", ") || "Nenhum"}
- Documentos: ${documents?.map(d => d.name).join(", ") || "Nenhum"}

Estruture o documento com seções para: Visão Geral, Posicionamento, Tom de Voz, Público-Alvo, Presença Digital, Pontos-Chave para Conteúdo.`
          }],
          systemPrompt: "Você é um especialista em branding e marketing digital. Gere documentos de contexto completos e bem estruturados para clientes. Seja conciso mas informativo.",
        },
      });

      if (error) throw error;

      // Parse response - handle both streaming and non-streaming cases
      if (data) {
        let result = "";
        
        // Check if it's a streaming response with body.getReader()
        if (data.body && typeof data.body.getReader === 'function') {
          const reader = data.body.getReader();
          const decoder = new TextDecoder();
          
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
        } else if (typeof data === 'string') {
          // Already parsed as string
          result = data;
        } else if (data.choices?.[0]?.message?.content) {
          // OpenAI-style non-streaming response
          result = data.choices[0].message.content;
        } else if (data.content) {
          // Simple content response
          result = data.content;
        }

        setContextNotes(result);
        
        // Save the generated context
        await updateClient.mutateAsync({
          id: client.id,
          context_notes: result,
        });
        
        toast({
          title: "Contexto gerado com IA!",
          description: "O contexto do cliente foi gerado e salvo automaticamente.",
        });
      }
    } catch (error) {
      console.error("Error generating context:", error);
      toast({
        title: "Erro ao gerar contexto",
        description: "Não foi possível gerar o contexto com IA.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingContext(false);
    }
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
          <TabsTrigger 
            value="integrations" 
            className={cn("text-xs gap-1", !isPro && "opacity-50")}
            disabled={!isPro}
          >
            <Plug className="h-3.5 w-3.5" />
            Integrações
            {!isPro && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
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

          {/* AI Context Generation */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Contexto com IA
                  </CardTitle>
                  <CardDescription>Gere um resumo completo do cliente usando IA</CardDescription>
                </div>
                <Button 
                  onClick={handleGenerateContext}
                  disabled={isGeneratingContext}
                  size="sm"
                  className="gap-2"
                >
                  {isGeneratingContext ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Gerar Contexto
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {contextNotes && (
              <CardContent>
                <div className="p-3 rounded-lg bg-background border text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {contextNotes}
                </div>
              </CardContent>
            )}
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
