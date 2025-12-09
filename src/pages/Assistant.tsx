import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MessageSquare, Image, MessageCircle, Lightbulb, Sparkles, Library, BookOpen, TrendingUp } from "lucide-react";
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

  const { data: templates } = useQuery({
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

  const quickActions = [
    {
      icon: MessageCircle,
      label: "Chat Livre",
      description: "Conversa com dados reais",
      className: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15",
      iconClass: "text-emerald-500",
      onClick: () => handleStartChat(),
    },
    {
      icon: Lightbulb,
      label: "Gerar Ideias",
      description: "Ideias criativas",
      className: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15",
      iconClass: "text-amber-500",
      onClick: () => handleStartChat(),
    },
    {
      icon: Sparkles,
      label: "Alta Qualidade",
      description: "Pipeline 4 agentes",
      className: "bg-primary/10 border-primary/20 hover:bg-primary/15",
      iconClass: "text-primary",
      onClick: () => handleStartChat(),
    },
  ];

  const clientResources = [
    {
      icon: Library,
      label: "Biblioteca de Conteúdo",
      path: `/client/${selectedClientId}/content`,
    },
    {
      icon: BookOpen,
      label: "Referências",
      path: `/client/${selectedClientId}/references`,
    },
    {
      icon: TrendingUp,
      label: "Performance",
      path: `/client/${selectedClientId}/performance`,
    },
  ];

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
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-1">O que você quer fazer?</h2>
                <p className="text-sm text-muted-foreground">
                  Escolha uma ação rápida ou template
                </p>
              </div>
              <TemplateManager clientId={selectedClientId} />
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Ações Rápidas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickActions.map((action) => (
                  <Card
                    key={action.label}
                    className={`p-4 cursor-pointer transition-all border ${action.className}`}
                    onClick={action.onClick}
                  >
                    <div className="flex items-center gap-3">
                      <action.icon className={`h-5 w-5 ${action.iconClass}`} />
                      <div>
                        <div className="font-medium text-sm">{action.label}</div>
                        <div className="text-xs text-muted-foreground">{action.description}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Client Resources */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Recursos do Cliente
              </h3>
              <div className="flex gap-2 flex-wrap">
                {clientResources.map((resource) => (
                  <Button
                    key={resource.label}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate(resource.path)}
                  >
                    <resource.icon className="h-4 w-4" />
                    {resource.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Content Templates */}
            {chatTemplates.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Templates de Conteúdo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {chatTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="p-4 border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer"
                      onClick={() => handleStartChat(template.id)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <MessageSquare className="h-4 w-4 text-foreground" />
                        <div className="font-medium text-sm">{template.name}</div>
                      </div>
                      {template.rules && Array.isArray(template.rules) && template.rules.length > 0 && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {(template.rules[0] as any).content}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Image Templates */}
            {imageTemplates.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Geração de Imagem
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {imageTemplates.map((template) => {
                    const rules = Array.isArray(template.rules) ? template.rules : [];
                    return (
                      <Card
                        key={template.id}
                        className="p-4 border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer"
                        onClick={() =>
                          navigate(`/client/${selectedClientId}/image-gen?templateId=${template.id}`)
                        }
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Image className="h-4 w-4 text-[#ff006e]" />
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">{template.name}</div>
                            <Badge className="text-[10px] bg-[#ff006e] hover:bg-[#ff006e]/90">
                              Imagem
                            </Badge>
                          </div>
                        </div>
                        {rules.length > 0 && (rules[0] as any)?.content && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {(rules[0] as any).content}
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {chatTemplates.length === 0 && imageTemplates.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                <p className="mb-3">Nenhum template configurado para este cliente</p>
                <TemplateManager clientId={selectedClientId} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Assistant;
