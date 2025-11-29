import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { TemplateManager } from "@/components/clients/TemplateManager";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { ArrowLeft, MessageSquare, Sparkles, Zap, Image as ImageIcon } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header>
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-10 w-64" />
          </div>
        </Header>
        <div className="max-w-7xl mx-auto p-6">
          <Skeleton className="h-12 w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background">
        <Header>
          <div className="flex items-center gap-4">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-8 w-8" />
            <h1 className="text-2xl font-bold">Cliente não encontrado</h1>
          </div>
        </Header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header>
        <div>
          <div className="flex items-center gap-4 mb-2">
            <img src={kaleidosLogo} alt="Kaleidos" className="h-8 w-8" />
            <h1 className="text-3xl font-bold">{client.name}</h1>
          </div>
          {client.description && (
            <p className="text-muted-foreground">{client.description}</p>
          )}
        </div>
        <Button
          onClick={() => navigate("/clients")}
          variant="outline"
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </Header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">O que você quer fazer?</h2>
            <p className="text-muted-foreground">
              Escolha uma opção ou template para começar
            </p>
          </div>
          <TemplateManager clientId={clientId!} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Chat Livre */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20"
            onClick={() => startNewChat()}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Chat Livre</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Converse livremente com a IA sobre qualquer assunto relacionado
                ao cliente
              </CardDescription>
            </CardContent>
          </Card>

          {/* Automações */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-secondary/20"
            onClick={() => navigate("/automations")}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-secondary/10">
                  <Zap className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle>Automações</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Configure tarefas automáticas e agendamentos para este cliente
              </CardDescription>
            </CardContent>
          </Card>

          {/* Geração de Imagem */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-accent/20"
            onClick={() => navigate(`/client/${clientId}/image-gen`)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-accent/10">
                  <ImageIcon className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Geração de Imagem</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Crie imagens personalizadas usando IA para este cliente
              </CardDescription>
            </CardContent>
          </Card>

          {/* Templates */}
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-lg transition-shadow cursor-pointer border-muted"
              onClick={() => startNewChat(template.id)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-muted">
                    <Sparkles className="h-6 w-6 text-foreground" />
                  </div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-2">
                  Usar template com {template.rules.length} regra(s) definida(s)
                </CardDescription>
                {template.rules.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p className="line-clamp-2">{template.rules[0].content}</p>
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
