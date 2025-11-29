import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Zap, ArrowLeft } from "lucide-react";
import { useAutomations } from "@/hooks/useAutomations";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { AutomationDialog } from "@/components/automations/AutomationDialog";
import { Skeleton } from "@/components/ui/skeleton";

const Automations = () => {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { automations, isLoading } = useAutomations();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card shadow-sm">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/clients")}
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Automações</h1>
              </div>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">
              Nenhuma automação criada
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Crie automações para executar tarefas automaticamente em períodos
              definidos usando IA.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Criar Primeira Automação
            </Button>
          </div>
        )}
      </div>

      <AutomationDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

export default Automations;
