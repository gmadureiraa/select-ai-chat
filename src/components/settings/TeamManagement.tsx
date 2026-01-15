import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Crown, Shield, User, X, Mail, Clock, Building2, Eye, ChevronDown, ChevronUp, RefreshCw, Loader2, Check } from "lucide-react";
import { useWorkspace, WorkspaceRole, WorkspaceMember } from "@/hooks/useWorkspace";
import { useTeamMembers, WorkspaceInvite } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useAllMemberClientAccess } from "@/hooks/useMemberClientAccess";
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
  const queryClient = useQueryClient();

  // Fetch invite clients
  const { data: inviteClients = [] } = useQuery({
    queryKey: ["invite-clients", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from("workspace_invite_clients")
        .select("invite_id, client_id");
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspace?.id && invites.length > 0,
  });
  
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [showClientSelection, setShowClientSelection] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  // Inline client access editing state for members
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [editingClientIds, setEditingClientIds] = useState<string[]>([]);

  // Inline client access editing state for invites
  const [editingInvite, setEditingInvite] = useState<WorkspaceInvite | null>(null);
  const [editingInviteClientIds, setEditingInviteClientIds] = useState<string[]>([]);

  // Helper to get client access count for a member
  const getMemberClientCount = (memberId: string): number => {
    return allMemberAccess.filter(a => a.workspace_member_id === memberId).length;
  };

  // Get current client IDs for a member from allMemberAccess
  const getMemberClientIds = (memberId: string): string[] => {
    return allMemberAccess
      .filter(a => a.workspace_member_id === memberId)
      .map(a => a.client_id);
  };

  // Helper to get client access count for an invite
  const getInviteClientCount = (inviteId: string): number => {
    return inviteClients.filter(ic => ic.invite_id === inviteId).length;
  };

  // Get current client IDs for an invite
  const getInviteClientIds = (inviteId: string): string[] => {
    return inviteClients
      .filter(ic => ic.invite_id === inviteId)
      .map(ic => ic.client_id);
  };

  // Toggle client selection for invite form
  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  // Toggle client selection for member editing panel
  const toggleEditingClient = (clientId: string) => {
    setEditingClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  // Toggle client selection for invite editing panel
  const toggleEditingInviteClient = (clientId: string) => {
    setEditingInviteClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  // Open inline editing panel for member
  const openEditingPanel = (member: WorkspaceMember) => {
    closeInviteEditingPanel(); // Close invite panel if open
    const currentIds = getMemberClientIds(member.id);
    setEditingMember(member);
    setEditingClientIds(currentIds);
  };

  // Close inline editing panel for member
  const closeEditingPanel = () => {
    setEditingMember(null);
    setEditingClientIds([]);
  };

  // Open inline editing panel for invite
  const openInviteEditingPanel = (invite: WorkspaceInvite) => {
    closeEditingPanel(); // Close member panel if open
    const currentIds = getInviteClientIds(invite.id);
    setEditingInvite(invite);
    setEditingInviteClientIds(currentIds);
  };

  // Close inline editing panel for invite
  const closeInviteEditingPanel = () => {
    setEditingInvite(null);
    setEditingInviteClientIds([]);
  };

  // Mutation to save client access
  const saveClientAccess = useMutation({
    mutationFn: async ({ memberId, clientIds }: { memberId: string; clientIds: string[] }) => {
      // Delete all existing access
      const { error: deleteError } = await supabase
        .from("workspace_member_clients")
        .delete()
        .eq("workspace_member_id", memberId);

      if (deleteError) throw deleteError;

      // If no clients selected, done (full access for member, no access for viewer handled by UI)
      if (clientIds.length === 0) {
        return [];
      }

      // Insert new access records
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

  // Mutation to save invite client access
  const saveInviteClientAccess = useMutation({
    mutationFn: async ({ inviteId, clientIds }: { inviteId: string; clientIds: string[] }) => {
      // Delete all existing access
      const { error: deleteError } = await supabase
        .from("workspace_invite_clients")
        .delete()
        .eq("invite_id", inviteId);

      if (deleteError) throw deleteError;

      // If no clients selected, done
      if (clientIds.length === 0) {
        return [];
      }

      // Insert new access records
      const accessRecords = clientIds.map(clientId => ({
        invite_id: inviteId,
        client_id: clientId,
      }));

      const { data, error: insertError } = await supabase
        .from("workspace_invite_clients")
        .insert(accessRecords)
        .select();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-clients"] });
      toast({
        title: "Acesso atualizado",
        description: "Os clientes do convite foram atualizados.",
      });
      closeInviteEditingPanel();
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

  const handleSaveInviteClientAccess = () => {
    if (!editingInvite) return;
    saveInviteClientAccess.mutate({
      inviteId: editingInvite.id,
      clientIds: editingInviteClientIds,
    });
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

  const isViewerEditing = editingMember?.role === "viewer";

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
              <div className="relative w-[160px]">
                <select
                  aria-label="Cargo"
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                  className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="viewer">Visualizador</option>
                  <option value="member">Membro</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
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
                      <label
                        key={client.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(client.id)}
                          onChange={() => toggleClientSelection(client.id)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        <span className="text-sm">{client.name}</span>
                      </label>
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
            <p className="text-xs text-muted-foreground">
              Ao criar conta ou fazer login, o usuário terá acesso automaticamente ao workspace.
            </p>
            <div className="space-y-2">
              {invites.map((invite) => {
                const inviteClientCount = getInviteClientCount(invite.id);
                const canEditInviteClients = invite.role === "member" || invite.role === "viewer";
                const isEditingThisInvite = editingInvite?.id === invite.id;
                const isViewerInvite = invite.role === "viewer";

                return (
                  <div key={invite.id} className="space-y-2">
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed ${isEditingThisInvite ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{invite.email}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>Expira {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true, locale: ptBR })}</span>
                            {canEditInviteClients && inviteClientCount > 0 && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">
                                {inviteClientCount} cliente{inviteClientCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEditInviteClients && clients.length > 0 && (
                          <Button
                            variant={isEditingThisInvite ? "default" : "outline"}
                            size="sm"
                            title="Gerenciar acesso a clientes"
                            onClick={() => isEditingThisInvite ? closeInviteEditingPanel() : openInviteEditingPanel(invite)}
                            className="h-8 gap-1.5"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Clientes</span>
                          </Button>
                        )}
                        <Badge variant="outline" className={roleColors[invite.role]}>
                          {roleLabels[invite.role]}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reenviar email"
                          onClick={() => handleResendInvite(invite)}
                          disabled={resendingInviteId === invite.id}
                        >
                          <RefreshCw className={`h-4 w-4 ${resendingInviteId === invite.id ? "animate-spin" : ""}`} />
                        </Button>
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

                    {/* Inline Client Access Panel for Invite */}
                    {isEditingThisInvite && (
                      <div className="ml-7 p-4 border rounded-lg bg-background space-y-4">
                        {/* Access Mode Indicator */}
                        <div className="p-3 rounded-lg bg-muted/50 border">
                          {editingInviteClientIds.length > 0 ? (
                            <div className="flex items-start gap-2">
                              <Building2 className="h-4 w-4 text-amber-500 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium text-amber-600">Acesso restrito</span>
                                <p className="text-muted-foreground text-xs mt-0.5">
                                  {isViewerInvite ? "Visualizador" : "Membro"} só verá os clientes selecionados
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <Building2 className={`h-4 w-4 mt-0.5 ${isViewerInvite ? "text-red-500" : "text-emerald-500"}`} />
                              <div className="text-sm">
                                {isViewerInvite ? (
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
                                      Membro poderá ver todos os clientes do workspace
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
                              if (editingInviteClientIds.length === clients.length) {
                                setEditingInviteClientIds([]);
                              } else {
                                setEditingInviteClientIds(clients.map(c => c.id));
                              }
                            }}
                          >
                            {editingInviteClientIds.length === clients.length ? "Desmarcar todos" : "Selecionar todos"}
                          </Button>
                        </div>

                        {/* Client List */}
                        <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 space-y-1">
                          {clients.map((client) => {
                            const isSelected = editingInviteClientIds.includes(client.id);
                            return (
                              <label
                                key={client.id}
                                className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleEditingInviteClient(client.id)}
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
                          })}
                        </div>

                        {/* Info */}
                        <p className="text-xs text-muted-foreground">
                          {isViewerInvite 
                            ? "Visualizadores precisam ter pelo menos um cliente selecionado."
                            : "Deixe vazio para dar acesso a todos os clientes."}
                        </p>

                        {/* Actions */}
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={closeInviteEditingPanel}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveInviteClientAccess}
                            disabled={saveInviteClientAccess.isPending || (isViewerInvite && editingInviteClientIds.length === 0)}
                          >
                            {saveInviteClientAccess.isPending ? (
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
                        {/* Client Access Button */}
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
                          <div className="relative w-[140px]">
                            <select
                              aria-label="Alterar cargo"
                              value={member.role}
                              onChange={(e) => {
                                const v = e.target.value as WorkspaceRole;
                                if (v !== member.role) {
                                  updateMemberRole.mutate({ memberId: member.id, role: v });
                                }
                              }}
                              className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="viewer">Visualizador</option>
                              <option value="member">Membro</option>
                              <option value="admin">Admin</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          </div>
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
    </Card>
  );
}
