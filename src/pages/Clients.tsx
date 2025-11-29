import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Zap } from "lucide-react";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useClients } from "@/hooks/useClients";
import { Header } from "@/components/Header";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const Clients = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { clients, isLoading } = useClients();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header>
        <div>
          <div className="flex items-center gap-4 mb-3">
            <img 
              src={kaleidosLogo} 
              alt="Kaleidos" 
              className="h-8 w-8 object-contain animate-fade-in" 
            />
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-bold">
                k<span className="text-primary drop-shadow-[0_0_10px_rgba(0,255,127,0.5)]">AI</span>
              </h1>
              <span className="text-xs text-muted-foreground font-medium px-3 py-1.5 bg-muted/50 rounded-full border border-primary/20">
                by Kaleidos Digital
              </span>
            </div>
          </div>
          <p className="text-muted-foreground text-base">
            Assistente de IA contextual para criação de conteúdo estratégico
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => navigate("/automations")} 
            variant="outline"
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Automações
          </Button>
          <Button 
            onClick={() => setIsDialogOpen(true)} 
            className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg hover:shadow-[0_0_20px_rgba(255,0,127,0.4)] transition-all"
          >
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </Header>

      <div className="max-w-7xl mx-auto p-6">
        <ClientList clients={clients} isLoading={isLoading} />
      </div>

      <ClientDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
};

export default Clients;
