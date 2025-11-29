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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="bg-primary/5 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-2xl font-bold mb-3">Nenhum cliente cadastrado</h3>
        <p className="text-muted-foreground text-lg font-light">
          Crie seu primeiro cliente para começar a usar o chat com contexto
        </p>
      </div>
    );
  }

  const getClientIcon = (clientName: string) => {
    if (clientName.toLowerCase().includes('defiverso')) {
      return <Rocket className="h-6 w-6 text-primary" />;
    }
    return <MessageSquare className="h-6 w-6 text-primary" />;
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <Card key={client.id} className="p-6 hover:border-primary/40 transition-all group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                  {getClientIcon(client.name)}
                </div>
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{client.name}</h3>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setEditingClient(client)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted/50 hover:text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => setDeletingClient(client)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted/50 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Button
              onClick={() => navigate(`/client/${client.id}`)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
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
