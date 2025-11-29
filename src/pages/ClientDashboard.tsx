import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { TemplateManager } from "@/components/clients/TemplateManager";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { ArrowLeft, MessageSquare, Sparkles, Image as ImageIcon, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const ClientDashboard = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { templates, isLoading: templatesLoading } = useClientTemplates(clientId!);
  const isLoading = clientLoading || templatesLoading;

  const startNewChat = (templateId?: string) => {
    const searchParams = new URLSearchParams();
    if (templateId) {
      searchParams.set("templateId", templateId);
    }
    navigate(`/chat/${clientId}?${searchParams.toString()}`);
  };

  const startImageGeneration = (templateId?: string) => {
    const searchParams = new URLSearchParams();
    if (templateId) {
      searchParams.set("templateId", templateId);
    }
    navigate(`/client/${clientId}/image-gen?${searchParams.toString()}`);
  };

  const getTemplateReferenceCount = (template: any) => {
    const rules = template.rules || [];
    const textRules = rules.filter((r: any) => !r.type || r.type === 'text').length;
    const imageRefs = rules.filter((r: any) => r.type === 'image_reference').length;
    const contentRefs = rules.filter((r: any) => r.type === 'content_reference').length;
    return { textRules, imageRefs, contentRefs, total: textRules + imageRefs + contentRefs };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header>
          <div className="flex items-center gap-3 md:gap-4">
            <Skeleton className="h-7 w-7 md:h-8 md:w-8 rounded-full" />
            <Skeleton className="h-8 md:h-10 w-48 md:w-64" />
          </div>
        </Header>
        <div className="max-w-7xl mx-auto p-3 md:p-6">
          <Skeleton className="h-10 md:h-12 w-40 md:w-48 mb-4 md:mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 md:h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl md:text-2xl font-bold">Cliente não encontrado</h1>
          <Button onClick={() => navigate("/clients")}>
            Voltar para Clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-4 mb-1 md:mb-2">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-6 w-6 md:h-8 md:w-8 flex-shrink-0" />
            <h1 className="text-xl md:text-3xl font-bold truncate">{client.name}</h1>
          </div>
          {client.description && (
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-1 md:line-clamp-2">
              {client.description}
            </p>
          )}
        </div>
        <Button
          onClick={() => navigate("/clients")}
          variant="outline"
          size="sm"
          className="gap-2 flex-shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
      </Header>

      <div className="max-w-7xl mx-auto p-3 md:p-6">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
          <div>
            <h2 className="text-lg md:text-2xl font-bold mb-1 md:mb-2">O que você quer fazer?</h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              Escolha uma opção ou template para começar
            </p>
          </div>
          <TemplateManager clientId={clientId!} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {/* Chat Livre */}
          <Card
            className="hover:shadow-lg hover:border-primary/40 transition-all cursor-pointer border-primary/20 group"
            onClick={() => startNewChat()}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 md:p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <CardTitle className="text-base md:text-lg">Chat Livre</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs md:text-sm">
                Converse livremente com a IA sobre qualquer assunto relacionado ao cliente
              </CardDescription>
            </CardContent>
          </Card>

          {/* Análise de Performance */}
          <Card
            className="hover:shadow-lg hover:border-accent/40 transition-all cursor-pointer border-accent/20 group"
            onClick={() => navigate(`/client/${clientId}/performance`)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 md:p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-accent" />
                </div>
                <CardTitle className="text-base md:text-lg">Performance</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs md:text-sm">
                Visualize métricas, KPIs e insights de performance do cliente
              </CardDescription>
            </CardContent>
          </Card>

          {/* Templates */}
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-lg hover:border-muted-foreground/20 transition-all cursor-pointer border-muted group"
              onClick={() => {
                if (template.type === 'image') {
                  startImageGeneration(template.id);
                } else if (template.type === 'automation') {
                  navigate(`/automations?templateId=${template.id}`);
                } else {
                  startNewChat(template.id);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 md:p-3 rounded-lg bg-muted group-hover:bg-muted-foreground/10 transition-colors">
                    {template.type === 'image' ? (
                      <ImageIcon className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
                    ) : template.type === 'automation' ? (
                      <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-secondary" />
                    ) : (
                      <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-sm md:text-lg truncate">{template.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px] md:text-xs flex-shrink-0">
                        {template.type === 'image' ? 'Imagem' : template.type === 'automation' ? 'Auto' : 'Chat'}
                      </Badge>
                    </div>
                    {template.type === 'automation' ? (
                      <div className="text-[10px] md:text-xs text-muted-foreground">
                        {template.automation_config?.schedule_type === 'daily' && 'Diária'}
                        {template.automation_config?.schedule_type === 'weekly' && 'Semanal'}
                        {template.automation_config?.schedule_type === 'monthly' && 'Mensal'}
                        {!template.automation_config?.schedule_type && 'Manual'}
                      </div>
                    ) : (
                      (() => {
                        const counts = getTemplateReferenceCount(template);
                        return counts.total > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {counts.textRules > 0 && (
                              <Badge variant="secondary" className="text-[9px] md:text-xs px-1.5 py-0">
                                {counts.textRules} {counts.textRules === 1 ? 'regra' : 'regras'}
                              </Badge>
                            )}
                            {counts.imageRefs > 0 && (
                              <Badge variant="secondary" className="text-[9px] md:text-xs px-1.5 py-0">
                                {counts.imageRefs} img
                              </Badge>
                            )}
                            {counts.contentRefs > 0 && (
                              <Badge variant="secondary" className="text-[9px] md:text-xs px-1.5 py-0">
                                {counts.contentRefs} ref
                              </Badge>
                            )}
                          </div>
                        ) : null;
                      })()
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {template.type === 'automation' ? (
                  <div className="text-[10px] md:text-xs text-muted-foreground">
                    {template.automation_config?.prompt 
                      ? <p className="line-clamp-2">{template.automation_config.prompt}</p>
                      : <p>Clique para configurar esta automação</p>
                    }
                  </div>
                ) : template.rules.length > 0 ? (
                  <div className="text-[10px] md:text-xs text-muted-foreground">
                    <p className="line-clamp-2">{template.rules[0].content}</p>
                  </div>
                ) : (
                  <div className="text-[10px] md:text-xs text-muted-foreground/60 italic">
                    Clique para começar
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;