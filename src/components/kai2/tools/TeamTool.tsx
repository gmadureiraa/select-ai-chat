import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, UserPlus, Crown, Shield, User, X, Mail, Clock, 
  Building2, UserCheck, AlertCircle 
} from "lucide-react";
import { useWorkspace, WorkspaceRole, WorkspaceMember } from "@/hooks/useWorkspace";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { usePendingUsers, PendingUser } from "@/hooks/usePendingUsers";
import { useAllMemberClientAccess } from "@/hooks/useMemberClientAccess";
import { MemberClientAccessDialog } from "@/components/settings/MemberClientAccessDialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const roleLabels: Record<WorkspaceRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

const roleIcons: Record<WorkspaceRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const roleColors: Record<WorkspaceRole, string> = {
  owner: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  member: "bg-muted text-muted-foreground border-border",
};

export function TeamTool() {
  const { user } = useAuth();
  const { workspace, canManageTeam, isOwner } = useWorkspace();
  const { members, invites, isLoadingMembers, isLoadingInvites, inviteMember, updateMemberRole, removeMember, cancelInvite } = useTeamMembers();
  const { pendingUsers, isLoading: isLoadingPending, addUserToWorkspace } = usePendingUsers();
  const { data: allMemberAccess = [] } = useAllMemberClientAccess(workspace?.id);
  
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [memberToEditAccess, setMemberToEditAccess] = useState<WorkspaceMember | null>(null);
  const [selectedRoleForPending, setSelectedRoleForPending] = useState<Record<string, WorkspaceRole>>({});

  const getMemberClientCount = (memberId: string): number => {
    return allMemberAccess.filter(a => a.workspace_member_id === memberId).length;
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    inviteMember.mutate({ email: email.trim(), role }, {
      onSuccess: () => {
        setEmail("");
        setRole("member");
      },
    });
  };

  const handleAddPendingUser = (pendingUser: PendingUser) => {
    const roleToAssign = selectedRoleForPending[pendingUser.id] || "member";
    addUserToWorkspace.mutate({ userId: pendingUser.id, role: roleToAssign });
  };

  if (!canManageTeam) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground py-12">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-medium mb-2">Acesso Restrito</h2>
          <p>Apenas administradores podem gerenciar a equipe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Equipe</h1>
          <p className="text-muted-foreground">
            Gerencie os membros do workspace "{workspace?.name}"
          </p>
        </div>
        {pendingUsers.length > 0 && (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            {pendingUsers.length} pendente{pendingUsers.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Pending Users - Most Important */}
      {pendingUsers.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-amber-500">Usuários Pendentes de Aprovação</CardTitle>
            </div>
            <CardDescription>
              Estes usuários criaram conta e aguardam liberação para acessar o workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPending ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <div
                    key={pendingUser.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-background border border-amber-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {pendingUser.full_name || pendingUser.email || "Usuário"}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          {pendingUser.email}
                          <span className="text-xs">
                            • Criado {formatDistanceToNow(new Date(pendingUser.created_at || new Date()), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={selectedRoleForPending[pendingUser.id] || "member"} 
                        onValueChange={(v) => setSelectedRoleForPending(prev => ({ ...prev, [pendingUser.id]: v as WorkspaceRole }))}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={() => handleAddPendingUser(pendingUser)}
                        disabled={addUserToWorkspace.isPending}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Liberar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Convidar Novo Membro</CardTitle>
          </div>
          <CardDescription>
            Envie um convite por email para adicionar alguém à equipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3">
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={inviteMember.isPending || !email.trim()}>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Convites Pendentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{invite.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Expira {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={roleColors[invite.role]}>
                      {roleLabels[invite.role]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancelInvite.mutate(invite.id)}
                      disabled={cancelInvite.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Membros Ativos ({members.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const RoleIcon = roleIcons[member.role];
                const isCurrentUser = member.user_id === user?.id;
                const isMemberOwner = member.role === "owner";
                const canChangeRole = isOwner && !isMemberOwner && !isCurrentUser;
                const canRemove = canManageTeam && !isMemberOwner && !isCurrentUser;
                const canEditClientAccess = canManageTeam && member.role === "member" && !isCurrentUser;
                const clientAccessCount = getMemberClientCount(member.id);

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <RoleIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          {member.profile?.full_name || member.profile?.email || "Usuário"}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground">(você)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {member.profile?.email}
                          {member.role === "member" && clientAccessCount > 0 && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">
                              {clientAccessCount} cliente{clientAccessCount > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditClientAccess && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMemberToEditAccess(member)}
                                className="h-8 gap-1.5"
                              >
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Clientes</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Gerenciar acesso a clientes
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {canChangeRole ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) =>
                            updateMemberRole.mutate({ memberId: member.id, role: v as WorkspaceRole })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Membro</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={roleColors[member.role]}>
                          {roleLabels[member.role]}
                        </Badge>
                      )}
                      {canRemove && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMemberToRemove(member.id)}
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

      {/* Permission Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissões por Cargo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <span><strong>Proprietário:</strong> Acesso total, pode gerenciar time e excluir qualquer item</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <span><strong>Admin:</strong> Pode gerenciar time (exceto owner) e excluir itens</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span><strong>Membro:</strong> Pode ver, criar e editar, mas não excluir. Pode ter acesso restrito a clientes específicos.</span>
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro do workspace? Ele perderá acesso a todos os clientes e dados.
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

      {/* Member Client Access Dialog */}
      <MemberClientAccessDialog
        open={!!memberToEditAccess}
        onOpenChange={(open) => !open && setMemberToEditAccess(null)}
        member={memberToEditAccess}
      />
    </div>
  );
}
