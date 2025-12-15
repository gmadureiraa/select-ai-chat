import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Building2 } from "lucide-react";
import { useMemberClientAccess } from "@/hooks/useMemberClientAccess";
import { useClients } from "@/hooks/useClients";
import { WorkspaceMember } from "@/hooks/useWorkspace";

interface MemberClientAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WorkspaceMember | null;
}

export function MemberClientAccessDialog({
  open,
  onOpenChange,
  member,
}: MemberClientAccessDialogProps) {
  const { clients = [], isLoading: isLoadingClients } = useClients();
  const { memberClients, isLoading: isLoadingAccess, updateMemberClients, clientIds } = useMemberClientAccess(member?.id);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  // Initialize selected clients when dialog opens or member changes
  useEffect(() => {
    if (open && member && !isLoadingAccess) {
      setSelectedClients(clientIds);
    }
  }, [open, member, clientIds, isLoadingAccess]);

  const handleToggleClient = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
  };

  const handleSave = () => {
    if (!member) return;
    
    updateMemberClients.mutate(
      { memberId: member.id, clientIds: selectedClients },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const isLoading = isLoadingClients || isLoadingAccess;
  const hasRestrictions = selectedClients.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Acesso a Clientes
          </DialogTitle>
          <DialogDescription>
            {member?.profile?.full_name || member?.profile?.email || "Membro"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Access Mode Indicator */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              {hasRestrictions ? (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-medium text-amber-600">Acesso restrito</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Membro só verá os clientes selecionados abaixo
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-medium text-emerald-600">Acesso total</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Membro pode ver todos os clientes do workspace
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Select All */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Clientes disponíveis</Label>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedClients.length === clients.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            {/* Client List */}
            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-2 space-y-1">
                {clients.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhum cliente cadastrado
                  </div>
                ) : (
                  clients.map((client) => (
                    <label
                      key={client.id}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedClients.includes(client.id)}
                        onCheckedChange={() => handleToggleClient(client.id)}
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
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Info */}
            <p className="text-xs text-muted-foreground">
              Deixe vazio para dar acesso a todos os clientes. Selecione clientes específicos para restringir o acesso.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateMemberClients.isPending}
          >
            {updateMemberClients.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
