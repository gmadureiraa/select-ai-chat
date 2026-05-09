import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  User as UserIcon,
  Eye,
  X,
  Mail,
  Clock,
  Loader2,
  ChevronDown,
  Building2,
  RefreshCw,
} from "lucide-react";
import { useWorkspace, type WorkspaceRole } from "@/hooks/useWorkspace";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { TabHeader } from "@/components/kai/TabHeader";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { apiInvoke } from "@/lib/apiInvoke";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const roleLabels: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  viewer: "Visualizador",
};

const roleIcons: Record<WorkspaceRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: UserIcon,
  viewer: Eye,
};

const roleColors: Record<WorkspaceRole, string> = {
  owner: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  member: "bg-muted text-muted-foreground border-border",
  viewer: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

/**
 * WorkspaceMembersTab — gerencia membros e convites do workspace.
 *
 * Owner pode:
 *  - Convidar via email + role + clients granulares (RPC add_workspace_member_or_invite)
 *  - Mudar role de qualquer membro (exceto ele mesmo)
 *  - Remover membros (exceto ele mesmo)
 *  - Cancelar/reenviar convites pendentes
 *
 * Admin pode quase tudo, exceto promover/rebaixar owner.
 */
export function WorkspaceMembersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { workspace, canManageTeam, isOwner } = useWorkspace();
  const { clients } = useClients();
  const {
    members,
    invites,
    isLoadingMembers,
    isLoadingInvites,
    inviteMember,
    updateMemberRole,
    removeMember,
    cancelInvite,
  } = useTeamMembers();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [inviteClientIds, setInviteClientIds] = useState<string[]>([]);

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteRole("member");
    setInviteClientIds([]);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const selectedClientNames = clients
      .filter((c) => inviteClientIds.includes(c.id))
      .map((c) => c.name);

    inviteMember.mutate(
      {
        email: inviteEmail.trim(),
        role: inviteRole,
        clientIds:
          inviteRole === "member" || inviteRole === "viewer"
            ? inviteClientIds
            : undefined,
        clientNames:
          inviteRole === "member" || inviteRole === "viewer"
            ? selectedClientNames
            : undefined,
      },
      {
        onSuccess: () => {
          trackEvent("workspace_member_invited", {
            role: inviteRole,
            client_count: inviteClientIds.length,
            scoped: inviteRole === "member" || inviteRole === "viewer",
          });
          setInviteOpen(false);
          resetInviteForm();
        },
      },
    );
  };

  const handleResendInvite = async (invite: (typeof invites)[number]) => {
    setResendingInviteId(invite.id);
    try {
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", invite.invited_by)
        .single();

      await apiInvoke("send-invite-email", {
        body: {
          email: invite.email,
          workspaceName: workspace?.name || "",
          inviterName:
            inviterProfile?.full_name ||
            inviterProfile?.email ||
            "Um administrador",
          role: invite.role,
          expiresAt: invite.expires_at,
        },
      });

      toast({
        title: "Convite reenviado",
        description: `Email enviado para ${invite.email}.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao reenviar",
        description: "Não foi possível reenviar o email de convite.",
        variant: "destructive",
      });
    } finally {
      setResendingInviteId(null);
    }
  };

  if (!workspace) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Nenhum workspace selecionado.
      </div>
    );
  }

  if (!canManageTeam) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sem permissão</CardTitle>
            <CardDescription>
              Apenas owners e admins podem ver os membros do workspace.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-w-5xl mx-auto h-full overflow-y-auto",
        isMobile ? "px-4 py-4" : "px-6 py-8",
      )}
    >
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o);
          if (!o) resetInviteForm();
        }}
      >
        <div className="mb-6">
          <TabHeader
            icon={Users}
            eyebrow="WORKSPACE · MEMBROS"
            title="Membros"
            description="Convide e gerencie quem tem acesso ao workspace."
            actions={
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar membro
                </Button>
              </DialogTrigger>
            }
          />
        </div>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Convidar membro</DialogTitle>
              <DialogDescription>
                Envie um convite por email. Se o usuário já tem conta, ele entra
                direto. Caso contrário, recebe um email com o link de aceite.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInviteSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">Cargo</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as WorkspaceRole)}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Só owner pode promover outro a owner */}
                    {isOwner && (
                      <SelectItem value="owner">Proprietário</SelectItem>
                    )}
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(inviteRole === "member" || inviteRole === "viewer") &&
                clients.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Acesso a clientes</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (inviteClientIds.length === clients.length) {
                            setInviteClientIds([]);
                          } else {
                            setInviteClientIds(clients.map((c) => c.id));
                          }
                        }}
                      >
                        {inviteClientIds.length === clients.length
                          ? "Desmarcar todos"
                          : "Selecionar todos"}
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                      {clients.map((c) => {
                        const checked = inviteClientIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setInviteClientIds((prev) =>
                                  prev.includes(c.id)
                                    ? prev.filter((id) => id !== c.id)
                                    : [...prev, c.id],
                                )
                              }
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="text-sm">{c.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inviteRole === "viewer"
                        ? "Visualizadores precisam de pelo menos um cliente."
                        : "Vazio = acesso a todos os clientes."}
                    </p>
                  </div>
                )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={inviteMember.isPending || !inviteEmail.trim()}
                >
                  {inviteMember.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Enviar convite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Convites pendentes
              <Badge variant="secondary" className="ml-1">
                {invites.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Aguardando o usuário aceitar via email ou pelo banner do app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingInvites && <Skeleton className="h-14 w-full" />}
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3 flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {invite.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expira{" "}
                      {formatDistanceToNow(new Date(invite.expires_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={roleColors[invite.role]}
                  >
                    {roleLabels[invite.role]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Reenviar email"
                    onClick={() => handleResendInvite(invite)}
                    disabled={resendingInviteId === invite.id}
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        resendingInviteId === invite.id && "animate-spin",
                      )}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Cancelar convite"
                    onClick={() => cancelInvite.mutate(invite.id)}
                    disabled={cancelInvite.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Membros ativos
            <Badge variant="secondary" className="ml-1">
              {members.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Pessoas com acesso ao workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum membro ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const Icon = roleIcons[member.role];
                const isCurrentUser = member.user_id === user?.id;
                const isMemberOwner = member.role === "owner";
                // Only owner can change roles of non-owners (and not themselves)
                const canChangeRole = isOwner && !isMemberOwner && !isCurrentUser;
                // canManageTeam covers both admin/owner; can't remove yourself or owner
                const canRemove =
                  canManageTeam && !isMemberOwner && !isCurrentUser;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3 flex-wrap"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {member.profile?.full_name ||
                            member.profile?.email ||
                            "Usuário"}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground">
                              (você)
                            </span>
                          )}
                        </div>
                        {member.profile?.email && (
                          <div className="text-xs text-muted-foreground truncate">
                            {member.profile.email}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canChangeRole ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => {
                            const role = v as WorkspaceRole;
                            if (role !== member.role) {
                              updateMemberRole.mutate({
                                memberId: member.id,
                                role,
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Membro</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="outline"
                          className={roleColors[member.role]}
                        >
                          {roleLabels[member.role]}
                        </Badge>
                      )}

                      {canRemove && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMemberToRemove(member.id)}
                          title="Remover membro"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission legend */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Permissões por cargo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            <span>
              <strong>Proprietário:</strong> acesso total, gerencia time e
              edita workspace.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-blue-500" />
            <span>
              <strong>Admin:</strong> gerencia membros (exceto owner) e
              automações.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5" />
            <span>
              <strong>Membro:</strong> cria e edita conteúdo, pode ter acesso
              restrito a clientes específicos.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-purple-500" />
            <span>
              <strong>Visualizador:</strong> apenas visualiza clientes
              atribuídos.
            </span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={() => setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro do workspace? Ele
              perderá acesso a todos os clientes e dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (memberToRemove) {
                  removeMember.mutate(memberToRemove);
                  setMemberToRemove(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default WorkspaceMembersTab;
