import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TemplateManagerProps {
  clientId: string;
  templates: string[];
}

export const TemplateManager = ({ clientId, templates }: TemplateManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localTemplates, setLocalTemplates] = useState<string[]>(templates);
  const [newTemplate, setNewTemplate] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateTemplates = useMutation({
    mutationFn: async (updatedTemplates: string[]) => {
      const { error } = await supabase
        .from("clients")
        .update({ function_templates: updatedTemplates })
        .eq("id", clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      toast({
        title: "Templates atualizados",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    },
  });

  const handleAddTemplate = () => {
    if (!newTemplate.trim()) return;
    
    const updated = [...localTemplates, newTemplate.trim()];
    setLocalTemplates(updated);
    setNewTemplate("");
    updateTemplates.mutate(updated);
  };

  const handleRemoveTemplate = (index: number) => {
    const updated = localTemplates.filter((_, i) => i !== index);
    setLocalTemplates(updated);
    updateTemplates.mutate(updated);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setLocalTemplates(templates);
      setNewTemplate("");
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="gap-2"
        size="sm"
      >
        <Settings className="h-4 w-4" />
        Gerenciar Templates
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Templates de Funções</DialogTitle>
            <DialogDescription>
              Adicione ou remova templates de funções repetitivas para este cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Lista de templates existentes */}
            <div className="space-y-3">
              <Label>Templates Existentes</Label>
              {localTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Nenhum template criado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {localTemplates.map((template, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <span className="text-sm font-medium">{template}</span>
                      <Button
                        onClick={() => handleRemoveTemplate(index)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Adicionar novo template */}
            <div className="space-y-3 pt-4 border-t">
              <Label htmlFor="newTemplate">Adicionar Novo Template</Label>
              <div className="flex gap-2">
                <Input
                  id="newTemplate"
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder="Ex: Newsletter Semanal, Post Instagram..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTemplate();
                    }
                  }}
                />
                <Button
                  onClick={handleAddTemplate}
                  disabled={!newTemplate.trim() || updateTemplates.isPending}
                  className="gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            {/* Exemplos de templates */}
            <div className="space-y-2 pt-2">
              <Label className="text-xs text-muted-foreground">
                Sugestões de Templates:
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Newsletter Semanal",
                  "Post Instagram",
                  "Story Instagram",
                  "Roteiro YouTube",
                  "Roteiro Reels",
                  "Thread Twitter",
                  "Carrossel",
                  "Legenda de Post",
                  "E-mail Marketing",
                  "Artigo Blog",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    onClick={() => setNewTemplate(suggestion)}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
