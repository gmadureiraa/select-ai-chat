import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClients } from "@/hooks/useClients";
import { useGenerateClientContext } from "@/hooks/useGenerateClientContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Sparkles, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientDialog = ({ open, onOpenChange }: ClientDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [generatedContext, setGeneratedContext] = useState("");
  const [showGeneratedContext, setShowGeneratedContext] = useState(false);
  
  // Structured fields
  const [websites, setWebsites] = useState<string[]>([]);
  const [websiteInput, setWebsiteInput] = useState("");
  const [socialMedia, setSocialMedia] = useState({
    instagram: "",
    linkedin: "",
    facebook: "",
    twitter: "",
  });
  const [tags, setTags] = useState({
    segment: "",
    tone: "",
    objectives: "",
    audience: "",
  });

  // Function templates
  const [functionTemplates, setFunctionTemplates] = useState<string[]>([]);
  const [templateInput, setTemplateInput] = useState("");
  
  const { createClient } = useClients();
  const { generateContext, isGenerating } = useGenerateClientContext();

  const addWebsite = () => {
    if (websiteInput.trim() && !websites.includes(websiteInput.trim())) {
      setWebsites([...websites, websiteInput.trim()]);
      setWebsiteInput("");
    }
  };

  const removeWebsite = (url: string) => {
    setWebsites(websites.filter(w => w !== url));
  };

  const addTemplate = () => {
    if (templateInput.trim() && !functionTemplates.includes(templateInput.trim())) {
      setFunctionTemplates([...functionTemplates, templateInput.trim()]);
      setTemplateInput("");
    }
  };

  const removeTemplate = (template: string) => {
    setFunctionTemplates(functionTemplates.filter(t => t !== template));
  };

  const handleGenerateContext = async () => {
    const context = await generateContext({
      name,
      description,
      tags,
      social_media: socialMedia,
      function_templates: functionTemplates,
    });

    if (context) {
      setGeneratedContext(context);
      setShowGeneratedContext(true);
    }
  };

  const handleUseGeneratedContext = () => {
    setContextNotes(generatedContext);
    setShowGeneratedContext(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createClient.mutateAsync({
      name,
      description: description || null,
      context_notes: contextNotes || null,
      social_media: socialMedia,
      tags: tags,
      function_templates: functionTemplates,
      websites,
    });

    // Reset form
    setName("");
    setDescription("");
    setContextNotes("");
    setGeneratedContext("");
    setShowGeneratedContext(false);
    setWebsites([]);
    setWebsiteInput("");
    setSocialMedia({ instagram: "", linkedin: "", facebook: "", twitter: "" });
    setTags({ segment: "", tone: "", objectives: "", audience: "" });
    setFunctionTemplates([]);
    setTemplateInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
          <DialogDescription>
            Crie um novo cliente e defina o contexto estruturado para o chat
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="websites">Websites</TabsTrigger>
              <TabsTrigger value="social">Redes Sociais</TabsTrigger>
              <TabsTrigger value="tags">Tags/Notas</TabsTrigger>
              <TabsTrigger value="templates">Padrões</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Cliente *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Empresa XYZ"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição do cliente..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context">Contexto Fixo do Chat</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateContext}
                    disabled={!name.trim() || isGenerating}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        Gerar com IA
                      </>
                    )}
                  </Button>
                </div>
                
                {showGeneratedContext && (
                  <Alert className="mb-2">
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>Contexto gerado! Revise e edite abaixo antes de usar.</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleUseGeneratedContext}
                        >
                          Usar Contexto
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowGeneratedContext(false)}
                        >
                          Descartar
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {showGeneratedContext ? (
                  <Textarea
                    value={generatedContext}
                    onChange={(e) => setGeneratedContext(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    placeholder="Contexto gerado aparecerá aqui..."
                  />
                ) : (
                  <Textarea
                    id="context"
                    value={contextNotes}
                    onChange={(e) => setContextNotes(e.target.value)}
                    placeholder="Informações importantes, estratégias, objetivos, etc. que o chat deve sempre considerar..."
                    rows={6}
                  />
                )}
                
                <p className="text-xs text-muted-foreground">
                  Este contexto será incluído em todas as conversas com este cliente
                </p>
              </div>
            </TabsContent>

            <TabsContent value="websites" className="space-y-4">
              <div className="space-y-2">
                <Label>Websites do Cliente</Label>
                <p className="text-xs text-muted-foreground">
                  Adicione websites que serão automaticamente extraídos para contexto
                </p>
                <div className="flex gap-2">
                  <Input
                    value={websiteInput}
                    onChange={(e) => setWebsiteInput(e.target.value)}
                    placeholder="https://exemplo.com"
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addWebsite())}
                  />
                  <Button type="button" onClick={addWebsite} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {websites.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {websites.map((url) => (
                      <div key={url} className="flex items-center justify-between bg-muted p-2 rounded">
                        <span className="text-sm truncate">{url}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWebsite(url)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={socialMedia.instagram}
                    onChange={(e) => setSocialMedia({ ...socialMedia, instagram: e.target.value })}
                    placeholder="@usuario ou URL completa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={socialMedia.linkedin}
                    onChange={(e) => setSocialMedia({ ...socialMedia, linkedin: e.target.value })}
                    placeholder="URL do perfil ou empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    value={socialMedia.facebook}
                    onChange={(e) => setSocialMedia({ ...socialMedia, facebook: e.target.value })}
                    placeholder="URL da página"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter">Twitter/X</Label>
                  <Input
                    id="twitter"
                    value={socialMedia.twitter}
                    onChange={(e) => setSocialMedia({ ...socialMedia, twitter: e.target.value })}
                    placeholder="@usuario ou URL"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tags" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="segment">Segmento/Indústria</Label>
                  <Input
                    id="segment"
                    value={tags.segment}
                    onChange={(e) => setTags({ ...tags, segment: e.target.value })}
                    placeholder="Ex: E-commerce, SaaS, Educação"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tone">Tom de Voz</Label>
                  <Input
                    id="tone"
                    value={tags.tone}
                    onChange={(e) => setTags({ ...tags, tone: e.target.value })}
                    placeholder="Ex: Profissional, Descontraído, Inspirador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objectives">Objetivos</Label>
                  <Textarea
                    id="objectives"
                    value={tags.objectives}
                    onChange={(e) => setTags({ ...tags, objectives: e.target.value })}
                    placeholder="Principais objetivos e metas do cliente"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audience">Público-Alvo</Label>
                  <Textarea
                    id="audience"
                    value={tags.audience}
                    onChange={(e) => setTags({ ...tags, audience: e.target.value })}
                    placeholder="Descrição do público-alvo principal"
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="space-y-2">
                <Label>Funções/Padrões Recorrentes</Label>
                <p className="text-xs text-muted-foreground">
                  Defina contextos de funções que você costuma realizar para este cliente
                </p>
                <div className="flex gap-2">
                  <Textarea
                    value={templateInput}
                    onChange={(e) => setTemplateInput(e.target.value)}
                    placeholder="Ex: Criar posts para Instagram seguindo a identidade visual da marca..."
                    rows={3}
                  />
                  <Button type="button" onClick={addTemplate} size="icon" className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {functionTemplates.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <p className="text-sm font-medium">Padrões Definidos:</p>
                    {functionTemplates.map((template, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-muted p-3 rounded">
                        <p className="text-sm flex-1">{template}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => removeTemplate(template)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Criar Cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
