import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Settings, Edit2, MessageSquare, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { TemplateRulesDialog } from "./TemplateRulesDialog";
import { ClientTemplate, TemplateRule } from "@/types/template";

interface TemplateManagerProps {
  clientId: string;
}

export const TemplateManager = ({ clientId }: TemplateManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] = useState<'chat' | 'image'>('chat');
  const [editingTemplate, setEditingTemplate] = useState<ClientTemplate | null>(null);
  const { toast } = useToast();
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useClientTemplates(clientId);

  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para o template.",
        variant: "destructive",
      });
      return;
    }
    
    createTemplate.mutate({
      client_id: clientId,
      name: newTemplateName.trim(),
      type: newTemplateType,
    });
    
    setNewTemplateName("");
    setNewTemplateType('chat');
  };

  const handleRemoveTemplate = (id: string) => {
    deleteTemplate.mutate(id);
  };

  const handleSaveRules = (rules: TemplateRule[]) => {
    if (!editingTemplate) return;
    
    updateTemplate.mutate({
      id: editingTemplate.id,
      rules,
    });
    
    setEditingTemplate(null);
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                  Nenhum template criado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {template.type === 'image' ? (
                          <Image className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-primary" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{template.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-background border">
                              {template.type === 'image' ? 'Imagem' : 'Chat'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.rules.length} regra(s) definida(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => setEditingTemplate(template)}
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2"
                        >
                          <Edit2 className="h-3 w-3" />
                          Editar Regras
                        </Button>
                        <Button
                          onClick={() => handleRemoveTemplate(template.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Adicionar novo template */}
            <div className="space-y-3 pt-4 border-t">
              <Label htmlFor="newTemplate">Adicionar Novo Template</Label>
              <div className="space-y-2">
                <Select value={newTemplateType} onValueChange={(v: 'chat' | 'image') => setNewTemplateType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Template de Chat
                      </div>
                    </SelectItem>
                    <SelectItem value="image">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Template de Imagem
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    id="newTemplate"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder={newTemplateType === 'image' ? "Ex: Banner Instagram, Thumbnail YouTube..." : "Ex: Newsletter Semanal, Post Instagram..."}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTemplate();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddTemplate}
                    disabled={!newTemplateName.trim() || createTemplate.isPending}
                    className="gap-2 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
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
                    onClick={() => setNewTemplateName(suggestion)}
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

      <TemplateRulesDialog
        open={editingTemplate !== null}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
        template={editingTemplate}
        onSave={handleSaveRules}
      />
    </>
  );
};
