import { useState } from "react";
import { useResearchSharing, SharePermission } from "@/hooks/useResearchSharing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Share2,
  UserPlus,
  Trash2,
  Eye,
  Edit,
  Shield,
  Copy,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SharingDialogProps {
  projectId: string;
  projectName?: string;
}

const permissionLabels: Record<SharePermission, { label: string; icon: React.ReactNode }> = {
  view: { label: "Visualizar", icon: <Eye className="h-3.5 w-3.5" /> },
  edit: { label: "Editar", icon: <Edit className="h-3.5 w-3.5" /> },
  admin: { label: "Admin", icon: <Shield className="h-3.5 w-3.5" /> },
};

export const SharingDialog = ({ projectId, projectName }: SharingDialogProps) => {
  const { shares, shareProject, updatePermission, removeShare } = useResearchSharing(projectId);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<SharePermission>("view");
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (!email.trim()) return;
    shareProject.mutate({ email, permission });
    setEmail("");
    setPermission("view");
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/research-lab?project=${projectId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhar "{projectName || "Projeto"}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Copy link section */}
          <div className="space-y-2">
            <Label>Link do projeto</Label>
            <div className="flex gap-2">
              <Input
                value={`${window.location.origin}/research-lab?project=${projectId}`}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Add person section */}
          <div className="space-y-2">
            <Label>Convidar por email</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@exemplo.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
              />
              <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Visualizar</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleShare} disabled={!email.trim() || shareProject.isPending}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Shared with list */}
          {shares.length > 0 && (
            <div className="space-y-2">
              <Label>Pessoas com acesso</Label>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-2">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {share.shared_with_email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(share.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={share.permission}
                          onValueChange={(v) => 
                            updatePermission.mutate({ id: share.id, permission: v as SharePermission })
                          }
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">
                              <div className="flex items-center gap-2">
                                {permissionLabels.view.icon}
                                {permissionLabels.view.label}
                              </div>
                            </SelectItem>
                            <SelectItem value="edit">
                              <div className="flex items-center gap-2">
                                {permissionLabels.edit.icon}
                                {permissionLabels.edit.label}
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                {permissionLabels.admin.icon}
                                {permissionLabels.admin.label}
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeShare.mutate(share.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {shares.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este projeto ainda não foi compartilhado com ninguém
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
