import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Check, X, Image, FileText, Type, Upload } from "lucide-react";
import { ClientTemplate, TemplateRule } from "@/types/template";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [newRuleType, setNewRuleType] = useState<'text' | 'image_reference' | 'content_reference'>('text');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const { toast } = useToast();

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
      type: newRuleType,
    };
    
    const updatedRules = [...rules, newRuleObj];
    setRules(updatedRules);
    setNewRule("");
    setNewRuleType('text');
  };

  const handleFileUpload = async (file: File) => {
    if (!template) return;
    
    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${template.client_id}/${template.id}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-files')
        .getPublicUrl(fileName);

      const newRuleObj: TemplateRule = {
        id: crypto.randomUUID(),
        content: newRule.trim() || file.name,
        type: newRuleType,
        file_url: publicUrl,
      };
      
      const updatedRules = [...rules, newRuleObj];
      setRules(updatedRules);
      setNewRule("");
      setNewRuleType('text');
      
      toast({
        title: "Arquivo enviado",
        description: "Referência adicionada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
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
                        <div className="flex-1 space-y-1">
                          <span className="text-sm">{rule.content}</span>
                          {rule.type === 'image_reference' && rule.file_url && (
                            <div className="mt-2">
                              <img 
                                src={rule.file_url} 
                                alt="Referência"
                                className="max-w-xs rounded border"
                              />
                            </div>
                          )}
                          {rule.type === 'content_reference' && rule.file_url && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <FileText className="h-3 w-3" />
                              <span>Arquivo de referência anexado</span>
                            </div>
                          )}
                          {rule.type && rule.type !== 'text' && (
                            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-background border mt-1">
                              {rule.type === 'image_reference' ? 'Imagem Ref.' : 'Conteúdo Ref.'}
                            </span>
                          )}
                        </div>
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
            <Label>Adicionar Nova Regra</Label>
            
            <div className="space-y-3">
              <Select 
                value={newRuleType} 
                onValueChange={(v: 'text' | 'image_reference' | 'content_reference') => setNewRuleType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      Regra de Texto
                    </div>
                  </SelectItem>
                  {template?.type === 'image' && (
                    <SelectItem value="image_reference">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Imagem de Referência
                      </div>
                    </SelectItem>
                  )}
                  {template?.type === 'chat' && (
                    <SelectItem value="content_reference">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Referência de Conteúdo
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {newRuleType === 'text' ? (
                <div className="flex gap-2">
                  <Input
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
              ) : (
                <div className="space-y-2">
                  <Input
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    placeholder={
                      newRuleType === 'image_reference' 
                        ? "Descrição da referência (opcional)" 
                        : "Descrição da referência de conteúdo (opcional)"
                    }
                  />
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept={newRuleType === 'image_reference' ? 'image/*' : '.txt,.md,.doc,.docx,.pdf'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      disabled={uploadingFile}
                      className="flex-1"
                    />
                    <Button
                      disabled={uploadingFile}
                      className="gap-2 shrink-0"
                      variant="outline"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingFile ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </div>
                  {newRuleType === 'image_reference' && (
                    <p className="text-xs text-muted-foreground">
                      Use para mostrar estilo, composição ou elementos visuais desejados
                    </p>
                  )}
                  {newRuleType === 'content_reference' && (
                    <p className="text-xs text-muted-foreground">
                      Use para mostrar estrutura e linguagem de conteúdos similares (não copia o tema)
                    </p>
                  )}
                </div>
              )}
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
