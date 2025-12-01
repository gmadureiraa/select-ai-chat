import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Image, Zap } from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const Assistant = () => {
  const navigate = useNavigate();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["templates", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from("client_templates")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const handleStartChat = (templateId?: string) => {
    if (!selectedClientId) return;
    const url = templateId
      ? `/chat/${selectedClientId}?templateId=${templateId}`
      : `/chat/${selectedClientId}`;
    navigate(url);
  };

  const chatTemplates = templates?.filter((t) => t.type === "chat") || [];
  const imageTemplates = templates?.filter((t) => t.type === "image") || [];
  const automationTemplates = templates?.filter((t) => t.type === "automation") || [];

  return (
    <div className="container max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <img src={kaleidosLogo} alt="kAI" className="h-8 w-8" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Assistente kAI
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecione um cliente e escolha um template para começar a criar conteúdo
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Clientes */}
        <Card className="p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold mb-4 uppercase tracking-wide text-muted-foreground">
            Clientes
          </h2>
          {isLoadingClients ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-2">
                {clients?.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedClientId === client.id
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card/50 border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{client.name}</div>
                    {client.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {client.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Templates e Ações */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedClientId ? (
            <div className="flex items-center justify-center h-[600px] text-center">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Selecione um cliente para ver os templates disponíveis
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Livre */}
              <Card className="p-6 bg-card/50">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Chat Livre</h3>
                    <p className="text-sm text-muted-foreground">
                      Converse sem template específico
                    </p>
                  </div>
                  <Button onClick={() => handleStartChat()} className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Iniciar
                  </Button>
                </div>
              </Card>

              {/* Templates de Chat */}
              {chatTemplates.length > 0 && (
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    Templates de Chat
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {chatTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleStartChat(template.id)}
                        className="p-4 border rounded-lg bg-card/50 hover:bg-muted/50 transition-all text-left"
                      >
                        <div className="font-medium text-sm mb-1">
                          {template.name}
                        </div>
                        {template.rules && (
                          <div className="text-xs text-muted-foreground">
                            {Object.keys(template.rules).length} regras configuradas
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Templates de Imagem */}
              {imageTemplates.length > 0 && (
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <Image className="h-4 w-4" />
                    Geração de Imagens
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {imageTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() =>
                          navigate(`/client/${selectedClientId}/image-gen?templateId=${template.id}`)
                        }
                        className="p-4 border rounded-lg bg-card/50 hover:bg-muted/50 transition-all text-left"
                      >
                        <div className="font-medium text-sm mb-1">
                          {template.name}
                        </div>
                        {template.rules && (
                          <div className="text-xs text-muted-foreground">
                            {Object.keys(template.rules).length} regras configuradas
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Templates de Automação */}
              {automationTemplates.length > 0 && (
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    Automações
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {automationTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 border rounded-lg bg-card/50 text-left"
                      >
                        <div className="font-medium text-sm mb-1">
                          {template.name}
                        </div>
                        {template.rules && (
                          <div className="text-xs text-muted-foreground">
                            Automação configurada
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Mensagem se não houver templates */}
              {chatTemplates.length === 0 &&
                imageTemplates.length === 0 &&
                automationTemplates.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Nenhum template configurado para este cliente</p>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Assistant;
