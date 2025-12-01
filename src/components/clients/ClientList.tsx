import { MessageSquare, Loader2, Pencil, Trash2 } from "lucide-react";
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
        <MessageSquare className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold mb-2">Nenhum cliente cadastrado</h3>
        <p className="text-sm text-muted-foreground">
          Crie seu primeiro cliente para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <Card key={client.id} className="p-6 border-border/50 bg-card/50 hover:border-border transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">{client.name}</h3>
              <div className="flex gap-1">
                <Button
                  onClick={() => setEditingClient(client)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={() => setDeletingClient(client)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Button
              onClick={() => navigate(`/client/${client.id}`)}
              variant="outline"
              className="w-full"
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
