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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X } from "lucide-react";

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientDialog = ({ open, onOpenChange }: ClientDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  
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
  
  const { createClient } = useClients();

  const addWebsite = () => {
    if (websiteInput.trim() && !websites.includes(websiteInput.trim())) {
      setWebsites([...websites, websiteInput.trim()]);
      setWebsiteInput("");
    }
  };

  const removeWebsite = (url: string) => {
    setWebsites(websites.filter(w => w !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createClient.mutateAsync({
      name,
      description: description || null,
      context_notes: contextNotes || null,
      social_media: socialMedia,
      tags: tags,
      websites,
    });

    // Reset form
    setName("");
    setDescription("");
    setContextNotes("");
    setWebsites([]);
    setWebsiteInput("");
    setSocialMedia({ instagram: "", linkedin: "", facebook: "", twitter: "" });
    setTags({ segment: "", tone: "", objectives: "", audience: "" });
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="websites">Websites</TabsTrigger>
              <TabsTrigger value="social">Redes Sociais</TabsTrigger>
              <TabsTrigger value="tags">Tags/Notas</TabsTrigger>
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
