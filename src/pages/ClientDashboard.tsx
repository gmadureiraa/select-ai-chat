import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { TemplateManager } from "@/components/clients/TemplateManager";
import { ArrowLeft, MessageSquare, FileText, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const ClientDashboard = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading } = useQuery({
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

  const functionTemplates = (client?.function_templates as string[]) || [];

  const startNewChat = (template?: string) => {
    const searchParams = new URLSearchParams();
    if (template) {
      searchParams.set("template", template);
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
            <h2 className="text-2xl font-bold mb-2">O que você quer criar?</h2>
            <p className="text-muted-foreground">
              Escolha um template ou inicie um chat livre
            </p>
          </div>
          <TemplateManager 
            clientId={clientId!} 
            templates={functionTemplates}
          />
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

          {/* Function Templates */}
          {functionTemplates.map((template, index) => (
            <Card
              key={index}
              className="hover:shadow-lg transition-shadow cursor-pointer border-secondary/20"
              onClick={() => startNewChat(template)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-secondary/10">
                    <Sparkles className="h-6 w-6 text-secondary" />
                  </div>
                  <CardTitle className="text-lg">{template}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Usar template predefinido para criar {template.toLowerCase()}
                </CardDescription>
              </CardContent>
            </Card>
          ))}

          {/* Add New Template Placeholder */}
          {functionTemplates.length === 0 && (
            <Card className="border-dashed">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-muted-foreground">
                    Nenhum template
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Configure templates de funções repetitivas nas configurações
                  do cliente
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
