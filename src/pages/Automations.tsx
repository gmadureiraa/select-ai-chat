import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Zap, ArrowLeft, Play, Loader2, BarChart3, Send } from "lucide-react";
import { useAutomations } from "@/hooks/useAutomations";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { AutomationDialog } from "@/components/automations/AutomationDialog";
import { N8nWorkflowCard } from "@/components/automations/N8nWorkflowCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Automations = () => {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { automations, isLoading } = useAutomations();
  const [runningMetrics, setRunningMetrics] = useState(false);
  const [runningPosts, setRunningPosts] = useState(false);

  const handleRunCollectMetrics = async () => {
    setRunningMetrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('collect-daily-metrics');
      if (error) throw error;
      toast.success(`Métricas coletadas: ${data.results?.length || 0} clientes processados`);
    } catch (error: any) {
      console.error('Error collecting metrics:', error);
      toast.error('Erro ao coletar métricas: ' + error.message);
    } finally {
      setRunningMetrics(false);
    }
  };

  const handleRunProcessPosts = async () => {
    setRunningPosts(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-scheduled-posts');
      if (error) throw error;
      toast.success(`Posts processados: ${data.processed || 0} publicados`);
    } catch (error: any) {
      console.error('Error processing posts:', error);
      toast.error('Erro ao processar posts: ' + error.message);
    } finally {
      setRunningPosts(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/clients")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-8">
        {/* Workflows n8n */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold">Workflows Externos</h2>
            <p className="text-sm text-muted-foreground">
              Execute workflows do n8n diretamente daqui
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <N8nWorkflowCard
              title="Resumo Cripto Diário"
              description="Envia um resumo diário do mercado cripto por email"
              workflowId="c7szXhtpjXUqaRKK"
            />
          </div>
        </section>

        {/* Tarefas Manuais */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold">Tarefas Manuais</h2>
            <p className="text-sm text-muted-foreground">
              Execute tarefas do sistema manualmente
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Coletar Métricas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Coleta métricas de performance de todos os clientes configurados
                </p>
                <Button
                  onClick={handleRunCollectMetrics}
                  disabled={runningMetrics}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {runningMetrics ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {runningMetrics ? "Executando..." : "Executar"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Processar Posts Agendados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Publica todos os posts agendados que já passaram do horário
                </p>
                <Button
                  onClick={handleRunProcessPosts}
                  disabled={runningPosts}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {runningPosts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {runningPosts ? "Executando..." : "Executar"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Automações do Sistema */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold">Automações do Sistema</h2>
            <p className="text-sm text-muted-foreground">
              Automações criadas e gerenciadas pelo sistema
            </p>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : automations && automations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {automations.map((automation) => (
                <AutomationCard key={automation.id} automation={automation} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/50 rounded-lg">
              <Zap className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <h3 className="text-base font-semibold mb-2">
                Nenhuma automação criada
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Crie automações para executar tarefas automaticamente
              </p>
              <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nova Automação
              </Button>
            </div>
          )}
        </section>
      </div>

      <AutomationDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

export default Automations;
