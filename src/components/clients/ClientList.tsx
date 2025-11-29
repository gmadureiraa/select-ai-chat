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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {clients.map((client) => (
          <Card key={client.id} className="p-8 hover:border-primary/30 transition-all bg-card/50 backdrop-blur-sm group">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-primary/5 rounded-xl group-hover:bg-primary/10 transition-colors">
                <MessageSquare className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xl truncate group-hover:text-primary transition-colors">{client.name}</h3>
                {client.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2 font-light">
                    {client.description}
                  </p>
                )}
              </div>
            </div>
            
            {client.context_notes && (
              <div className="mb-6 p-4 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-xs text-muted-foreground line-clamp-3 font-light">
                  {client.context_notes}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/client/${client.id}`)}
                className="flex-1 bg-primary hover:bg-primary/90 glow-green font-semibold"
              >
                Abrir Cliente
              </Button>
              <Button
                onClick={() => setEditingClient(client)}
                variant="outline"
                size="icon"
                className="border-border/50 hover:border-primary/50 hover:bg-muted/50"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setDeletingClient(client)}
                variant="outline"
                size="icon"
                className="border-border/50 hover:border-destructive/50 hover:bg-muted/50 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
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
