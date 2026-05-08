import { useState } from "react";
import { Plus, Search, Pencil, Trash2, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients, type Client } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ClientOnboardingWizard } from "./ClientOnboardingWizard";
import { ClientEditDialog } from "./ClientEditDialog";
import { DeleteClientDialog } from "./DeleteClientDialog";
import { TabHeader } from "@/components/kai/TabHeader";

interface ClientsListPageProps {
  /**
   * Se true, ao concluir o wizard a página redireciona pra `/kaleidos?client=<id>`.
   * Default true. Quando montada dentro de outra tool (ex: KAI sidebar) que
   * já cuida da navegação, passe false.
   */
  redirectOnComplete?: boolean;
}

/**
 * Página de listagem de clientes do workspace + entrada para o
 * wizard de onboarding de 5 steps.
 *
 * Esta é a versão completa (mobile-first) usada como rota dedicada.
 * Difere do `ClientsManagementTool` (montado dentro do KAI) por usar o
 * `ClientOnboardingWizard` novo (5 steps) ao invés do simplified (2 steps).
 */
export function ClientsListPage({
  redirectOnComplete = true,
}: ClientsListPageProps) {
  const { clients, isLoading } = useClients();
  const { canDelete } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  const filteredClients = (clients || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <TabHeader
        icon={Building2}
        title="Clientes"
        description="Cadastre e gerencie os perfis dos clientes da agência."
        actions={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="h-9 gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Novo cliente
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          searching={Boolean(searchQuery.trim())}
          onCreate={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="group hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 rounded-lg border border-border">
                    <AvatarImage
                      src={client.avatar_url || undefined}
                      alt={client.name}
                    />
                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary to-secondary text-lg font-bold text-white">
                      {client.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">
                      {client.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {client.description || "Sem descrição"}
                    </p>
                  </div>
                </div>

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
                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingClient(client)}
                      aria-label={`Excluir ${client.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create wizard */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>
              Onboarding em 5 etapas. Você poderá ajustar tudo depois.
            </DialogDescription>
          </DialogHeader>
          <ClientOnboardingWizard
            onComplete={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
            redirectOnComplete={redirectOnComplete}
          />
        </DialogContent>
      </Dialog>

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

function EmptyState({
  searching,
  onCreate,
}: {
  searching: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="text-center py-16 border border-dashed rounded-lg">
      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground">
        {searching ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        {searching
          ? "Tente buscar por outro termo ou crie um novo cliente."
          : "Crie seu primeiro cliente para começar a estruturar conteúdo, persona e referências."}
      </p>
      {!searching && (
        <Button onClick={onCreate} className="mt-4 gap-2">
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      )}
    </div>
  );
}
