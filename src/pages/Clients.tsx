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
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center animate-fade-in">
          <div>
            <h1 className="text-5xl font-bold tracking-tight mb-2">
              Clientes
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus clientes e contextos
            </p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-5 w-5" />
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
