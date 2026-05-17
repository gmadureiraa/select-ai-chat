import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Loader2, X, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PendingInvite {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  role: string;
  expires_at: string;
}

/**
 * PendingInvitesAlert — banner global mostrando convites pendentes pro user logado.
 *
 * Renderiza um aviso fixo no topo do app sempre que o usuário tem 1+ convites
 * de workspaces aguardando aceite. Os convites são resolvidos pelo email do
 * usuário (RPC `get_my_pending_workspace_invites`).
 *
 * Aceitar → RPC `accept_pending_invite(p_user_id, p_workspace_id)` que cria
 * a row em `workspace_members` e marca o invite como aceito.
 * Recusar → DELETE direto na tabela `workspace_invites` filtrando por email.
 *
 * Banner some sozinho quando todos os convites são resolvidos.
 */
export function PendingInvitesAlert() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["pending-invites", user?.id],
    queryFn: async (): Promise<PendingInvite[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc(
        "get_my_pending_workspace_invites",
      );
      if (error) {
        console.error("Error fetching pending invites:", error);
        return [];
      }
      return (data as PendingInvite[]) || [];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
  });

  const acceptInvite = useMutation({
    mutationFn: async (workspaceId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase.rpc("accept_pending_invite", {
        p_user_id: user.id,
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      queryClient.invalidateQueries({ queryKey: ["user-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["team-members", workspaceId] });
      toast({
        title: "Convite aceito",
        description: "Você agora faz parte do workspace.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao aceitar",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => setPendingActionId(null),
  });

  const declineInvite = useMutation({
    mutationFn: async (workspaceId: string) => {
      if (!user?.email) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("workspace_invites")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("email", user.email.toLowerCase())
        .is("accepted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      toast({
        title: "Convite recusado",
        description: "O convite foi removido.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao recusar",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => setPendingActionId(null),
  });

  if (isLoading || !invites.length) return null;

  const visible = invites.filter((i) => !dismissed[i.workspace_id]);
  if (!visible.length) return null;

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-2 space-y-1.5">
        {visible.map((invite) => {
          const isPending = pendingActionId === invite.workspace_id;
          return (
            <div
              key={invite.workspace_id}
              className="flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Mail className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="min-w-0 text-sm flex items-center gap-2 flex-wrap">
                  <span className="text-foreground">
                    Você foi convidado para o workspace{" "}
                    <strong className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {invite.workspace_name}
                    </strong>
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {invite.role}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 text-xs",
                    "hover:bg-amber-500/20 text-amber-700 dark:text-amber-300",
                  )}
                  disabled={isPending}
                  onClick={() => {
                    setPendingActionId(invite.workspace_id);
                    declineInvite.mutate(invite.workspace_id);
                  }}
                >
                  {isPending && declineInvite.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Recusar
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-600/90 text-white"
                  disabled={isPending}
                  onClick={() => {
                    setPendingActionId(invite.workspace_id);
                    acceptInvite.mutate(invite.workspace_id);
                  }}
                >
                  {isPending && acceptInvite.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Aceitar
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Esconder por agora"
                  aria-label="Esconder convite por agora"
                  onClick={() =>
                    setDismissed((prev) => ({
                      ...prev,
                      [invite.workspace_id]: true,
                    }))
                  }
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PendingInvitesAlert;
