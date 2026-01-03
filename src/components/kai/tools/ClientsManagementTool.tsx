import { useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useClients, Client } from "@/hooks/useClients";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ClientEditDialog } from "@/components/clients/ClientEditDialog";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClientsManagementTool() {
  const { clients, isLoading } = useClients();
  const { canAddClient, clientsRemaining, maxClients } = usePlanLimits();
  const { showUpgradePrompt } = useUpgradePrompt();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  const handleAddClient = () => {
    if (!canAddClient) {
      showUpgradePrompt("max_clients", `Você atingiu o limite de ${maxClients} cliente(s) do seu plano atual.`);
      return;
    }
    setIsCreateDialogOpen(true);
  };

  const filteredClients = clients?.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus clientes, adicione novos ou edite informações existentes.
          </p>
        </div>
        <Button onClick={handleAddClient} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
          {clientsRemaining > 0 && (
            <span className="text-xs opacity-70">({clientsRemaining})</span>
          )}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Clients Grid */}
      {filteredClients && filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Avatar className="h-14 w-14 rounded-lg border border-border">
                    <AvatarImage src={client.avatar_url || undefined} alt={client.name} />
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary to-secondary text-lg font-bold text-white">
                      {client.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">{client.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {client.description || "Sem descrição"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setEditingClient(client)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingClient(client)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">
            {searchQuery ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery
              ? "Tente buscar por outro termo."
              : "Clique em 'Novo Cliente' para adicionar seu primeiro cliente."}
          </p>
        </div>
      )}

      {/* Dialogs */}
      <ClientDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {editingClient && (
        <ClientEditDialog
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
          client={editingClient}
        />
      )}

      {deletingClient && (
        <DeleteClientDialog
          open={!!deletingClient}
          onOpenChange={(open) => !open && setDeletingClient(null)}
          client={deletingClient}
        />
      )}
    </div>
  );
}
