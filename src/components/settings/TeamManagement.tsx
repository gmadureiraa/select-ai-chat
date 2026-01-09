import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, UserPlus, Crown, Shield, User, X, Mail, Clock, Building2, Eye, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useWorkspace, WorkspaceRole, WorkspaceMember } from "@/hooks/useWorkspace";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useAllMemberClientAccess } from "@/hooks/useMemberClientAccess";
import { MemberClientAccessDialog } from "./MemberClientAccessDialog";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";
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
  member: User,
  viewer: Eye,
};

const roleColors: Record<WorkspaceRole, string> = {
  owner: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  member: "bg-muted text-muted-foreground border-border",
  viewer: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export function TeamManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { workspace, canManageTeam, isOwner } = useWorkspace();
  const { members, invites, isLoadingMembers, isLoadingInvites, inviteMember, updateMemberRole, removeMember, cancelInvite } = useTeamMembers();
  const { clients } = useClients();
  const { data: allMemberAccess = [] } = useAllMemberClientAccess(workspace?.id);
  
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [showClientSelection, setShowClientSelection] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [memberToEditAccess, setMemberToEditAccess] = useState<WorkspaceMember | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  // Helper to get client access count for a member
  const getMemberClientCount = (memberId: string): number => {
    return allMemberAccess.filter(a => a.workspace_member_id === memberId).length;
  };

  // Toggle client selection
  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    // Get selected client names for the email
    const selectedClientNames = clients
      .filter(c => selectedClientIds.includes(c.id))
      .map(c => c.name);
    
    inviteMember.mutate({ 
      email: email.trim(), 
      role,
      clientIds: (role === "member" || role === "viewer") ? selectedClientIds : undefined,
      clientNames: (role === "member" || role === "viewer") ? selectedClientNames : undefined,
    }, {
      onSuccess: () => {
        setEmail("");
        setRole("member");
        setSelectedClientIds([]);
        setShowClientSelection(false);
      },
    });
  };

  // Resend invite email
  const handleResendInvite = async (invite: typeof invites[0]) => {
    setResendingInviteId(invite.id);
    try {
      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", invite.invited_by)
        .single();

      await supabase.functions.invoke("send-invite-email", {
        body: {
          email: invite.email,
          workspaceName: workspace?.name || "",
          inviterName: inviterProfile?.full_name || inviterProfile?.email || "Um administrador",
          role: invite.role,
          expiresAt: invite.expires_at,
        },
      });

      toast({
        title: "Email reenviado",
        description: `O convite foi reenviado para ${invite.email}.`,
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

  if (!canManageTeam) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Time</CardTitle>
        </div>
        <CardDescription>
          Gerencie os membros do workspace "{workspace?.name}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="invite-email">Email do novo membro</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={inviteMember.isPending || !email.trim()}>
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar
              </Button>
            </div>

            {/* Client Selection for member/viewer roles */}
            {(role === "member" || role === "viewer") && clients.length > 0 && (
              <Collapsible open={showClientSelection} onOpenChange={setShowClientSelection}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Restringir acesso a clientes específicos
                      {selectedClientIds.length > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          {selectedClientIds.length} selecionado{selectedClientIds.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </span>
                    {showClientSelection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    <p className="text-xs text-muted-foreground mb-2">
                      {selectedClientIds.length === 0 
                        ? "Nenhum cliente selecionado = acesso a todos os clientes"
                        : "Selecione os clientes que este membro poderá acessar:"}
                    </p>
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleClientSelection(client.id)}
                      >
                        <Checkbox
                          checked={selectedClientIds.includes(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                        <span className="text-sm">{client.name}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </form>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Convites Pendentes
            </h4>
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResendInvite(invite)}
                            disabled={resendingInviteId === invite.id}
                          >
                            <RefreshCw className={`h-4 w-4 ${resendingInviteId === invite.id ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reenviar email</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
          </div>
        )}

        {/* Members List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Membros Ativos</h4>
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
                const isMemberViewer = member.role === "viewer";
                const canChangeRole = isOwner && !isMemberOwner && !isCurrentUser;
                const canRemove = canManageTeam && !isMemberOwner && !isCurrentUser;
                // Allow client access editing for both members and viewers
                const canEditClientAccess = canManageTeam && (member.role === "member" || member.role === "viewer") && !isCurrentUser;
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
                      {/* Client Access Button (only for members) */}
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
                          key={`role-select-${member.id}`}
                          value={member.role}
                          onValueChange={(v) => {
                            if (v !== member.role) {
                              updateMemberRole.mutate({ memberId: member.id, role: v as WorkspaceRole });
                            }
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Visualizador</SelectItem>
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
        </div>

        {/* Permission Legend */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Permissões por Cargo</h4>
          <div className="grid gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Crown className="h-3 w-3 text-amber-500" />
              <span><strong>Proprietário:</strong> Acesso total, pode gerenciar time e excluir qualquer item</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-blue-500" />
              <span><strong>Admin:</strong> Pode gerenciar time (exceto owner) e excluir itens</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span><strong>Membro:</strong> Pode ver, criar e editar, mas não excluir. Pode ter acesso restrito a clientes específicos.</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-3 w-3 text-purple-500" />
              <span><strong>Visualizador:</strong> Apenas visualiza clientes atribuídos. Não vê ferramentas. Ideal para clientes externos.</span>
            </div>
          </div>
        </div>
      </CardContent>

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
    </Card>
  );
}
