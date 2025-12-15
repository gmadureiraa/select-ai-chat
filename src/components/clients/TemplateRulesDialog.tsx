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
import { Plus, Trash2, Edit2, Check, X, Image, FileText, Type, Upload, Loader2, Sparkles } from "lucide-react";
import { ClientTemplate, TemplateRule } from "@/types/template";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const { toast } = useToast();

  // Check if we have style analysis already
  const hasStyleAnalysis = rules.some(r => (r as any).styleAnalysis);
  const imageReferenceCount = rules.filter(r => r.type === 'image_reference').length;

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
      const folder = `${template.client_id}/${template.id}`;
      const { signedUrl, error } = await uploadAndGetSignedUrl(file, folder);

      if (error) throw error;

      const newRuleObj: TemplateRule = {
        id: crypto.randomUUID(),
        content: newRule.trim() || file.name,
        type: newRuleType,
        file_url: signedUrl || "",
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

  // Analyze all image references to extract style
  const handleAnalyzeStyle = async () => {
    const imageRules = rules.filter(r => r.type === 'image_reference' && r.file_url);
    
    if (imageRules.length === 0) {
      toast({
        title: "Sem imagens",
        description: "Adicione imagens de referência primeiro.",
        variant: "destructive",
      });
      return;
    }

    setAnalyzingStyle(true);
    try {
      const imageUrls = imageRules.map(r => r.file_url).filter(Boolean);
      
      const { data, error } = await supabase.functions.invoke("analyze-style", {
        body: { imageUrls },
      });

      if (error) throw error;

      if (data?.styleAnalysis) {
        // Add style analysis as a special rule
        const styleRule: TemplateRule = {
          id: crypto.randomUUID(),
          content: `Análise de estilo visual: ${data.styleAnalysis.style_summary || 'Estilo analisado'}`,
          type: 'text',
          styleAnalysis: data.styleAnalysis,
        };

        // Remove any previous style analysis rule
        const filteredRules = rules.filter(r => !(r as any).styleAnalysis);
        setRules([...filteredRules, styleRule]);

        toast({
          title: "Estilo analisado!",
          description: "A análise será usada automaticamente na geração de imagens.",
        });
      }
    } catch (error: any) {
      console.error("Style analysis error:", error);
      toast({
        title: "Erro na análise",
        description: error.message || "Não foi possível analisar o estilo.",
        variant: "destructive",
      });
    } finally {
      setAnalyzingStyle(false);
    }
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
          {/* Style Analysis Button for Image Templates */}
          {template?.type === 'image' && imageReferenceCount > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Análise de Estilo Visual
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {hasStyleAnalysis 
                      ? "Estilo já analisado. Clique para atualizar."
                      : `Analise ${imageReferenceCount} imagem(ns) para extrair o estilo visual`
                    }
                  </p>
                </div>
                <Button
                  onClick={handleAnalyzeStyle}
                  disabled={analyzingStyle}
                  variant={hasStyleAnalysis ? "outline" : "default"}
                  className="gap-2"
                >
                  {analyzingStyle ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {hasStyleAnalysis ? "Reanalisar" : "Analisar Estilo"}
                    </>
                  )}
                </Button>
              </div>
              
              {/* Show current style analysis */}
              {hasStyleAnalysis && (
                <div className="text-xs p-2 bg-background rounded border">
                  {(() => {
                    const styleRule = rules.find(r => (r as any).styleAnalysis);
                    const analysis = (styleRule as any)?.styleAnalysis;
                    return analysis?.style_summary || "Estilo analisado com sucesso";
                  })()}
                </div>
              )}
            </div>
          )}

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
                    className={`flex items-start gap-2 p-3 rounded-lg ${
                      (rule as any).styleAnalysis ? 'bg-primary/10 border border-primary/20' : 'bg-muted'
                    }`}
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
                          {(rule as any).styleAnalysis && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary mt-1">
                              <Sparkles className="h-3 w-3" />
                              Análise de Estilo
                            </span>
                          )}
                          {rule.type && rule.type !== 'text' && !(rule as any).styleAnalysis && (
                            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-background border mt-1">
                              {rule.type === 'image_reference' ? 'Imagem Ref.' : 'Conteúdo Ref.'}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!(rule as any).styleAnalysis && (
                            <Button
                              onClick={() => handleStartEdit(rule)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
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
                      Adicione imagens para definir o estilo visual. Depois clique em "Analisar Estilo" para extrair as características automaticamente.
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