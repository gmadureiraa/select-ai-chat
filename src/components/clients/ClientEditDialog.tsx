import { useState, useEffect } from "react";
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
import { useClients, Client } from "@/hooks/useClients";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ClientDocumentsManager } from "./ClientDocumentsManager";

interface ClientEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export const ClientEditDialog = ({ open, onOpenChange, client }: ClientEditDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [identityGuide, setIdentityGuide] = useState("");
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  
  // Structured fields
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
  
  const { updateClient } = useClients();
  const { toast } = useToast();

  useEffect(() => {
    if (client) {
      setName(client.name);
      setDescription(client.description || "");
      setContextNotes(client.context_notes || "");
      setIdentityGuide((client as any).identity_guide || "");
      setSocialMedia(client.social_media as any || { instagram: "", linkedin: "", facebook: "", twitter: "" });
      setTags(client.tags as any || { segment: "", tone: "", objectives: "", audience: "" });
      setFunctionTemplates((client.function_templates as string[]) || []);
    }
  }, [client]);

  // Load guide from public folder
  const loadGuideFromFolder = async () => {
    if (!client) return;
    
    setIsLoadingGuide(true);
    try {
      const slugMap: Record<string, string> = {
        'Gabriel Madureira': 'madureira',
        'Madureira': 'madureira',
        'NeoBankless': 'neobankless',
        'Neobankless': 'neobankless',
        'Defiverso': 'defiverso',
        'Jornal Cripto': 'jornal-cripto',
        'Kaleidos': 'kaleidos',
        'Layla Foz': 'layla-foz',
      };
      
      const slug = slugMap[client.name] || client.name.toLowerCase().replace(/\s+/g, '-');
      const response = await fetch(`/clients/${slug}/guia-conteudo.md`);
      
      if (response.ok) {
        const content = await response.text();
        if (content && !content.includes('<!DOCTYPE html>')) {
          setIdentityGuide(content);
          toast({
            title: "Guia carregado",
            description: "Conteúdo importado do arquivo guia-conteudo.md",
          });
        } else {
          toast({
            title: "Arquivo não encontrado",
            description: `Não foi possível encontrar /clients/${slug}/guia-conteudo.md`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Arquivo não encontrado",
          description: `Não foi possível encontrar /clients/${slug}/guia-conteudo.md`,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Erro ao carregar",
        description: "Falha ao buscar arquivo de guia",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGuide(false);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) return;

    await updateClient.mutateAsync({
      id: client.id,
      name,
      description: description || null,
      context_notes: contextNotes || null,
      identity_guide: identityGuide || null,
      social_media: socialMedia,
      tags: tags,
      function_templates: functionTemplates,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações e contexto do cliente
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="identity">Identidade</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
              <TabsTrigger value="social">Redes</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
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
                <Label htmlFor="context">Contexto Fixo do Chat</Label>
                <Textarea
                  id="context"
                  value={contextNotes}
                  onChange={(e) => setContextNotes(e.target.value)}
                  placeholder="Informações importantes, estratégias, objetivos, etc. que o chat deve sempre considerar..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Este contexto será incluído em todas as conversas com este cliente
                </p>
              </div>
            </TabsContent>

            <TabsContent value="identity" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="identity">Guia de Identidade e Posicionamento</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadGuideFromFolder}
                    disabled={isLoadingGuide}
                    className="gap-2"
                  >
                    {isLoadingGuide ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Importar de Arquivo
                  </Button>
                </div>
                <Textarea
                  id="identity"
                  value={identityGuide}
                  onChange={(e) => setIdentityGuide(e.target.value)}
                  placeholder={`# Posicionamento do Cliente

## Tom de Voz
- Técnico mas acessível
- Direto e sem rodeios
- etc.

## Pilares de Conteúdo
1. Marketing e Estratégia
2. Empreendedorismo
3. etc.

## Estratégia por Plataforma
### Instagram
- Carrosséis educativos
- Stories diários

### Twitter/X
- Threads técnicas
- Opiniões fortes`}
                  rows={20}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Este guia completo de identidade será a PRIMEIRA informação que a IA receberá ao criar conteúdo. 
                  Inclua posicionamento, tom de voz, pilares de conteúdo, estratégias por plataforma e exemplos.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              {client && <ClientDocumentsManager clientId={client.id} />}
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
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
