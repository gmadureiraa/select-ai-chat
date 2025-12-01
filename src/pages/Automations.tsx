import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Zap, ArrowLeft } from "lucide-react";
import { useAutomations } from "@/hooks/useAutomations";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { AutomationDialog } from "@/components/automations/AutomationDialog";
import { N8nWorkflowCard } from "@/components/automations/N8nWorkflowCard";
import { Skeleton } from "@/components/ui/skeleton";

const Automations = () => {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { automations, isLoading } = useAutomations();

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
