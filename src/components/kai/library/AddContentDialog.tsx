import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Instagram, Youtube, Mail, Linkedin } from "lucide-react";

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

import { CONTENT_TYPE_OPTIONS } from "@/types/contentTypes";

const CONTENT_TYPES = CONTENT_TYPE_OPTIONS.map(opt => ({
  value: opt.value,
  label: opt.label,
  icon: opt.category === 'Instagram' ? Instagram : 
        opt.category === 'Vídeo' ? Youtube : 
        opt.category === 'Escrita' ? Mail :
        opt.category === 'LinkedIn' ? Linkedin : Plus
}));

export function AddContentDialog({ open, onOpenChange, clientId }: AddContentDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("other");
  const [contentUrl, setContentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          title: title.trim(),
          content: content.trim(),
          content_type: contentType as any,
          content_url: contentUrl.trim() || null,
          metadata: {
            source: "manual",
            created_manually: true,
          },
        });

      if (error) throw error;

      toast.success("Conteúdo adicionado à biblioteca!");
      queryClient.invalidateQueries({ queryKey: ["unified-content", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      
      // Reset form
      setTitle("");
      setContent("");
      setContentType("other");
      setContentUrl("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding content:", error);
      toast.error("Erro ao adicionar conteúdo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setTitle("");
      setContent("");
      setContentType("other");
      setContentUrl("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Conteúdo</DialogTitle>
          <DialogDescription>
            Adicione conteúdo manualmente à biblioteca para usar como referência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="content-title">Título *</Label>
            <Input
              id="content-title"
              placeholder="Ex: Post sobre lançamento do produto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-type">Tipo de Conteúdo</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-url">URL do Conteúdo (opcional)</Label>
            <Input
              id="content-url"
              placeholder="https://..."
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-text">Conteúdo / Texto *</Label>
            <Textarea
              id="content-text"
              placeholder="Cole o texto do conteúdo aqui..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
