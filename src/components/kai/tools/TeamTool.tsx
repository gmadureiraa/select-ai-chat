import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, UserPlus, Crown, Shield, User, X, Mail, Clock, 
  Building2, UserCheck, AlertCircle, Eye, ChevronDown, ChevronUp, UserX, RotateCcw, Loader2, Check
} from "lucide-react";
import { useWorkspace, WorkspaceRole, WorkspaceMember } from "@/hooks/useWorkspace";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { usePendingUsers, PendingUser } from "@/hooks/usePendingUsers";
import { useAllMemberClientAccess } from "@/hooks/useMemberClientAccess";
import { useClients } from "@/hooks/useClients";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
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
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

export function TeamTool() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { workspace, canManageTeam, isOwner } = useWorkspace();
  const { members, invites, isLoadingMembers, isLoadingInvites, inviteMember, updateMemberRole, removeMember, cancelInvite } = useTeamMembers();
  const { pendingUsers, isLoading: isLoadingPending, addUserToWorkspace, rejectUser, rejectedUsers, unrejectUser, isLoadingRejected } = usePendingUsers();
  const { data: allMemberAccess = [] } = useAllMemberClientAccess(workspace?.id);
  const { clients } = useClients();
  const { canAddMember, membersRemaining, maxMembers } = usePlanLimits();
  const { showUpgradePrompt } = useUpgradePrompt();
  const queryClient = useQueryClient();
  
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showClientSelection, setShowClientSelection] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [selectedRoleForPending, setSelectedRoleForPending] = useState<Record<string, WorkspaceRole>>({});

  // Inline client access editing state
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [editingClientIds, setEditingClientIds] = useState<string[]>([]);

  const getMemberClientCount = (memberId: string): number => {
    return allMemberAccess.filter(a => a.workspace_member_id === memberId).length;
  };

  const getMemberClientIds = (memberId: string): string[] => {
    return allMemberAccess
      .filter(a => a.workspace_member_id === memberId)
      .map(a => a.client_id);
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleEditingClient = (clientId: string) => {
    setEditingClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const openEditingPanel = (member: WorkspaceMember) => {
    const currentIds = getMemberClientIds(member.id);
    setEditingMember(member);
    setEditingClientIds(currentIds);
  };

  const closeEditingPanel = () => {
    setEditingMember(null);
    setEditingClientIds([]);
  };

  // Mutation to save client access
  const saveClientAccess = useMutation({
    mutationFn: async ({ memberId, clientIds }: { memberId: string; clientIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from("workspace_member_clients")
        .delete()
        .eq("workspace_member_id", memberId);

      if (deleteError) throw deleteError;

      if (clientIds.length === 0) {
        return [];
      }

      const accessRecords = clientIds.map(clientId => ({
        workspace_member_id: memberId,
        client_id: clientId,
      }));

      const { data, error: insertError } = await supabase
        .from("workspace_member_clients")
        .insert(accessRecords)
        .select();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-member-client-access"] });
      queryClient.invalidateQueries({ queryKey: ["member-client-access"] });
      toast({
        title: "Acesso atualizado",
        description: "As permissões de cliente foram atualizadas.",
      });
      closeEditingPanel();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar acesso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveClientAccess = () => {
    if (!editingMember) return;
    saveClientAccess.mutate({
      memberId: editingMember.id,
      clientIds: editingClientIds,
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    if (!canAddMember) {
      showUpgradePrompt("max_members", `Você atingiu o limite de ${maxMembers} membro(s) do seu plano atual.`);
      return;
    }
    
    const clientIds = (role === "member" || role === "viewer") && selectedClients.length > 0 
      ? selectedClients 
      : undefined;
    
    inviteMember.mutate({ email: email.trim(), role, clientIds }, {
      onSuccess: () => {
        setEmail("");
        setRole("member");
        setSelectedClients([]);
        setShowClientSelection(false);
      },
    });
  };

  const handleAddPendingUser = (pendingUser: PendingUser) => {
    if (!canAddMember) {
      showUpgradePrompt("max_members", `Você atingiu o limite de ${maxMembers} membro(s) do seu plano atual.`);
      return;
    }
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

  const isViewerEditing = editingMember?.role === "viewer";

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
                            • Solicitou {formatDistanceToNow(new Date(pendingUser.requested_at || new Date()), { addSuffix: true, locale: ptBR })}
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
                          <SelectItem value="viewer">Visualizador</SelectItem>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => rejectUser.mutate({ userId: pendingUser.id })}
                        disabled={rejectUser.isPending}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Recusar
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleAddPendingUser(pendingUser)}
                        disabled={addUserToWorkspace.isPending}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
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

      {/* Rejected Users - Collapsible */}
      {rejectedUsers.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-muted-foreground">
              <span className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Usuários Recusados ({rejectedUsers.length})
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {rejectedUsers.map((rejected) => (
              <div
                key={rejected.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <UserX className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {rejected.profile?.full_name || rejected.profile?.email || "Usuário"}
                    </div>
                    <div className="text-xs text-muted-foreground">{rejected.profile?.email}</div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => unrejectUser.mutate(rejected.user_id)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restaurar
                </Button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
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
        <CardContent className="space-y-4">
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
                <SelectTrigger className="w-[150px]">
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

            {/* Client Selection for member/viewer */}
            {(role === "member" || role === "viewer") && clients.length > 0 && (
              <Collapsible open={showClientSelection} onOpenChange={setShowClientSelection}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    type="button"
                    className="w-full justify-between h-auto py-2 px-3 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>
                        {selectedClients.length === 0 
                          ? "Acesso a todos os clientes (padrão)" 
                          : `Acesso restrito a ${selectedClients.length} cliente${selectedClients.length > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    {showClientSelection ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">
                      Selecione clientes específicos para restringir acesso. Deixe vazio para acesso total.
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                      {clients.map((client) => (
                        <label
                          key={client.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors border",
                            selectedClients.includes(client.id)
                              ? "bg-primary/10 border-primary/30"
                              : "bg-background border-border hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(client.id)}
                            onChange={() => toggleClientSelection(client.id)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span className="text-sm truncate">{client.name}</span>
                        </label>
                      ))}
                    </div>
                    {selectedClients.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClients([])}
                        className="mt-2 text-xs"
                      >
                        Limpar seleção
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
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
                const canEditClientAccess = canManageTeam && (member.role === "member" || member.role === "viewer") && !isCurrentUser;
                const clientAccessCount = getMemberClientCount(member.id);
                const isEditing = editingMember?.id === member.id;

                return (
                  <div key={member.id} className="space-y-2">
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg bg-muted/30 ${isEditing ? "ring-2 ring-primary" : ""}`}
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
                            {(member.role === "member" || member.role === "viewer") && clientAccessCount > 0 && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">
                                {clientAccessCount} cliente{clientAccessCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEditClientAccess && (
                          <Button
                            variant={isEditing ? "default" : "outline"}
                            size="sm"
                            title="Gerenciar acesso a clientes"
                            onClick={() => isEditing ? closeEditingPanel() : openEditingPanel(member)}
                            className="h-8 gap-1.5"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Clientes</span>
                          </Button>
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

                    {/* Inline Client Access Panel */}
                    {isEditing && (
                      <div className="ml-11 p-4 border rounded-lg bg-background space-y-4">
                        {/* Access Mode Indicator */}
                        <div className="p-3 rounded-lg bg-muted/50 border">
                          {editingClientIds.length > 0 ? (
                            <div className="flex items-start gap-2">
                              <Building2 className="h-4 w-4 text-amber-500 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium text-amber-600">Acesso restrito</span>
                                <p className="text-muted-foreground text-xs mt-0.5">
                                  {isViewerEditing ? "Visualizador" : "Membro"} só verá os clientes selecionados abaixo
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <Building2 className={`h-4 w-4 mt-0.5 ${isViewerEditing ? "text-red-500" : "text-emerald-500"}`} />
                              <div className="text-sm">
                                {isViewerEditing ? (
                                  <>
                                    <span className="font-medium text-red-600">Sem acesso</span>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                      Visualizador não verá nenhum cliente. Selecione pelo menos um.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-emerald-600">Acesso total</span>
                                    <p className="text-muted-foreground text-xs mt-0.5">
                                      Membro pode ver todos os clientes do workspace
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Select All */}
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Clientes disponíveis</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (editingClientIds.length === clients.length) {
                                setEditingClientIds([]);
                              } else {
                                setEditingClientIds(clients.map(c => c.id));
                              }
                            }}
                          >
                            {editingClientIds.length === clients.length ? "Desmarcar todos" : "Selecionar todos"}
                          </Button>
                        </div>

                        {/* Client List with native checkboxes */}
                        <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 space-y-1">
                          {clients.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                              Nenhum cliente cadastrado
                            </div>
                          ) : (
                            clients.map((client) => {
                              const isSelected = editingClientIds.includes(client.id);
                              return (
                                <label
                                  key={client.id}
                                  className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleEditingClient(client.id)}
                                    className="h-4 w-4 rounded border-input accent-primary"
                                  />
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-semibold text-primary">
                                        {client.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium truncate">{client.name}</span>
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>

                        {/* Info */}
                        <p className="text-xs text-muted-foreground">
                          {isViewerEditing 
                            ? "Visualizadores precisam ter pelo menos um cliente selecionado."
                            : "Deixe vazio para dar acesso a todos os clientes."}
                        </p>

                        {/* Actions */}
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={closeEditingPanel}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveClientAccess}
                            disabled={saveClientAccess.isPending || (isViewerEditing && editingClientIds.length === 0)}
                          >
                            {saveClientAccess.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Salvar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
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
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-500" />
            <span><strong>Visualizador:</strong> Apenas visualiza clientes atribuídos. Não vê ferramentas. Ideal para clientes externos.</span>
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
    </div>
  );
}
