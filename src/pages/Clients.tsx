import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <img 
              src={kaleidosLogo} 
              alt="Kaleidos" 
              className="h-10 w-10 object-contain animate-fade-in" 
            />
            <div className="flex items-center gap-3">
            <h1 className="text-5xl font-bold tracking-tight">
              k<span className="text-primary">AI</span>
            </h1>
              <span className="text-xs text-muted-foreground font-medium px-4 py-2 bg-muted/30 rounded-full border border-border/50">
                by Kaleidos Digital
              </span>
            </div>
          </div>
          <p className="text-muted-foreground text-lg font-light">
            Assistente de IA contextual para criação de conteúdo estratégico
          </p>
        </div>
        <Button 
          onClick={() => setIsDialogOpen(true)} 
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all font-semibold px-6 py-6 text-base"
        >
          <Plus className="h-5 w-5" />
          Novo Cliente
        </Button>
      </Header>

      <div className="max-w-7xl mx-auto px-8 py-12">
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
