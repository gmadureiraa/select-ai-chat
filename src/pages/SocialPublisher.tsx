import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Twitter, Linkedin, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  error?: string;
}

const SocialPublisher = () => {
  const { clients, isLoading: clientsLoading } = useClients();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [content, setContent] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      toast.error("Digite o conteúdo para publicar");
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.error("Selecione pelo menos uma plataforma");
      return;
    }

    setIsPublishing(true);
    setPublishResults([]);

    const results: PublishResult[] = [];

    for (const platform of selectedPlatforms) {
      try {
        if (platform === "twitter") {
          const { data, error } = await supabase.functions.invoke('post-twitter', {
            body: {
              content: content.trim(),
              clientId: selectedClientId,
              clientName: selectedClient?.name
            }
          });

          if (error) throw error;
          
          results.push({
            platform: "Twitter/X",
            success: data.success,
            postId: data.postId,
            error: data.error
          });
        } else if (platform === "linkedin") {
          // LinkedIn será implementado após configurar as chaves
          results.push({
            platform: "LinkedIn",
            success: false,
            error: "LinkedIn ainda não configurado"
          });
        }
      } catch (error: any) {
        console.error(`Error publishing to ${platform}:`, error);
        results.push({
          platform: platform === "twitter" ? "Twitter/X" : "LinkedIn",
          success: false,
          error: error.message
        });
      }
    }

    setPublishResults(results);
    setIsPublishing(false);

    const successCount = results.filter(r => r.success).length;
    if (successCount === results.length) {
      toast.success("Conteúdo publicado com sucesso em todas as plataformas!");
      setContent("");
    } else if (successCount > 0) {
      toast.warning(`Publicado em ${successCount}/${results.length} plataformas`);
    } else {
      toast.error("Erro ao publicar em todas as plataformas");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <PageHeader
        title="Publicador Social"
        subtitle="Publique conteúdo diretamente no Twitter e LinkedIn dos seus clientes"
        backTo="/agents"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuração */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Novo Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seletor de Cliente */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Cliente (opcional)</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum cliente</SelectItem>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de Plataformas */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Plataformas</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={selectedPlatforms.includes("twitter") ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePlatform("twitter")}
                    className="gap-2"
                  >
                    <Twitter className="h-4 w-4" />
                    Twitter/X
                  </Button>
                  <Button
                    type="button"
                    variant={selectedPlatforms.includes("linkedin") ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePlatform("linkedin")}
                    className="gap-2"
                    disabled
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                    <Badge variant="secondary" className="text-xs">Em breve</Badge>
                  </Button>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Conteúdo</label>
                  <span className={`text-xs ${content.length > 280 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {content.length}/280
                  </span>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite o conteúdo para publicar..."
                  className="min-h-[150px] resize-none"
                />
              </div>

              {/* Botão Publicar */}
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !content.trim() || selectedPlatforms.length === 0}
                className="w-full gap-2"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Publicar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resultados */}
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {publishResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Os resultados da publicação aparecerão aqui
                </p>
              ) : (
                <div className="space-y-3">
                  {publishResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        result.success
                          ? 'border-green-500/30 bg-green-500/10'
                          : 'border-destructive/30 bg-destructive/10'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{result.platform}</p>
                        {result.success ? (
                          <p className="text-xs text-muted-foreground truncate">
                            ID: {result.postId}
                          </p>
                        ) : (
                          <p className="text-xs text-destructive truncate">
                            {result.error}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-6">
              <h4 className="font-medium mb-2">Dicas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Twitter: máximo 280 caracteres</li>
                <li>• LinkedIn: máximo 3000 caracteres</li>
                <li>• Use o Assistente kAI para gerar conteúdo</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SocialPublisher;
