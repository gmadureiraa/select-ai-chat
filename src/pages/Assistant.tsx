import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MessageSquare, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { TemplateManager } from "@/components/clients/TemplateManager";

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

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const handleStartChat = (templateId?: string) => {
    if (!selectedClientId) return;
    const url = templateId
      ? `/chat/${selectedClientId}?templateId=${templateId}`
      : `/chat/${selectedClientId}`;
    navigate(url);
  };

  const chatTemplates = templates?.filter((t) => t.type === "chat") || [];
  const imageTemplates = templates?.filter((t) => t.type === "image") || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={kaleidosLogo} alt="kAI" className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-semibold">Assistente kAI</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedClient ? selectedClient.name : "Selecione um cliente para começar"}
                </p>
              </div>
            </div>
            
            {/* Dropdown de seleção de cliente */}
            <Select value={selectedClientId || ""} onValueChange={setSelectedClientId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Cliente:" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div>
            {!selectedClientId ? (
              <div className="flex items-center justify-center h-[calc(100vh-300px)]">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Selecione um cliente no menu acima para ver os templates disponíveis
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header do Cliente */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">O que você quer fazer?</h2>
                    <p className="text-sm text-muted-foreground">
                      Escolha uma opção ou template para começar
                    </p>
                  </div>
                  <TemplateManager clientId={selectedClientId} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Chat Livre */}
                  <Card
                    className="p-4 border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer"
                    onClick={() => handleStartChat()}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <MessageSquare className="h-5 w-5 text-foreground" />
                      <div className="font-semibold text-base">Chat Livre</div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Converse livremente com a IA sobre qualquer assunto relacionado ao cliente
                    </p>
                  </Card>

                  {/* Templates de Chat */}
                  {chatTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="p-4 border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer"
                      onClick={() => handleStartChat(template.id)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <MessageSquare className="h-5 w-5 text-foreground" />
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-base">{template.name}</div>
                          <Badge variant="outline" className="text-xs">Chat</Badge>
                        </div>
                      </div>
                      {template.rules && Array.isArray(template.rules) && template.rules.length > 0 && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {(template.rules[0] as any).content}
                        </p>
                      )}
                    </Card>
                  ))}

                  {imageTemplates.map((template) => {
                    const rules = Array.isArray(template.rules) ? template.rules : [];
                    const ruleCount = rules.length;
                    return (
                      <Card
                        key={template.id}
                        className="p-4 border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer"
                        onClick={() =>
                          navigate(`/client/${selectedClientId}/image-gen?templateId=${template.id}`)
                        }
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Image className="h-5 w-5 text-foreground" />
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-base">{template.name}</div>
                            <Badge className="text-xs bg-[#ff006e] hover:bg-[#ff006e]/90">
                              Imagem
                            </Badge>
                          </div>
                        </div>
                        {ruleCount > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge className="text-xs bg-[#ff006e] hover:bg-[#ff006e]/90">
                              {ruleCount} {ruleCount === 1 ? 'regra' : 'regras'}
                            </Badge>
                            {(rules[0] as any)?.content && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                Estilo: {(rules[0] as any).content}
                              </p>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {/* Mensagem se não houver templates */}
                {chatTemplates.length === 0 && imageTemplates.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Nenhum template configurado para este cliente</p>
                    <div className="mt-4">
                      <TemplateManager clientId={selectedClientId} />
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Assistant;
