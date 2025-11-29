import { useState, useEffect } from "react";
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
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { ClientTemplate, TemplateRule } from "@/types/template";

interface TemplateRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ClientTemplate | null;
  onSave: (rules: TemplateRule[]) => void;
}

export const TemplateRulesDialog = ({
  open,
  onOpenChange,
  template,
  onSave,
}: TemplateRulesDialogProps) => {
  const [rules, setRules] = useState<TemplateRule[]>([]);
  const [newRule, setNewRule] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  useEffect(() => {
    if (template) {
      setRules(template.rules || []);
    }
  }, [template]);

  const handleAddRule = () => {
    if (!newRule.trim()) return;
    
    const newRuleObj: TemplateRule = {
      id: crypto.randomUUID(),
      content: newRule.trim(),
    };
    
    const updatedRules = [...rules, newRuleObj];
    setRules(updatedRules);
    setNewRule("");
  };

  const handleRemoveRule = (id: string) => {
    const updatedRules = rules.filter(rule => rule.id !== id);
    setRules(updatedRules);
  };

  const handleStartEdit = (rule: TemplateRule) => {
    setEditingId(rule.id);
    setEditingContent(rule.content);
  };

  const handleSaveEdit = () => {
    if (!editingContent.trim() || !editingId) return;
    
    const updatedRules = rules.map(rule =>
      rule.id === editingId
        ? { ...rule, content: editingContent.trim() }
        : rule
    );
    
    setRules(updatedRules);
    setEditingId(null);
    setEditingContent("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent("");
  };

  const handleSave = () => {
    onSave(rules);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Regras: {template?.name}</DialogTitle>
          <DialogDescription>
            Gerencie as regras e instruções para este template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Lista de regras */}
          <div className="space-y-3">
            <Label>Regras Atuais</Label>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                Nenhuma regra definida ainda
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="flex items-start gap-2 p-3 bg-muted rounded-lg"
                  >
                    <span className="text-xs font-medium text-muted-foreground mt-1 shrink-0">
                      {index + 1}.
                    </span>
                    
                    {editingId === rule.id ? (
                      <div className="flex-1 flex gap-2">
                        <Input
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEdit();
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                        />
                        <Button
                          onClick={handleSaveEdit}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm flex-1">{rule.content}</span>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            onClick={() => handleStartEdit(rule)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => handleRemoveRule(rule.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar nova regra */}
          <div className="space-y-3 pt-4 border-t">
            <Label htmlFor="newRule">Adicionar Nova Regra</Label>
            <div className="flex gap-2">
              <Input
                id="newRule"
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                placeholder="Ex: Sempre incluir emojis relevantes..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddRule();
                  }
                }}
              />
              <Button
                onClick={handleAddRule}
                disabled={!newRule.trim()}
                className="gap-2 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Botão salvar */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
