import { MessageSquare, Loader2, Pencil, Trash2, Rocket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Client } from "@/hooks/useClients";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ClientEditDialog } from "./ClientEditDialog";
import { DeleteClientDialog } from "./DeleteClientDialog";

interface ClientListProps {
  clients: Client[];
  isLoading: boolean;
}

export const ClientList = ({ clients, isLoading }: ClientListProps) => {
  const navigate = useNavigate();
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 md:py-20">
        <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-16 md:py-20 px-4">
        <div className="bg-primary/5 rounded-full w-20 h-20 md:w-24 md:h-24 flex items-center justify-center mx-auto mb-4 md:mb-6">
          <MessageSquare className="h-10 w-10 md:h-12 md:w-12 text-primary" />
        </div>
        <h3 className="text-xl md:text-2xl font-bold mb-2 md:mb-3">Nenhum cliente cadastrado</h3>
        <p className="text-sm md:text-base text-muted-foreground">
          Crie seu primeiro cliente para começar a usar o chat com contexto
        </p>
      </div>
    );
  }

  const getClientIcon = (clientName: string) => {
    if (clientName.toLowerCase().includes('defiverso')) {
      return <Rocket className="h-5 w-5 md:h-6 md:w-6 text-primary" />;
    }
    return <MessageSquare className="h-5 w-5 md:h-6 md:w-6 text-primary" />;
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {clients.map((client) => (
          <Card key={client.id} className="p-4 md:p-6 hover:border-primary/40 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors flex-shrink-0">
                  {getClientIcon(client.name)}
                </div>
                <h3 className="font-semibold text-base md:text-lg group-hover:text-primary transition-colors truncate">
                  {client.name}
                </h3>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingClient(client);
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 md:h-8 md:w-8 hover:bg-muted/50 hover:text-primary"
                >
                  <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingClient(client);
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 md:h-8 md:w-8 hover:bg-muted/50 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                </Button>
              </div>
            </div>

            <Button
              onClick={() => navigate(`/client/${client.id}`)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm md:text-base"
              size="default"
            >
              Abrir Cliente
            </Button>
          </Card>
        ))}
      </div>

      <ClientEditDialog
        open={editingClient !== null}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
      />

      <DeleteClientDialog
        open={deletingClient !== null}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        client={deletingClient}
      />
    </>
  );
};