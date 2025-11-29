import { MessageSquare, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Client } from "@/hooks/useClients";
import { useNavigate } from "react-router-dom";

interface ClientListProps {
  clients: Client[];
  isLoading: boolean;
}

export const ClientList = ({ clients, isLoading }: ClientListProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum cliente cadastrado</h3>
        <p className="text-muted-foreground">
          Crie seu primeiro cliente para começar a usar o chat com contexto
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {clients.map((client) => (
        <Card key={client.id} className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{client.name}</h3>
              {client.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {client.description}
                </p>
              )}
            </div>
          </div>
          
          {client.context_notes && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground line-clamp-3">
                {client.context_notes}
              </p>
            </div>
          )}

          <Button
            onClick={() => navigate(`/chat/${client.id}`)}
            className="w-full"
          >
            Abrir Chat
          </Button>
        </Card>
      ))}
    </div>
  );
};
