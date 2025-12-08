import { MessageSquare, Loader2, Pencil, Trash2, FileText, Globe, Library, Bookmark, Clock, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Client } from "@/hooks/useClients";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ClientEditDialog } from "./ClientEditDialog";
import { DeleteClientDialog } from "./DeleteClientDialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientListProps {
  clients: Client[];
  isLoading: boolean;
}

export const ClientList = ({ clients, isLoading }: ClientListProps) => {
  const navigate = useNavigate();
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const { canDelete } = useWorkspace();

  // Fetch latest activity for each client
  const { data: clientActivities } = useQuery({
    queryKey: ["client-activities", clients.map(c => c.id)],
    queryFn: async () => {
      const clientIds = clients.map(c => c.id);
      if (clientIds.length === 0) return {};

      // Get latest conversation update for each client
      const { data: conversations } = await supabase
        .from("conversations")
        .select("client_id, updated_at")
        .in("client_id", clientIds)
        .order("updated_at", { ascending: false });

      // Get content library count
      const { data: contentCounts } = await supabase
        .from("client_content_library")
        .select("client_id")
        .in("client_id", clientIds);

      // Get templates count
      const { data: templateCounts } = await supabase
        .from("client_templates")
        .select("client_id")
        .in("client_id", clientIds);

      const activities: Record<string, { lastActivity: string | null; contentCount: number; templateCount: number }> = {};
      
      clientIds.forEach(id => {
        const latestConv = conversations?.find(c => c.client_id === id);
        activities[id] = {
          lastActivity: latestConv?.updated_at || null,
          contentCount: contentCounts?.filter(c => c.client_id === id).length || 0,
          templateCount: templateCounts?.filter(t => t.client_id === id).length || 0,
        };
      });

      return activities;
    },
    enabled: clients.length > 0,
  });

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

  const getActivityStatus = (lastActivity: string | null) => {
    if (!lastActivity) return { label: "Novo", variant: "outline" as const };
    
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceActivity <= 3) return { label: "Ativo", variant: "default" as const };
    if (daysSinceActivity <= 7) return { label: "Recente", variant: "secondary" as const };
    return { label: `${daysSinceActivity}d`, variant: "outline" as const };
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => {
          const activity = clientActivities?.[client.id];
          const status = getActivityStatus(activity?.lastActivity || null);
          
          return (
            <Card key={client.id} className="p-6 border-border/50 bg-card/50 hover:border-border transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{client.name}</h3>
                  <Badge variant={status.variant} className="text-xs">
                    {status.label}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => setEditingClient(client)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Editar informações"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button
                      onClick={() => setDeletingClient(client)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      title="Excluir cliente"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {client.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {client.description}
                </p>
              )}

              {/* Mini metrics */}
              <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Library className="h-3 w-3" />
                  <span>{activity?.contentCount || 0} conteúdos</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{activity?.templateCount || 0} templates</span>
                </div>
              </div>

              {activity?.lastActivity && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                  <Clock className="h-3 w-3" />
                  <span>
                    Última atividade {formatDistanceToNow(new Date(activity.lastActivity), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setEditingClient(client)}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Informações
                </Button>
                <Button
                  onClick={() => navigate(`/client/${client.id}/library`)}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Library className="h-3.5 w-3.5 mr-2" />
                  Conteúdo
                </Button>
                <Button
                  onClick={() => navigate(`/client/${client.id}/references`)}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Bookmark className="h-3.5 w-3.5 mr-2" />
                  Referências
                </Button>
                <Button
                  onClick={() => navigate(`/client/${client.id}/performance`)}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Globe className="h-3.5 w-3.5 mr-2" />
                  Performance
                </Button>
              </div>
            </Card>
          );
        })}
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
