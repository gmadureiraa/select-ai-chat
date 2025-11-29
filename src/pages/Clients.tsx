import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useClients } from "@/hooks/useClients";

const Clients = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { clients, isLoading } = useClients();
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-6 md:py-12">
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-1 md:mb-2">
              Clientes
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Gerencie seus clientes e contextos
            </p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            size="default"
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            Novo Cliente
          </Button>
        </div>

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