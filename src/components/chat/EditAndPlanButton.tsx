import { useState } from "react";
import { Edit3, CalendarPlus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";

interface EditAndPlanButtonProps {
  content: string;
  platform?: string;
  clientId?: string;
  clientName?: string;
}

export function EditAndPlanButton({
  content,
  platform,
  clientId,
  clientName,
}: EditAndPlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [selectedPlatform, setSelectedPlatform] = useState(platform || "instagram");
  const [scheduledDate, setScheduledDate] = useState("");
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { workspace } = useWorkspaceContext();
  const { user } = useAuth();

  const handleOpen = () => {
    setEditedContent(content);
    setSelectedPlatform(platform || "instagram");
    setTitle(content.substring(0, 50) + (content.length > 50 ? "..." : ""));
    setScheduledDate("");
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!workspace?.id || !user?.id) {
      toast({ description: "Erro: workspace ou usuário não encontrado", variant: "destructive" });
      return;
    }

    if (!title.trim()) {
      toast({ description: "Digite um título para o item", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("planning_items").insert({
        workspace_id: workspace.id,
        client_id: clientId || null,
        title: title.trim(),
        content: editedContent,
        platform: selectedPlatform,
        status: scheduledDate ? "scheduled" : "draft",
        scheduled_at: scheduledDate || null,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        description: scheduledDate 
          ? `Agendado para ${new Date(scheduledDate).toLocaleDateString("pt-BR")}` 
          : "Adicionado ao planejamento!",
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving to planning:", error);
      toast({ description: "Erro ao salvar no planejamento", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="h-7 text-xs gap-1.5"
      >
        <Edit3 className="h-3 w-3" />
        Editar e Planejar
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" />
              Editar e Adicionar ao Planejamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="plan-title">Título</Label>
              <Input
                id="plan-title"
                placeholder="Título do item no planejamento"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Content Editor */}
            <div className="space-y-2">
              <Label htmlFor="plan-content">Conteúdo</Label>
              <Textarea
                id="plan-content"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[150px] resize-none"
                placeholder="Edite o conteúdo antes de adicionar..."
              />
              <p className="text-xs text-muted-foreground">
                {editedContent.length} caracteres
              </p>
            </div>

            {/* Platform and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="blog">Blog</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-date">Agendar para (opcional)</Label>
                <Input
                  id="plan-date"
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
            </div>

            {clientName && (
              <p className="text-xs text-muted-foreground">
                Cliente: <span className="font-medium">{clientName}</span>
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving ? (
                "Salvando..."
              ) : scheduledDate ? (
                <>
                  <CalendarPlus className="h-4 w-4 mr-1" />
                  Agendar
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Adicionar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
