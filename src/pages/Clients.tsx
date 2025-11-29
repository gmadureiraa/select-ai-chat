import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useClients } from "@/hooks/useClients";

const Clients = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { clients, isLoading } = useClients();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">k<span className="text-primary">AI</span></h1>
              <span className="text-xs text-muted-foreground font-medium px-2 py-1 bg-muted rounded">
                by Kaleidos Digital
              </span>
            </div>
            <p className="text-muted-foreground">
              Gerencie seus clientes e seus contextos de chat
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

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
