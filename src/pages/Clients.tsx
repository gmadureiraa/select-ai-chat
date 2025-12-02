import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useClients } from "@/hooks/useClients";
import { PageHeader } from "@/components/PageHeader";

const Clients = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { clients, isLoading } = useClients();

  const clientCount = clients?.length || 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <PageHeader 
        title="Clientes" 
        subtitle={`${clientCount} cliente${clientCount !== 1 ? 's' : ''} cadastrado${clientCount !== 1 ? 's' : ''}`}
      >
        <Button onClick={() => setIsDialogOpen(true)} variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </PageHeader>

      <ClientList clients={clients} isLoading={isLoading} />

      <ClientDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
};

export default Clients;
